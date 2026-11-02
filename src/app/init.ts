import { getDb } from "../db/client";

/**
 * 启动串行加载入口。D3 只确保数据库与迁移就绪，
 * D6 再按 settings → tasks → checkins → todos 扩展。
 */
export async function initApp(): Promise<void> {
  await getDb();
}
