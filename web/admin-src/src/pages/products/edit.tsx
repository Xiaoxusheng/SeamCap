import { useEffect, useState } from 'react'
import { App, Alert, Button, Card, Form, Input, InputNumber, Radio, Select, Space, Spin, Switch, Tabs } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, get, post, put } from '../../api/client'
import type { Category, MediaLink, Product, ProductStatus } from '../../api/types'
import MediaIDField from '../../components/MediaIDField'
import GalleryEditor from '../../components/GalleryEditor'
import PageHeader from '../../components/PageHeader'

// 产品新建/编辑（整页表单 + Tabs 分组 + 画廊管理）
export default function ProductEdit(): JSX.Element {
  const { id } = useParams()
  const isEdit = id != null && id !== '' && Number(id) > 0
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [slugConflict, setSlugConflict] = useState('')
  const [gallery, setGallery] = useState<MediaLink[]>([])
  const productId = isEdit ? Number(id) : null

  useEffect(() => {
    void get<Category[]>('/admin/categories')
      .then(({ data }) => setCategories(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEdit) return
    let alive = true
    setLoading(true)
    get<Product>(`/admin/products/${id}`)
      .then(({ data: p }) => {
        if (!alive) return
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
        const galleryLinks: MediaLink[] = (p.images ?? []).map((m) => ({
          media_id: m.id,
          role: m.role ?? 'gallery',
          sort_order: m.sort_order ?? 0,
        }))
        setGallery(galleryLinks)
      })
      .catch((e: Error) => message.error(e.message))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
        // validateFields 的普通校验错误不弹全局提示
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    )
  }

  const basicTab = (
    <>
      <Form.Item name="name" label="产品名称 (Name) *" rules={[{ required: true, message: '请输入产品名称' }, { max: 200 }]} extra="英文，面向海外买家">
        <Input placeholder="e.g. LG260008 Solid Color Seamless Cap" maxLength={200} />
      </Form.Item>
      <Space wrap size={16}>
        <Form.Item name="sku" label="产品编号 (SKU)" style={{ width: 240 }}>
          <Input placeholder="e.g. LG260008" maxLength={100} />
        </Form.Item>
        <Form.Item name="category_id" label="分类" style={{ width: 240 }}>
          <Select
            allowClear
            placeholder="选择分类"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>
        <Form.Item name="sort_order" label="排序值（小在前）" style={{ width: 160 }}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="is_featured" label="首页精选" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Space>
      <Form.Item
        name="slug"
        label="URL Slug"
        extra="留空自动按名称生成；仅小写字母/数字/连字符"
        validateStatus={slugConflict ? 'warning' : undefined}
      >
        <Input placeholder="solid-color-seamless-cap" maxLength={100} />
      </Form.Item>
      {slugConflict && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`slug 已被占用，建议使用：${slugConflict}`}
          action={
            <Button size="small" onClick={applySuggestion}>
              采用建议
            </Button>
          }
        />
      )}
      <Form.Item name="status" label="状态">
        <Radio.Group
          options={[
            { value: 'draft', label: '草稿' },
            { value: 'published', label: '发布' },
            { value: 'archived', label: '归档' },
          ]}
          optionType="button"
        />
      </Form.Item>
    </>
  )

  const mediaTab = (
    <>
      <Form.Item name="main_image_id" label="主图 (Main Image)">
        <MediaIDField />
      </Form.Item>
      <Form.Item name="video_url" label="视频链接 (Video URL)" rules={[{ max: 500 }]} extra="MP4 地址，可留空">
        <Input placeholder="https://... or /uploads/2026/10/xxx.mp4" maxLength={500} />
      </Form.Item>
      <Form.Item label="画廊" style={{ marginBottom: 0 }}>
        {isEdit ? (
          <GalleryEditor value={gallery} onChange={setGallery} withRole />
        ) : (
          <Alert type="info" showIcon message="创建产品后即可管理画廊图片（先保存基础信息）" />
        )}
      </Form.Item>
    </>
  )

  const descTab = (
    <>
      <Form.Item name="short_desc" label="简短描述 (Short Description)" extra="列表卡片与分享摘要用，建议 1-2 句">
        <Input.TextArea rows={2} placeholder="Seamless baseball cap in solid colors, 6-panel construction..." maxLength={500} />
      </Form.Item>
      <Form.Item name="detail_desc" label="详细描述 (Detail Description)">
        <Input.TextArea rows={8} placeholder="Full product description for the detail page..." />
      </Form.Item>
    </>
  )

  const specTab = (
    <>
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
      <Form.Item name="customization" label="定制能力 (Customization)">
        <Input placeholder="Embroidery, woven label, sublimation printing; MOQ 300 pcs" maxLength={500} />
      </Form.Item>
    </>
  )

  const seoTab = (
    <>
      <Form.Item name="seo_title" label="SEO 标题" rules={[{ max: 200 }]}>
        <Input placeholder="留空则使用产品名称" maxLength={200} />
      </Form.Item>
      <Form.Item name="seo_desc" label="SEO 描述" rules={[{ max: 500 }]}>
        <Input.TextArea rows={3} maxLength={500} placeholder="留空则使用简短描述" />
      </Form.Item>
    </>
  )

  return (
    <div>
      <PageHeader
        title={isEdit ? '编辑产品' : '新建产品'}
        description={isEdit ? `ID: ${productId}` : '创建后可继续管理画廊图片'}
        extra={
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/products')}>
              返回列表
            </Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void submit()}>
              保存
            </Button>
          </>
        }
      />
      <Card>
        <Form form={form} layout="vertical" initialValues={{ status: 'draft', sort_order: 0, is_featured: false }}>
          <Tabs
            items={[
              { key: 'basic', label: '基础信息', children: basicTab, forceRender: true },
              { key: 'media', label: '图与视频', children: mediaTab, forceRender: true },
              { key: 'desc', label: '描述', children: descTab, forceRender: true },
              { key: 'spec', label: '规格', children: specTab, forceRender: true },
              { key: 'seo', label: 'SEO', children: seoTab, forceRender: true },
            ]}
          />
          <div style={{ borderTop: '1px solid #E3E7ED', paddingTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => navigate('/admin/products')}>取消</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void submit()}>
              保存
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
