-- 003_task_interval_every_days.sql · 每日任务支持「每 N 天一次」
-- 1 = 每天；N = 以该区间启用日为第 1 天，每 N 天出现一次。

ALTER TABLE task_intervals ADD COLUMN every_days INTEGER NOT NULL DEFAULT 1;
