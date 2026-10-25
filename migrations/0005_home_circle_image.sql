-- 0005_home_circle_image.sql — 首页「The Shirun Circle」板块配图
-- 之前该图硬编码在 index.html（static/img/cap-image-20.jpg），后台无法更换。
-- 新增字段后由后台首页设置管理；为空时前台保留静态兜底图。
ALTER TABLE home_content ADD COLUMN circle_image_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL;
