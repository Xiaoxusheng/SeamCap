-- 0003_product_note.sql — 产品“产品笔记”结构化内容（JSON 文本）
-- 结构由前端约定：{highlights:[], audience, color_notes:[{color,desc}], summary}
-- 后端仅存储/透传 JSON 字符串，不解析内部结构。
ALTER TABLE products ADD COLUMN note TEXT NOT NULL DEFAULT '';
