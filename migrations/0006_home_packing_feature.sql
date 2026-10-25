-- 0006_home_packing_feature.sql — 首页「发货展示」板块挑选条目
-- 结构：packing 条目 ID 数组（引用 packing 表）；空数组时前台默认取前 3 条已发布素材。
ALTER TABLE home_content ADD COLUMN packing_pick_json TEXT NOT NULL DEFAULT '[]';
