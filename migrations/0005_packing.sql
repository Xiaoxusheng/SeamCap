-- 0005_packing.sql — 打包发货素材库（前台「Packing & Dispatch」图库）
-- 一条记录 = 一个素材（图片或视频）+ 分类 + 文案，后台可增删排序发布。
CREATE TABLE IF NOT EXISTS packing_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  category   TEXT    NOT NULL DEFAULT 'packing',   -- packing | loading | warehouse
  title      TEXT    NOT NULL DEFAULT '',
  caption    TEXT    NOT NULL DEFAULT '',
  media_id   INTEGER NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT    NOT NULL DEFAULT 'published',  -- published | hidden
  created_at TEXT    NOT NULL DEFAULT '',
  updated_at TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_packing_items_order ON packing_items(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_packing_items_media ON packing_items(media_id);
