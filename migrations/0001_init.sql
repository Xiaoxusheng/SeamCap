-- 0001_init.sql — SeamCap 初始 schema（14 张表 + 索引）
-- 按《04-后端开发文档》§3.1；启动时按序执行未应用的迁移，记录于 schema_migrations，不覆盖已有数据。

-- 1. 管理员
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,             -- Argon2id 编码串
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

-- 2. 会话（数据库 Session）
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,         -- 仅存 SHA-256(token)
  admin_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  ip TEXT, user_agent TEXT,
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- 3. 产品
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT,                                -- 产品编号
  slug TEXT NOT NULL UNIQUE,
  category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
  short_desc TEXT, detail_desc TEXT,       -- 英文
  material TEXT, cap_shape TEXT, colors TEXT, sizes TEXT, customization TEXT,
  main_image_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
  video_url TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0,  -- 首页精选
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  seo_title TEXT, seo_desc TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT
);
CREATE INDEX idx_products_status_sort ON products(status, sort_order);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_featured ON products(is_featured, status);

-- 4. 分类
CREATE TABLE product_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, name_en TEXT, slug TEXT NOT NULL UNIQUE,
  description TEXT, image_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

-- 5. 产品媒体关联
CREATE TABLE product_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media_assets(id),
  role TEXT NOT NULL DEFAULT 'gallery' CHECK (role IN ('main','gallery','detail')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_product_media_product ON product_media(product_id, sort_order);

-- 6. 工艺
CREATE TABLE craftsmanship (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  summary TEXT, body TEXT,
  cover_image_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
  video_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden')),
  seo_title TEXT, seo_desc TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT
);
CREATE INDEX idx_craftsmanship_status_sort ON craftsmanship(status, sort_order);

-- 7. 工艺媒体关联（同 5 结构）
CREATE TABLE craftsmanship_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  craftsmanship_id INTEGER NOT NULL REFERENCES craftsmanship(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media_assets(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_craftsmanship_media ON craftsmanship_media(craftsmanship_id, sort_order);

-- 8. 普通页面
CREATE TABLE pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  body TEXT,                              -- 受控 HTML（写入前白名单过滤）
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  seo_title TEXT, seo_desc TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

-- 9. 首页内容（单行）
CREATE TABLE home_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  hero_title TEXT, hero_subtitle TEXT,
  hero_image_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
  hero_video_url TEXT,
  cta1_text TEXT, cta1_url TEXT, cta2_text TEXT, cta2_url TEXT,
  factory_intro TEXT, contact_blurb TEXT,
  advantages_json TEXT,                   -- [{title,desc,image}]
  process_steps_json TEXT,                -- [{step,desc}]
  footer_text TEXT,
  updated_at TEXT NOT NULL
);

-- 10. 站点设置（KV）
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,                   -- site_name/whatsapp/email/phone/address/
  value TEXT NOT NULL,                    -- map_link/social_links/seo_title/seo_desc...
  updated_at TEXT NOT NULL
);

-- 11. 询价
CREATE TABLE inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, company TEXT,
  email TEXT NOT NULL, whatsapp_phone TEXT,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT,             -- 冗余快照：产品删除不丢信息
  product_sku_snapshot TEXT,
  source_page TEXT, estimated_qty TEXT, customization TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','following','replied','completed','spam')),
  internal_note TEXT,
  handled_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  handled_at TEXT,
  email_notify_status TEXT DEFAULT 'pending' CHECK (email_notify_status IN ('pending','sent','failed','skipped')),
  ip TEXT, user_agent TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_inquiries_status_time ON inquiries(status, created_at);
CREATE INDEX idx_inquiries_email ON inquiries(email);
CREATE INDEX idx_inquiries_created ON inquiries(created_at);
CREATE INDEX idx_inquiries_ip ON inquiries(ip);

-- 12. 询价事件历史
CREATE TABLE inquiry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,               -- created/status_changed/note/notify
  from_status TEXT, to_status TEXT,
  admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  detail TEXT, created_at TEXT NOT NULL
);
CREATE INDEX idx_inquiry_events_inquiry ON inquiry_events(inquiry_id);

-- 13. 媒体资产
CREATE TABLE media_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,                 -- 安全化存储文件名（含日期目录）
  original_name TEXT NOT NULL,
  alt_text TEXT DEFAULT '',
  mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL,
  width INTEGER, height INTEGER,
  sha256 TEXT NOT NULL,                   -- 真实格式校验副产品，兼做去重
  created_at TEXT NOT NULL
);
CREATE INDEX idx_media_sha256 ON media_assets(sha256);

-- 14. 审计日志
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,                   -- login/product.create/product.delete/...
  entity_type TEXT, entity_id TEXT,
  detail TEXT, ip TEXT, created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_time ON audit_logs(created_at);

-- 迁移记录表
CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY, applied_at TEXT NOT NULL
);
