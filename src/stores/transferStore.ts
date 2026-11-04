import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { downloadDir, join } from "@tauri-apps/api/path";
import { create } from "zustand";

import { getDb } from "../db/client";
import { exportData } from "../db/transfer";
import { formatDate } from "../domain/date";

export interface TransferState {
  exporting: boolean;
  /** 导出 JSON v1；取消对话框返回 null。 */
  exportToFile: () => Promise<string | null>;
}

export const useTransferStore = create<TransferState>()((set) => ({
  exporting: false,

  exportToFile: async () => {
    const folder = await downloadDir();
    const path = await save({
      defaultPath: await join(
        folder,
        `dailytask-${formatDate(new Date())}.json`,
      ),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) {
      return null;
    }

    set({ exporting: true });
    try {
      const bundle = await exportData(await getDb());
      await writeTextFile(path, `${JSON.stringify(bundle, null, 2)}\n`);
      return path;
    } finally {
      set({ exporting: false });
    }
  },
}));
