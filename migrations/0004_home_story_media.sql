-- 0004_home_story_media.sql — 首页「The House / Real Production」工厂实景图库
-- 结构：媒体 ID 数组（引用 media_assets.id），后台可管理；公开端解析为 {kind,url} 列表。
-- 空数组时前台保留静态兜底图。
ALTER TABLE home_content ADD COLUMN story_media_json TEXT NOT NULL DEFAULT '[]';
