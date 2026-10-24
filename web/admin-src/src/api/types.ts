// 后端 JSON 契约类型（字段名与 Go 后端完全一致，snake_case）

export interface Pagination {
  page: number
  per_page: number
  total: number
}

export interface AdminUser {
  id: number
  username: string
  created_at: string
  updated_at: string
}

export interface LoginResult {
  admin: AdminUser
  csrf_token: string
  expires_at: string
}

export interface MeResult {
  admin: AdminUser
  csrf_token: string
}

export interface Media {
  id: number
  filename: string
  url: string
  original_name: string
  alt_text: string
  mime_type: string
  size_bytes: number
  width: number | null
  height: number | null
  sha256: string
  created_at: string
  role?: string
  sort_order?: number
}

export interface CategoryBrief {
  id: number
  name: string
  slug: string
}

export interface Category {
  id: number
  name: string
  name_en: string
  slug: string
  description: string
  image_id: number | null
  image?: Media | null
  sort_order: number
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  product_count?: number
}

export type ProductStatus = 'draft' | 'published' | 'archived'

export interface Product {
  id: number
  name: string
  sku: string
  slug: string
  category_id: number | null
  category?: CategoryBrief | null
  short_desc: string
  detail_desc: string
  material: string
  cap_shape: string
  colors: string
  sizes: string
  customization: string
  main_image_id: number | null
  main_image?: Media | null
  video_url: string
  is_featured: boolean
  sort_order: number
  status: ProductStatus
  seo_title: string
  seo_desc: string
  created_at: string
  updated_at: string
  published_at: string | null
  images?: Media[]
  related_products?: Product[]
}

export interface ProductInput {
  name: string
  sku?: string
  slug?: string
  category_id?: number | null
  short_desc?: string
  detail_desc?: string
  material?: string
  cap_shape?: string
  colors?: string
  sizes?: string
  customization?: string
  main_image_id?: number | null
  video_url?: string
  is_featured?: boolean
  sort_order?: number
  status: ProductStatus
  seo_title?: string
  seo_desc?: string
}

export interface MediaLink {
  media_id: number
  role?: string
  sort_order: number
}

export type CraftStatus = 'draft' | 'published' | 'hidden'

export interface Craftsmanship {
  id: number
  title: string
  slug: string
  summary: string
  body: string
  cover_image_id: number | null
  cover_image?: Media | null
  video_url: string
  sort_order: number
  status: CraftStatus
  seo_title: string
  seo_desc: string
  created_at: string
  updated_at: string
  published_at: string | null
  images?: Media[]
}

export interface PageContent {
  id: number
  slug: string
  title: string
  body: string
  status: 'draft' | 'published'
  seo_title: string
  seo_desc: string
  created_at: string
  updated_at: string
}

export interface Advantage {
  title: string
  desc: string
  image: string
}

export interface ProcessStep {
  step: string
  desc: string
}

export interface HomeContent {
  hero_title: string
  hero_subtitle: string
  hero_image_id: number | null
  hero_image?: Media | null
  hero_video_url: string
  cta1_text: string
  cta1_url: string
  cta2_text: string
  cta2_url: string
  factory_intro: string
  contact_blurb: string
  advantages: Advantage[]
  process_steps: ProcessStep[]
  footer_text: string
  updated_at: string
}

export type InquiryStatus = 'new' | 'following' | 'replied' | 'completed' | 'spam'

export interface Inquiry {
  id: number
  name: string
  company: string
  email: string
  whatsapp_phone: string
  product_id: number | null
  product_name_snapshot: string
  product_sku_snapshot: string
  source_page: string
  estimated_qty: string
  customization: string
  message: string
  status: InquiryStatus
  internal_note: string
  handled_by: number | null
  handled_at: string | null
  email_notify_status: 'pending' | 'sent' | 'failed' | 'skipped'
  ip: string
  user_agent: string
  created_at: string
  updated_at: string
}

export interface InquiryEvent {
  id: number
  inquiry_id: number
  event_type: string
  from_status: string
  to_status: string
  admin_id: number | null
  detail: string
  created_at: string
}

export interface AuditRow {
  id: number
  admin_id: number | null
  admin_username: string
  action: string
  entity_type: string
  entity_id: string
  detail: string
  ip: string
  created_at: string
}

export interface DashboardData {
  products: { published: number; draft: number; archived: number }
  craftsmanship: { total: number; published: number }
  inquiries: { new: number }
  recent_inquiries: Inquiry[]
  recent_products: Product[]
}

export interface ApiErrorBody {
  code: string
  message: string
  fields?: Record<string, string>
}
