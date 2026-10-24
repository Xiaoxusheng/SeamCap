import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, Popconfirm, Tooltip } from 'antd'
import {
  DeleteOutlined,
  LinkOutlined,
  PictureOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { cachedMedia, fetchMedia, get, put } from '../../api/client'
import type { HomeContent, Media } from '../../api/types'
import MediaIDField from '../../components/MediaIDField'
import MediaURLField from '../../components/MediaURLField'
import PageHeader from '../../components/PageHeader'
import PageSection from '../../components/PageSection'
import PageLoading from '../../components/PageLoading'
import PageError from '../../components/PageError'

const SECTIONS = [
  { id: 'hero', label: '首屏标题' },
  { id: 'media', label: '首屏素材' },
  { id: 'cta', label: 'CTA 按钮' },
  { id: 'factory', label: '工厂介绍' },
  { id: 'advantages', label: '工厂优势' },
  { id: 'process', label: '工艺流程' },
  { id: 'contact', label: '联系介绍' },
  { id: 'footer', label: '页脚' },
]

// 首页内容：分区导航 + 分区表单 + 当前表单值的实时首屏预览
export default function HomePage(): JSX.Element {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('hero')

  const heroTitle = Form.useWatch('hero_title', form) as string | undefined
  const heroSubtitle = Form.useWatch('hero_subtitle', form) as string | undefined
  const heroImageId = Form.useWatch('hero_image_id', form) as number | null | undefined
  const cta1Text = Form.useWatch('cta1_text', form) as string | undefined
  const cta2Text = Form.useWatch('cta2_text', form) as string | undefined
  const footerText = Form.useWatch('footer_text', form) as string | undefined
  const heroVideo = Form.useWatch('hero_video_url', form) as string | undefined
  const [previewMedia, setPreviewMedia] = useState<Media | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const { data: h } = await get<HomeContent>('/admin/home')
      form.setFieldsValue({
        hero_title: h.hero_title,
        hero_subtitle: h.hero_subtitle,
        hero_image_id: h.hero_image_id,
        hero_video_url: h.hero_video_url,
        cta1_text: h.cta1_text,
        cta1_url: h.cta1_url,
        cta2_text: h.cta2_text,
        cta2_url: h.cta2_url,
        factory_intro: h.factory_intro,
        contact_blurb: h.contact_blurb,
        advantages: h.advantages.length > 0 ? h.advantages : [{}],
        process_steps: h.process_steps.length > 0 ? h.process_steps : [{}],
        footer_text: h.footer_text,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!heroImageId) {
      setPreviewMedia(null)
      return
    }
    const hit = cachedMedia(heroImageId)
    if (hit) {
      setPreviewMedia(hit)
      return
    }
    let alive = true
    setPreviewMedia(null)
    void fetchMedia(heroImageId).then((m) => {
      if (alive) setPreviewMedia(m)
    })
    return () => {
      alive = false
    }
  }, [heroImageId])

  useEffect(() => {
    if (loading || error) return
    const targets = SECTIONS.map((s) => document.getElementById(`sc-home-${s.id}`)).filter(
      (el): el is HTMLElement => el != null,
    )
    if (targets.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveSection(visible[0].target.id.replace('sc-home-', ''))
      },
      { rootMargin: '-150px 0px -55% 0px', threshold: 0 },
    )
    targets.forEach((t) => observer.observe(t))
    return () => observer.disconnect()
  }, [loading, error])

  const scrollToSection = (id: string): void => {
    const el = document.getElementById(`sc-home-${id}`)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const submit = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        ...values,
        hero_image_id: values.hero_image_id ?? null,
        advantages: (values.advantages ?? []).map(
          (a: { title?: string; desc?: string; image?: string }) => ({
            title: a.title ?? '',
            desc: a.desc ?? '',
            image: a.image ?? '',
          }),
        ),
        process_steps: (values.process_steps ?? []).map((s: { step?: string; desc?: string }) => ({
          step: s.step ?? '',
          desc: s.desc ?? '',
        })),
      }
      await put('/admin/home', payload)
      message.success('首页内容已更新，前台立即生效')
    } catch (e) {
      const err = e as { fields?: Record<string, string>; message?: string }
      if (err.fields) {
        form.setFields(Object.entries(err.fields).map(([name, errors]) => ({ name, errors: [errors] })))
      } else if (err.message && err.message !== 'Validate failed') {
        message.error(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const header = (disabled = false): JSX.Element => (
    <PageHeader
      title="首页内容"
      description="控制公开站首页各板块的文案、图片与流程；保存后立即生效。"
      extra={
        <>
          <Button icon={<LinkOutlined />} href="/" target="_blank" rel="noreferrer">
            查看公开站
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={disabled}
            onClick={() => void submit()}
          >
            保存内容
          </Button>
        </>
      }
    />
  )

  if (loading) {
    return (
      <div>
        {header(true)}
        <PageLoading rows={12} />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        {header(true)}
        <PageError message={error} onRetry={() => void load()} />
      </div>
    )
  }

  return (
    <div>
      {header()}
      <Form form={form} layout="vertical">
        <div className="sc-home-layout sc-home-layout--preview">
          <nav className="sc-home-nav" aria-label="首页内容分区">
            {SECTIONS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`sc-home-nav__item${activeSection === s.id ? ' is-active' : ''}`}
                aria-current={activeSection === s.id ? 'true' : undefined}
                onClick={() => scrollToSection(s.id)}
              >
                <span className="sc-home-nav__index">{String(i + 1).padStart(2, '0')}</span>
                {s.label}
              </button>
            ))}
            <div className="sc-home-nav__save">
              <Button
                type="primary"
                block
                icon={<SaveOutlined />}
                loading={saving}
                onClick={() => void submit()}
              >
                保存内容
              </Button>
            </div>
          </nav>

          <div className="sc-home-sections">
            <PageSection
              id="sc-home-hero"
              title="首屏标题与副标题"
              description="首页第一屏的主标题与副标题，英文录入，直接展示给海外买家"
            >
              <div className="sc-form-grid">
                <Form.Item name="hero_title" label="主标题" className="sc-span-2">
                  <Input placeholder="Perfection has no seams." maxLength={200} />
                </Form.Item>
                <Form.Item name="hero_subtitle" label="副标题" className="sc-span-2">
                  <Input
                    placeholder="Direct from our seamless cap factory in Yiwu"
                    maxLength={300}
                  />
                </Form.Item>
              </div>
            </PageSection>

            <PageSection
              id="sc-home-media"
              title="首屏主图与视频"
              description="Hero 背景素材；视频优先级高于图片"
            >
              <div className="sc-form-grid">
                <Form.Item name="hero_image_id" label="背景图" className="sc-span-2">
                  <MediaIDField />
                </Form.Item>
                <Form.Item
                  name="hero_video_url"
                  label="背景视频 URL"
                  className="sc-span-2"
                  extra="MP4 地址；留空则使用背景图"
                >
                  <Input maxLength={500} placeholder="https://... or /uploads/2026/10/xxx.mp4" />
                </Form.Item>
              </div>
            </PageSection>

            <PageSection
              id="sc-home-cta"
              title="两个 CTA 按钮"
              description="首页首屏的主行动按钮，可分别配置文案与链接"
            >
              <div className="sc-form-grid">
                <Form.Item name="cta1_text" label="按钮 1 文案">
                  <Input maxLength={100} placeholder="Browse Products" />
                </Form.Item>
                <Form.Item name="cta1_url" label="按钮 1 链接">
                  <Input maxLength={500} placeholder="/products" />
                </Form.Item>
                <Form.Item name="cta2_text" label="按钮 2 文案">
                  <Input maxLength={100} placeholder="Get a Quote" />
                </Form.Item>
                <Form.Item name="cta2_url" label="按钮 2 链接">
                  <Input maxLength={500} placeholder="/contact" />
                </Form.Item>
              </div>
            </PageSection>

            <PageSection id="sc-home-factory" title="工厂介绍" description="首页工厂介绍板块正文">
              <Form.Item name="factory_intro" label="工厂介绍" style={{ marginBottom: 0 }}>
                <Input.TextArea
                  rows={6}
                  maxLength={2000}
                  className="sc-prose-editor"
                  placeholder="Our factory in Yiwu specializes in seamless knitting caps..."
                />
              </Form.Item>
            </PageSection>

            <PageSection
              id="sc-home-advantages"
              title="工厂优势"
              description="以卡片形式展示在首页，最多 12 项，按顺序排列"
            >
              <Form.List name="advantages">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field, index) => (
                      <div className="sc-list-item" key={field.key}>
                        <div className="sc-list-item__head">
                          <span className="sc-list-item__label">
                            <span className="sc-list-item__index">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            优势项
                          </span>
                          <Popconfirm
                            title="删除该优势项？"
                            description="保存后将从公开站首页移除"
                            okText="删除"
                            okButtonProps={{ danger: true }}
                            cancelText="取消"
                            onConfirm={() => remove(field.name)}
                          >
                            <Tooltip title="删除该优势项">
                              <Button
                                type="text"
                                size="small"
                                aria-label="删除该优势项"
                                icon={<DeleteOutlined />}
                              />
                            </Tooltip>
                          </Popconfirm>
                        </div>
                        <div className="sc-form-grid">
                          <Form.Item
                            name={[field.name, 'title']}
                            label="标题"
                            rules={[{ max: 200 }]}
                          >
                            <Input placeholder="e.g. True Seamless" maxLength={200} />
                          </Form.Item>
                          <Form.Item name={[field.name, 'image']} label="配图">
                            <MediaURLField placeholder="选图或留空" />
                          </Form.Item>
                          <Form.Item name={[field.name, 'desc']} label="描述" className="sc-span-2">
                            <Input.TextArea rows={2} placeholder="描述" maxLength={1000} />
                          </Form.Item>
                        </div>
                      </div>
                    ))}
                    <div className="sc-list-add">
                      <Button
                        block
                        type="dashed"
                        icon={<PlusOutlined />}
                        disabled={fields.length >= 12}
                        onClick={() => add()}
                      >
                        {fields.length >= 12 ? '已达 12 项上限' : '添加优势项'}
                      </Button>
                    </div>
                  </>
                )}
              </Form.List>
            </PageSection>

            <PageSection
              id="sc-home-process"
              title="工艺流程"
              description="从询价到交付的步骤说明，最多 12 项"
            >
              <Form.List name="process_steps">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field, index) => (
                      <div className="sc-list-item" key={field.key}>
                        <div className="sc-list-item__head">
                          <span className="sc-list-item__label">
                            <span className="sc-list-item__index">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            流程步骤
                          </span>
                          <Popconfirm
                            title="删除该流程步骤？"
                            description="保存后将从公开站首页移除"
                            okText="删除"
                            okButtonProps={{ danger: true }}
                            cancelText="取消"
                            onConfirm={() => remove(field.name)}
                          >
                            <Tooltip title="删除该流程步骤">
                              <Button
                                type="text"
                                size="small"
                                aria-label="删除该流程步骤"
                                icon={<DeleteOutlined />}
                              />
                            </Tooltip>
                          </Popconfirm>
                        </div>
                        <div className="sc-form-grid">
                          <Form.Item
                            name={[field.name, 'step']}
                            label="步骤"
                            rules={[{ max: 100 }]}
                          >
                            <Input placeholder="e.g. 01 Inquiry" maxLength={100} />
                          </Form.Item>
                          <Form.Item name={[field.name, 'desc']} label="说明">
                            <Input placeholder="说明" maxLength={500} />
                          </Form.Item>
                        </div>
                      </div>
                    ))}
                    <div className="sc-list-add">
                      <Button
                        block
                        type="dashed"
                        icon={<PlusOutlined />}
                        disabled={fields.length >= 12}
                        onClick={() => add()}
                      >
                        {fields.length >= 12 ? '已达 12 项上限' : '添加流程步骤'}
                      </Button>
                    </div>
                  </>
                )}
              </Form.List>
            </PageSection>

            <PageSection id="sc-home-contact" title="联系介绍" description="首页联系板块的引导文案">
              <Form.Item name="contact_blurb" label="联系板块文案" style={{ marginBottom: 0 }}>
                <Input.TextArea rows={3} maxLength={1000} />
              </Form.Item>
            </PageSection>

            <PageSection id="sc-home-footer" title="页脚" description="全站页脚文字">
              <Form.Item name="footer_text" label="页脚文案" style={{ marginBottom: 0 }}>
                <Input.TextArea
                  rows={2}
                  maxLength={500}
                  placeholder="© 2026 Yiwu Shirun Headwear. All rights reserved."
                />
              </Form.Item>
            </PageSection>

            <div className="sc-form-footer">
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={() => void submit()}
              >
                保存全部内容
              </Button>
            </div>
          </div>

          <aside className="sc-home-preview" aria-label="首屏预览">
            <div className="sc-home-preview__head">
              <span className="sc-home-preview__title">首屏预览</span>
              <span className="sc-home-preview__badge">跟随表单</span>
            </div>
            <div className="sc-home-preview__image">
              {previewMedia && !previewMedia.mime_type.startsWith('video') ? (
                <img src={previewMedia.url} alt={previewMedia.alt_text || '首屏背景图'} />
              ) : (
                <span className="sc-home-preview__image-empty">
                  <PictureOutlined /> 未选择背景图
                </span>
              )}
            </div>
            <div className="sc-home-preview__body">
              <div className="sc-home-preview__eyebrow">SeamCap</div>
              <p className="sc-home-preview__title-text">
                {heroTitle || '未填写主标题'}
              </p>
              <p className="sc-home-preview__subtitle">
                {heroSubtitle || '未填写副标题'}
              </p>
              <div className="sc-home-preview__actions">
                {cta1Text ? (
                  <span className="sc-home-preview__cta">{cta1Text}</span>
                ) : null}
                {cta2Text ? (
                  <span className="sc-home-preview__cta sc-home-preview__cta--ghost">
                    {cta2Text}
                  </span>
                ) : null}
                {!cta1Text && !cta2Text ? (
                  <span className="sc-helper">未配置 CTA 按钮</span>
                ) : null}
              </div>
              {heroVideo ? (
                <p className="sc-helper" style={{ marginTop: 10 }}>
                  已配置背景视频，公开站优先播放视频。
                </p>
              ) : null}
            </div>
            <div className="sc-home-preview__footer">{footerText || '未填写页脚文案'}</div>
          </aside>
        </div>
      </Form>
    </div>
  )
}
