-- 001_init.sql · 第一版表结构（只增不改，历史脚本禁止修改）

CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('voluntary','forced')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 启用区间拆表，支持多段（停用后再启用）
CREATE TABLE task_intervals (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date   TEXT,                        -- NULL = 至今有效
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_intervals_task ON task_intervals(task_id);

CREATE TABLE checkins (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,               -- YYYY-MM-DD
  status     TEXT NOT NULL CHECK (status IN ('done','missed','skipped')),
  note       TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (task_id, date)                  -- 一格一条，upsert 保证幂等
);
CREATE INDEX idx_checkins_date ON checkins(date);

CREATE TABLE todos (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  due_date     TEXT,
  done         INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_todos_due ON todos(done, due_date);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
