/**
 * 全应用写库串行队列。SQLite 并发写只在单连接内排队，
 * 这里再兜一层，避免快速连点时出现半写。
 */
let tail: Promise<unknown> = Promise.resolve();

export function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(() => task());
  tail = run.catch(() => undefined);
  return run;
}
