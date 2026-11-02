import Database from "@tauri-apps/plugin-sql";

export const DB_URL = "sqlite:dailytask.db";

export interface QueryResult {
  rowsAffected: number;
  lastInsertId?: number;
}

/** repository 只依赖这个最小接口，测试时可替换成内存实现。 */
export interface SqlDatabase {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<QueryResult>;
}

let dbPromise: Promise<Database> | null = null;

/** 全应用唯一入口：首次调用时加载数据库并跑迁移。 */
export function getDb(): Promise<Database> {
  dbPromise ??= Database.load(DB_URL);
  return dbPromise;
}
