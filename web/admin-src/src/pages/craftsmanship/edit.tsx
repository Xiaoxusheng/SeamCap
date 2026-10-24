import { useEffect, useState } from 'react'
import { App, Alert, Button, Card, Form, Input, InputNumber, Radio, Space, Spin } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, get, post, put } from '../../api/client'
import type { CraftStatus, Craftsmanship, MediaLink } from '../../api/types'
import MediaIDField from '../../components/MediaIDField'
import GalleryEditor from '../../components/GalleryEditor'
import PageHeader from '../../components/PageHeader'

// 工艺新建/编辑
export default function CraftEdit(): JSX.Element {
  const { id } = useParams()
  const isEdit = id != null && Number(id) > 0
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [slugConflict, setSlugConflict] = useState('')
  const [gallery, setGallery] = useState<MediaLink[]>([])

  useEffect(() => {
    if (!isEdit) return
    let alive = true
    setLoading(true)
    get<Craftsmanship>(`/admin/craftsmanship/${id}`)
      .then(({ data: c }) => {
        if (!alive) return
        form.setFieldsValue({
          title: c.title,
          slug: c.slug,
          summary: c.summary,
          body: c.body,
          cover_image_id: c.cover_image_id,
          video_url: c.video_url,
          sort_order: c.sort_order,
          status: c.status,
          seo_title: c.seo_title,
          seo_desc: c.seo_desc,
        })
        setGallery(
          (c.images ?? []).map((m) => ({ media_id: m.id, sort_order: m.sort_order ?? 0 })),
        )
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
      const payload = { ...values, status: values.status as CraftStatus }
      if (isEdit) {
        await put(`/admin/craftsmanship/${id}`, payload)
        await put(`/admin/craftsmanship/${id}/media`, { items: gallery })
        message.success('工艺已保存')
      } else {
        const { data } = await post<Craftsmanship>('/admin/craftsmanship', payload)
        if (gallery.length > 0) await put(`/admin/craftsmanship/${data.id}/media`, { items: gallery })
        message.success('工艺已创建')
        navigate(`/admin/craftsmanship/${data.id}/edit`, { replace: true })
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.fields?.slug && e.fields?.suggestion) {
          setSlugConflict(e.fields.suggestion)
          message.warning(`slug 已被占用，建议：${e.fields.suggestion}`)
        } else if (e.fields && Object.keys(e.fields).length > 0) {
          form.setFields(Object.entries(e.fields).map(([name, errors]) => ({ name, errors: [errors] })))
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? '编辑工艺' : '新建工艺'}
        extra={
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/craftsmanship')}>
              返回列表
            </Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void submit()}>
              保存
            </Button>
          </>
        }
      />
      <Card>
        <Form form={form} layout="vertical" initialValues={{ status: 'draft', sort_order: 0 }}>
          <Space wrap size={16} align="start">
            <Form.Item name="title" label="标题 (Title) *" rules={[{ required: true, message: '请输入标题' }, { max: 200 }]} style={{ width: 320 }}>
              <Input placeholder="e.g. Seamless Knitting Process" maxLength={200} />
            </Form.Item>
            <Form.Item
              name="slug"
              label="Slug"
              style={{ width: 320 }}
              extra={slugConflict ? `已被占用，建议：${slugConflict}` : '留空自动生成'}
              validateStatus={slugConflict ? 'warning' : undefined}
            >
              <Input maxLength={100} />
            </Form.Item>
            {slugConflict && (
              <Button style={{ marginTop: 30 }} onClick={() => { form.setFieldsValue({ slug: slugConflict }); setSlugConflict('') }}>
                采用建议
              </Button>
            )}
            <Form.Item name="sort_order" label="排序值" style={{ width: 120 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Radio.Group
                options={[
                  { value: 'draft', label: '草稿' },
                  { value: 'published', label: '发布' },
                  { value: 'hidden', label: '隐藏' },
                ]}
                optionType="button"
              />
            </Form.Item>
          </Space>
          <Form.Item name="summary" label="摘要 (Summary)" rules={[{ max: 1000 }]}>
            <Input.TextArea rows={2} maxLength={1000} />
          </Form.Item>
          <Form.Item name="body" label="正文 (Body)">
            <Input.TextArea rows={10} />
          </Form.Item>
          <Space wrap size={16} align="start" style={{ width: '100%' }}>
            <Form.Item name="cover_image_id" label="封面图" style={{ minWidth: 320 }}>
              <MediaIDField />
            </Form.Item>
            <Form.Item name="video_url" label="视频链接" rules={[{ max: 500 }]} style={{ minWidth: 380 }}>
              <Input maxLength={500} />
            </Form.Item>
          </Space>
          <Form.Item label="画廊" style={{ marginBottom: 8 }}>
            {isEdit ? (
              <GalleryEditor value={gallery} onChange={setGallery} />
            ) : (
              <Alert type="info" showIcon message="创建后可管理画廊" />
            )}
          </Form.Item>
          <Space wrap size={16}>
            <Form.Item name="seo_title" label="SEO 标题" style={{ width: 400 }}>
              <Input maxLength={200} />
            </Form.Item>
            <Form.Item name="seo_desc" label="SEO 描述" style={{ width: 500 }}>
              <Input.TextArea rows={2} maxLength={500} />
            </Form.Item>
          </Space>
        </Form>
      </Card>
    </div>
  )
}
