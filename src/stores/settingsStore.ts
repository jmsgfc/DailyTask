import { create } from "zustand";

import { getDb } from "../db/client";
import { getSettings, setSettings } from "../db/settings";
import { DEFAULT_SETTINGS, type Settings } from "../domain/types";
import { currentSource, emitSettingsChanged } from "../shared/events";
import { enqueueWrite } from "../shared/queue";

export interface SettingsState {
  settings: Settings;
  loaded: boolean;
  hydrate: (settings: Settings) => void;
  /** 导入后重新读取设置；不写库、不发事件。 */
  reload: () => Promise<void>;
  /** 乐观更新：先改内存，落库失败再回滚。 */
  update: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  hydrate: (settings) => set({ settings, loaded: true }),

  reload: async () => {
    const settings = await getSettings(await getDb());
    set({ settings, loaded: true });
  },

  update: (patch) => {
    const previous = get().settings;
    set({ settings: { ...previous, ...patch } });

    return enqueueWrite(async () => {
      try {
        await setSettings(await getDb(), patch);
        await emitSettingsChanged({ source: currentSource() }).catch(
          () => undefined,
        );
      } catch (error) {
        set({ settings: previous });
        throw error;
      }
    });
  },
}));
