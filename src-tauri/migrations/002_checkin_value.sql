-- 002_checkin_value.sql · 给打卡增加自由值（次数 / 时长 / 任意文本）
-- 历史脚本 001 不改；SQLite 无法放宽既有 CHECK，只能重建表。

CREATE TABLE checkins_new (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,               -- YYYY-MM-DD
  status     TEXT NOT NULL CHECK (status IN ('done','missed','skipped','recorded')),
  value      TEXT,                        -- 自由值；与 status 相互独立
  note       TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (task_id, date)                  -- 一格一条，upsert 保证幂等
);

INSERT INTO checkins_new (id, task_id, date, status, value, note, updated_at)
SELECT id, task_id, date, status, NULL, note, updated_at FROM checkins;

DROP TABLE checkins;
ALTER TABLE checkins_new RENAME TO checkins;
CREATE INDEX idx_checkins_date ON checkins(date);
