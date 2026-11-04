import { useEffect } from "react";

import { useUpdateStore } from "../stores/updateStore";

/** 启动时静默检查一次更新；失败只记日志，不打断使用。 */
export function useUpdateCheck(): void {
  useEffect(() => {
    void useUpdateStore.getState().checkForUpdate();
  }, []);
}
