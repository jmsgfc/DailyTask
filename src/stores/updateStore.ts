import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";

import { snapshotBeforeUpdate } from "../db/backup";

export interface UpdateInfo {
  version: string;
  notes: string | null;
}

export interface UpdateState {
  available: UpdateInfo | null;
  checking: boolean;
  installing: boolean;
  /** 至少成功检查过一次，用来区分「还没查」和「已是最新」。 */
  checked: boolean;
  /** check = 检查失败；install = 下载或安装失败。 */
  error: "check" | "install" | null;
  /** 原生 Update 资源，不参与渲染。 */
  pending: Update | null;
  checkForUpdate: () => Promise<void>;
  install: () => Promise<void>;
}

export const useUpdateStore = create<UpdateState>()((set, get) => ({
  available: null,
  checking: false,
  installing: false,
  checked: false,
  error: null,
  pending: null,

  checkForUpdate: async () => {
    set({ checking: true, error: null });
    try {
      const update = await check();
      set({
        pending: update,
        available: update
          ? { version: update.version, notes: update.body ?? null }
          : null,
        checked: true,
      });
    } catch (error) {
      console.error("[update] 检查更新失败", error);
      set({ error: "check" });
    } finally {
      set({ checking: false });
    }
  },

  install: async () => {
    const update = get().pending;
    if (!update) {
      return;
    }
    set({ installing: true, error: null });
    try {
      // 快照失败会抛错，从而中止安装（impl.md §9）。
      await snapshotBeforeUpdate(update.version);
      await update.downloadAndInstall();
      await relaunch();
    } catch (error) {
      console.error("[update] 安装更新失败", error);
      set({ error: "install", installing: false });
    }
  },
}));
