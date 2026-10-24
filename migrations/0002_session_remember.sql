-- 0002_session_remember.sql — 会话“记住登录”标记（登录时勾选，用于 30 天 TTL 与滑动续期）
ALTER TABLE sessions ADD COLUMN remember INTEGER NOT NULL DEFAULT 0;
