import { useCallback, useEffect, useState } from 'react'
import { Alert, App, Button, Form, Input, InputNumber, Radio, Select, Switch } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, fmtTime, get, post, put } from '../../api/client'
import type { Category, MediaLink, Product, ProductStatus } from '../../api/types'
import MediaIDField from '../../components/MediaIDField'
import GalleryEditor from '../../components/GalleryEditor'
import PageHeader from '../../components/PageHeader'
import PageSection from '../../components/PageSection'
import PageLoading from '../../components/PageLoading'
import PageError from '../../components/PageError'

// 产品新建/编辑：内容编辑工作台（主区 + 发布侧栏）
export default function ProductEdit(): JSX.Element {
  const { id } = useParams()
  const isEdit = id != null && id !== '' && Number(id) > 0
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [slugConflict, setSlugConflict] = useState('')
  const [gallery, setGallery] = useState<MediaLink[]>([])
  const [product, setProduct] = useState<Product | null>(null)
  const productId = isEdit ? Number(id) : null

  useEffect(() => {
    void get<Category[]>('/admin/categories')
      .then(({ data }) => setCategories(data))
      .catch(() => {})
  }, [])

  const loadProduct = useCallback(async (): Promise<void> => {
    if (!isEdit) return
    setLoading(true)
    setError('')
    try {
      const { data: p } = await get<Product>(`/admin/products/${id}`)
      setProduct(p)
      form.setFieldsValue({
        name: p.name,
        sku: p.sku,
        slug: p.slug,
        category_id: p.category_id,
        short_desc: p.short_desc,
        detail_desc: p.detail_desc,
        material: p.material,
        cap_shape: p.cap_shape,
        colors: p.colors,
        sizes: p.sizes,
        customization: p.customization,
        main_image_id: p.main_image_id,
        video_url: p.video_url,
        is_featured: p.is_featured,
        sort_order: p.sort_order,
        status: p.status,
        seo_title: p.seo_title,
        seo_desc: p.seo_desc,
      })
      setGallery(
        (p.images ?? []).map((m) => ({
          media_id: m.id,
          role: m.role ?? 'gallery',
          sort_order: m.sort_order ?? 0,
        })),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [form, id, isEdit])

  useEffect(() => {
    void loadProduct()
  }, [loadProduct])

  const submit = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      setSlugConflict('')
      const payload = { ...values, status: values.status as ProductStatus }
      if (isEdit && productId != null) {
        await put(`/admin/products/${productId}`, payload)
        await put(`/admin/products/${productId}/media`, { items: gallery })
        message.success('产品已保存')
      } else {
        const { data } = await post<Product>('/admin/products', payload)
        if (gallery.length > 0) {
          await put(`/admin/products/${data.id}/media`, { items: gallery })
        }
        message.success('产品已创建')
        navigate(`/admin/products/${data.id}/edit`, { replace: true })
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.fields && e.fields.slug && e.fields.suggestion) {
          setSlugConflict(e.fields.suggestion)
          message.warning(`slug「${e.fields.slug}」，已给出可用建议`)
        } else if (e.fields && Object.keys(e.fields).length > 0) {
          form.setFields(
            Object.entries(e.fields)
              .filter(([k]) => k !== 'suggestion')
              .map(([name, errors]) => ({ name, errors: [errors] })),
          )
        } else {
          message.error(e.message)
        }
      } else if (e instanceof Error && e.message !== 'Validate failed') {
        message.error(e.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const applySuggestion = (): void => {
    form.setFieldsValue({ slug: slugConflict })
    setSlugConflict('')
    void message.success('已采用建议 slug')
  }

  const header = (): JSX.Element => (
    <PageHeader
      variant="editor"
      title={isEdit ? product?.name || '编辑产品' : '新建产品'}
      description={
        isEdit
          ? `维护产品内容、图库与发布设置${
              product?.sku ? ` · ${product.sku}` : ''
            }${product?.slug ? ` · /${product.slug}` : ''}`
          : '填写产品信息，保存后可继续管理主图、画廊与视频。'
      }
      extra={
        loading || error ? undefined : (
          <>
            <Button onClick={() => navigate('/admin/products')}>取消</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => void submit()}
            >
              保存产品
            </Button>
          </>
        )
      }
    />
  )

  if (loading) {
    return (
      <div>
        {header()}
        <PageLoading rows={10} />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        {header()}
        <PageError message={error} onRetry={() => void loadProduct()} />
      </div>
    )
  }

  return (
    <div>
      {header()}

      <Form
        form={form}
        layout="vertical"
        initialValues={{ status: 'draft', sort_order: 0, is_featured: false }}
      >
        <div className="sc-edit-layout">
          <div className="sc-editor-sheet">
            <PageSection title="基本信息" description="名称、编号与公开站 URL">
              <div className="sc-form-grid">
                <Form.Item
                  name="name"
                  label="产品名称 (Name)"
                  className="sc-span-2"
                  rules={[{ required: true, message: '请输入产品名称' }, { max: 200 }]}
                  extra="英文录入，面向海外买家"
                >
                  <Input placeholder="e.g. LG260008 Solid Color Seamless Cap" maxLength={200} />
                </Form.Item>
                <Form.Item name="sku" label="产品编号 (SKU)" extra="用于询价快照与内部识别">
                  <Input placeholder="e.g. LG260008" maxLength={100} />
                </Form.Item>
                <Form.Item
                  name="slug"
                  label="URL Slug"
                  extra="留空自动按名称生成；仅小写字母 / 数字 / 连字符"
                  validateStatus={slugConflict ? 'warning' : undefined}
                >
                  <Input placeholder="solid-color-seamless-cap" maxLength={100} />
                </Form.Item>
                {slugConflict && (
                  <Alert
                    type="warning"
                    showIcon
                    className="sc-span-2"
                    message={`slug 已被占用，建议使用：${slugConflict}`}
                    action={
                      <Button size="small" onClick={applySuggestion}>
                        采用建议
                      </Button>
                    }
                  />
                )}
              </div>
            </PageSection>

            <PageSection
              title="产品描述"
              description="列表摘要与详情页正文；摘要用于分享与卡片展示"
            >
              <div className="sc-form-grid">
                <Form.Item
                  name="short_desc"
                  label="简短描述 (Short Description)"
                  className="sc-span-2"
                  extra="建议 1–2 句"
                >
                  <Input.TextArea
                    rows={3}
                    placeholder="Seamless baseball cap in solid colors, 6-panel construction..."
                    maxLength={500}
                  />
                </Form.Item>
                <Form.Item
                  name="detail_desc"
                  label="详细描述 (Detail Description)"
                  className="sc-span-2"
                >
                  <Input.TextArea
                    rows={9}
                    placeholder="Full product description for the detail page..."
                  />
                </Form.Item>
              </div>
            </PageSection>

            <PageSection
              title="规格与定制"
              description="材料、帽型、颜色、尺码与定制能力；逗号分隔多值"
            >
              <div className="sc-form-grid">
                <Form.Item name="material" label="材质 (Material)">
                  <Input placeholder="e.g. 100% polyester, moisture-wicking" maxLength={200} />
                </Form.Item>
                <Form.Item name="cap_shape" label="帽型 (Cap Shape)">
                  <Input placeholder="e.g. 6-panel baseball / 5-panel" maxLength={200} />
                </Form.Item>
                <Form.Item name="colors" label="颜色 (Colors)" extra="逗号分隔">
                  <Input placeholder="Black, White, Navy, Beige" maxLength={500} />
                </Form.Item>
                <Form.Item name="sizes" label="尺码 (Sizes)" extra="逗号分隔">
                  <Input placeholder="Adult 56-60cm, Kids 50-54cm" maxLength={500} />
                </Form.Item>
                <Form.Item name="customization" label="定制能力 (Customization)" className="sc-span-2">
                  <Input
                    placeholder="Embroidery, woven label, sublimation printing; MOQ 300 pcs"
                    maxLength={500}
                  />
                </Form.Item>
              </div>
            </PageSection>

            <PageSection
              title="主图与图库"
              description="主图用于目录卡片；画廊按顺序展示在公开站详情页"
            >
              <div className="sc-form-grid">
                <Form.Item name="main_image_id" label="主图 (Main Image)" className="sc-span-2">
                  <MediaIDField />
                </Form.Item>
              </div>
              <Form.Item
                label="产品画廊"
                extra="支持多图排序；主图角色最多一个，保存后同步到公开站详情页"
                style={{ marginBottom: 0 }}
              >
                {isEdit ? (
                  <GalleryEditor value={gallery} onChange={setGallery} withRole />
                ) : (
                  <Alert type="info" showIcon message="创建产品后即可管理画廊图片（先保存基础信息）" />
                )}
              </Form.Item>
            </PageSection>

            <PageSection
              title="视频"
              description="可选的 MP4 地址；公开站详情页按需播放"
            >
              <div className="sc-form-grid">
                <Form.Item
                  name="video_url"
                  label="视频链接 (Video URL)"
                  className="sc-span-2"
                  rules={[{ max: 500 }]}
                  extra="MP4 地址，可留空"
                >
                  <Input placeholder="https://... or /uploads/2026/10/xxx.mp4" maxLength={500} />
                </Form.Item>
              </div>
            </PageSection>

            <PageSection title="SEO" description="留空时使用产品名称与简短描述">
              <div className="sc-form-grid">
                <Form.Item name="seo_title" label="SEO 标题" rules={[{ max: 200 }]} className="sc-span-2">
                  <Input placeholder="留空则使用产品名称" maxLength={200} />
                </Form.Item>
                <Form.Item name="seo_desc" label="SEO 描述" rules={[{ max: 500 }]} className="sc-span-2">
                  <Input.TextArea rows={4} maxLength={500} placeholder="留空则使用简短描述" />
                </Form.Item>
              </div>
            </PageSection>
          </div>

          <aside className="sc-edit-aside">
            <PageSection compact title="发布设置" description="控制公开站展示与排序权重">
              <Form.Item name="status" label="发布状态">
                <Radio.Group>
                  <Radio value="draft">草稿</Radio>
                  <Radio value="published">发布</Radio>
                  <Radio value="archived">归档</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item name="category_id" label="产品分类">
                <Select
                  allowClear
                  placeholder="选择分类"
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Form.Item>
              <Form.Item
                name="is_featured"
                label="首页精选"
                valuePropName="checked"
                extra="展示在公开站首页精选区"
              >
                <Switch />
              </Form.Item>
              <Form.Item name="sort_order" label="排序值" extra="数值越小越靠前" style={{ marginBottom: 0 }}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </PageSection>

            {isEdit && product && (
              <section className="sc-panel">
                <div className="sc-panel-head">
                  <h2 className="sc-panel-head__title">产品信息</h2>
                </div>
                <div className="sc-panel__body">
                  <dl className="sc-meta-list">
                    <div className="sc-meta-row">
                      <dt>产品 ID</dt>
                      <dd className="sc-mono">#{product.id}</dd>
                    </div>
                    <div className="sc-meta-row">
                      <dt>创建时间</dt>
                      <dd className="sc-tabular">{fmtTime(product.created_at)}</dd>
                    </div>
                    <div className="sc-meta-row">
                      <dt>更新时间</dt>
                      <dd className="sc-tabular">{fmtTime(product.updated_at)}</dd>
                    </div>
                    {product.published_at && (
                      <div className="sc-meta-row">
                        <dt>发布时间</dt>
                        <dd className="sc-tabular">{fmtTime(product.published_at)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>
            )}
          </aside>
        </div>
      </Form>
    </div>
  )
}
