import { useEffect } from "react";

import { isDevBuild } from "../shared/env";
import { useUpdateStore } from "../stores/updateStore";

export const UPDATE_CHECK_KEY = "dailytask.update.lastCheck";
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * 启动时静默检查一次更新；开发构建不查，避免把正式版装进 dev 目录。
 * 主窗隐藏后会被销毁、唤回时重新挂载，所以按 localStorage 时间戳节流，
 * 避免每次唤回都打一次更新接口。
 */
export function useUpdateCheck(): void {
  useEffect(() => {
    if (isDevBuild) {
      return;
    }

    const now = Date.now();
    try {
      const last = Number(localStorage.getItem(UPDATE_CHECK_KEY) ?? 0);
      if (Number.isFinite(last) && now - last < UPDATE_CHECK_INTERVAL_MS) {
        return;
      }
      localStorage.setItem(UPDATE_CHECK_KEY, String(now));
    } catch {
      // 存储不可用时不做节流，照常检查。
    }

    void useUpdateStore.getState().checkForUpdate();
  }, []);
}
