import { useCallback, useEffect, useState } from 'react'
import { Alert, App, Button, Form, Input, InputNumber, Radio } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, fmtTime, get, post, put } from '../../api/client'
import type { CraftStatus, Craftsmanship, MediaLink } from '../../api/types'
import MediaIDField from '../../components/MediaIDField'
import GalleryEditor from '../../components/GalleryEditor'
import PageHeader from '../../components/PageHeader'
import PageSection from '../../components/PageSection'
import PageLoading from '../../components/PageLoading'
import PageError from '../../components/PageError'

// 工艺新建/编辑：内容创作工作台（主区 + 发布侧栏）
export default function CraftEdit(): JSX.Element {
  const { id } = useParams()
  const isEdit = id != null && Number(id) > 0
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [slugConflict, setSlugConflict] = useState('')
  const [gallery, setGallery] = useState<MediaLink[]>([])
  const [craft, setCraft] = useState<Craftsmanship | null>(null)

  const load = useCallback(async (): Promise<void> => {
    if (!isEdit) return
    setLoading(true)
    setError('')
    try {
      const { data: c } = await get<Craftsmanship>(`/admin/craftsmanship/${id}`)
      setCraft(c)
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
      setGallery((c.images ?? []).map((m) => ({ media_id: m.id, sort_order: m.sort_order ?? 0 })))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [form, id, isEdit])

  useEffect(() => {
    void load()
  }, [load])

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

  const header = (): JSX.Element => (
    <PageHeader
      variant="editor"
      title={isEdit ? craft?.title || '编辑工艺' : '新建工艺'}
      description={
        isEdit
          ? `维护工艺正文、封面与展示素材${
              craft?.slug ? ` · /craftsmanship/${craft.slug}/` : ''
            }`
          : '填写工艺内容、封面与展示素材，保存后同步到公开站。'
      }
      extra={
        loading || error ? undefined : (
          <>
            <Button onClick={() => navigate('/admin/craftsmanship')}>取消</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => void submit()}
            >
              保存工艺
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
        <PageError message={error} onRetry={() => void load()} />
      </div>
    )
  }

  return (
    <div>
      {header()}

      <Form form={form} layout="vertical" initialValues={{ status: 'draft', sort_order: 0 }}>
        <div className="sc-edit-layout">
          <div className="sc-editor-sheet">
            <PageSection title="基本信息" description="标题与摘要会显示在工艺列表与搜索结果中">
              <div className="sc-form-grid">
                <Form.Item
                  name="title"
                  label="标题 (Title)"
                  className="sc-span-2"
                  rules={[{ required: true, message: '请输入标题' }, { max: 200 }]}
                >
                  <Input placeholder="e.g. Seamless Knitting Process" maxLength={200} />
                </Form.Item>
                <Form.Item
                  name="slug"
                  label="Slug"
                  className="sc-span-2"
                  extra={
                    slugConflict
                      ? `已被占用，建议：${slugConflict}`
                      : '留空自动生成；用于公开站 /craftsmanship/{slug}/ 地址'
                  }
                  validateStatus={slugConflict ? 'warning' : undefined}
                >
                  <Input maxLength={100} placeholder="seamless-knitting-process" />
                </Form.Item>
                {slugConflict && (
                  <Alert
                    type="warning"
                    showIcon
                    className="sc-span-2"
                    message={`slug 已被占用，建议使用：${slugConflict}`}
                    action={
                      <Button
                        size="small"
                        onClick={() => {
                          form.setFieldsValue({ slug: slugConflict })
                          setSlugConflict('')
                        }}
                      >
                        采用建议
                      </Button>
                    }
                  />
                )}
                <Form.Item
                  name="summary"
                  label="摘要 (Summary)"
                  className="sc-span-2"
                  rules={[{ max: 1000 }]}
                  extra="用于列表卡片与分享摘要，建议 1–2 句"
                >
                  <Input.TextArea rows={3} maxLength={1000} />
                </Form.Item>
              </div>
            </PageSection>

            <PageSection title="正文内容" description="公开站按纯文本段落展示，建议分段落书写">
              <Form.Item name="body" label="正文 (Body)" style={{ marginBottom: 0 }}>
                <Input.TextArea
                  rows={14}
                  className="sc-prose-editor"
                  placeholder="Describe the process, equipment, quality control..."
                />
              </Form.Item>
            </PageSection>

            <PageSection title="封面图" description="封面用于工艺列表与分享卡片，优先展示真实图片">
              <div className="sc-form-grid">
                <Form.Item name="cover_image_id" label="封面图" className="sc-span-2">
                  <MediaIDField />
                </Form.Item>
              </div>
            </PageSection>

            <PageSection title="工艺画廊" description="按顺序展示工艺细节图，保存后同步到公开站">
              <Form.Item label="画廊图片" style={{ marginBottom: 0 }}>
                {isEdit ? (
                  <GalleryEditor value={gallery} onChange={setGallery} />
                ) : (
                  <Alert type="info" showIcon message="创建工艺后即可管理画廊图片" />
                )}
              </Form.Item>
            </PageSection>

            <PageSection title="视频" description="可选的 MP4 地址，用于展示工艺动态">
              <div className="sc-form-grid">
                <Form.Item
                  name="video_url"
                  label="视频链接 (Video URL)"
                  className="sc-span-2"
                  rules={[{ max: 500 }]}
                  extra="可留空"
                >
                  <Input placeholder="https://... or /uploads/2026/10/xxx.mp4" maxLength={500} />
                </Form.Item>
              </div>
            </PageSection>

            <PageSection title="SEO" description="留空时使用标题与摘要">
              <div className="sc-form-grid">
                <Form.Item name="seo_title" label="SEO 标题" className="sc-span-2" rules={[{ max: 200 }]}>
                  <Input maxLength={200} />
                </Form.Item>
                <Form.Item name="seo_desc" label="SEO 描述" className="sc-span-2" rules={[{ max: 500 }]}>
                  <Input.TextArea rows={3} maxLength={500} />
                </Form.Item>
              </div>
            </PageSection>
          </div>

          <aside className="sc-edit-aside">
            <PageSection compact title="发布设置" description="控制公开站可见性与排序">
              <Form.Item name="status" label="发布状态">
                <Radio.Group>
                  <Radio value="draft">草稿</Radio>
                  <Radio value="published">发布</Radio>
                  <Radio value="hidden">隐藏</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                name="sort_order"
                label="排序值"
                extra="数值越小越靠前"
                style={{ marginBottom: 0 }}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </PageSection>

            {isEdit && craft && (
              <section className="sc-panel">
                <div className="sc-panel-head">
                  <h2 className="sc-panel-head__title">工艺信息</h2>
                </div>
                <div className="sc-panel__body">
                  <dl className="sc-meta-list">
                    <div className="sc-meta-row">
                      <dt>工艺 ID</dt>
                      <dd className="sc-mono">#{craft.id}</dd>
                    </div>
                    <div className="sc-meta-row">
                      <dt>创建时间</dt>
                      <dd className="sc-tabular">{fmtTime(craft.created_at)}</dd>
                    </div>
                    <div className="sc-meta-row">
                      <dt>更新时间</dt>
                      <dd className="sc-tabular">{fmtTime(craft.updated_at)}</dd>
                    </div>
                    {craft.published_at && (
                      <div className="sc-meta-row">
                        <dt>发布时间</dt>
                        <dd className="sc-tabular">{fmtTime(craft.published_at)}</dd>
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
