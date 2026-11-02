import { create } from "zustand";

import { getDb } from "../db/client";
import { setSettings } from "../db/settings";
import { DEFAULT_SETTINGS, type Settings } from "../domain/types";
import { enqueueWrite } from "../shared/queue";

export interface SettingsState {
  settings: Settings;
  loaded: boolean;
  hydrate: (settings: Settings) => void;
  update: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  hydrate: (settings) => set({ settings, loaded: true }),

  update: (patch) =>
    enqueueWrite(async () => {
      await setSettings(await getDb(), patch);
      set({ settings: { ...get().settings, ...patch } });
    }),
}));
