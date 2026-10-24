import { useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Space, Spin } from 'antd'
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import { get, put } from '../../api/client'
import type { HomeContent } from '../../api/types'
import MediaIDField from '../../components/MediaIDField'
import MediaURLField from '../../components/MediaURLField'
import PageHeader from '../../components/PageHeader'

// 首页内容：Hero / CTA / 优势 / 流程 / 文案
export default function HomePage(): JSX.Element {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    get<HomeContent>('/admin/home')
      .then(({ data: h }) => {
        if (!alive) return
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
      })
      .catch((e: Error) => message.error(e.message))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        ...values,
        hero_image_id: values.hero_image_id ?? null,
        advantages: (values.advantages ?? []).map((a: { title?: string; desc?: string; image?: string }) => ({
          title: a.title ?? '',
          desc: a.desc ?? '',
          image: a.image ?? '',
        })),
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
        title="首页内容"
        description="控制公开站首页各板块文案与图片；保存后立即生效"
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void submit()}>
            保存
          </Button>
        }
      />
      <Form form={form} layout="vertical">
        <Card size="small" title="Hero 首屏" style={{ marginBottom: 16 }}>
          <Space wrap size={16} align="start">
            <Form.Item name="hero_title" label="主标题" style={{ width: 360 }}>
              <Input placeholder="Perfection has no seams." maxLength={200} />
            </Form.Item>
            <Form.Item name="hero_subtitle" label="副标题" style={{ width: 460 }}>
              <Input placeholder="Direct from our seamless cap factory in Yiwu" maxLength={300} />
            </Form.Item>
          </Space>
          <Space wrap size={16} align="start">
            <Form.Item name="hero_image_id" label="背景图">
              <MediaIDField />
            </Form.Item>
            <Form.Item name="hero_video_url" label="背景视频 URL" style={{ width: 420 }}>
              <Input maxLength={500} placeholder="留空则使用图片" />
            </Form.Item>
          </Space>
          <Space wrap size={16} align="start">
            <Form.Item name="cta1_text" label="按钮 1 文案" style={{ width: 180 }}>
              <Input maxLength={100} placeholder="Browse Products" />
            </Form.Item>
            <Form.Item name="cta1_url" label="按钮 1 链接" style={{ width: 280 }}>
              <Input maxLength={500} placeholder="/products" />
            </Form.Item>
            <Form.Item name="cta2_text" label="按钮 2 文案" style={{ width: 180 }}>
              <Input maxLength={100} placeholder="Get a Quote" />
            </Form.Item>
            <Form.Item name="cta2_url" label="按钮 2 链接" style={{ width: 280 }}>
              <Input maxLength={500} placeholder="/contact" />
            </Form.Item>
          </Space>
        </Card>

        <Card size="small" title="工厂介绍 / 联系文案" style={{ marginBottom: 16 }}>
          <Form.Item name="factory_intro" label="工厂介绍">
            <Input.TextArea rows={4} maxLength={2000} placeholder="Our factory in Yiwu specializes in seamless knitting caps..." />
          </Form.Item>
          <Form.Item name="contact_blurb" label="联系板块文案">
            <Input.TextArea rows={2} maxLength={1000} />
          </Form.Item>
        </Card>

        <Card size="small" title="四大优势（advantages，≤12 项）" style={{ marginBottom: 16 }}>
          <Form.List name="advantages">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="start" wrap size={12} style={{ display: 'flex', marginBottom: 4 }}>
                    <Form.Item name={[field.name, 'title']} rules={[{ max: 200 }]} style={{ width: 220, marginBottom: 8 }}>
                      <Input placeholder="标题 e.g. True Seamless" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'desc']} style={{ width: 380, marginBottom: 8 }}>
                      <Input placeholder="描述" maxLength={1000} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'image']} style={{ width: 360, marginBottom: 8 }}>
                      <MediaURLField placeholder="选图或留空" />
                    </Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} style={{ marginTop: 4 }} />
                  </Space>
                ))}
                {fields.length < 12 && (
                  <Button block type="dashed" icon={<PlusOutlined />} onClick={() => add()}>
                    添加优势项
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </Card>

        <Card size="small" title="合作流程（process_steps，≤12 项）" style={{ marginBottom: 16 }}>
          <Form.List name="process_steps">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="start" wrap size={12} style={{ display: 'flex', marginBottom: 4 }}>
                    <Form.Item name={[field.name, 'step']} rules={[{ max: 100 }]} style={{ width: 200, marginBottom: 8 }}>
                      <Input placeholder="步骤 e.g. 01 Inquiry" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'desc']} style={{ width: 560, marginBottom: 8 }}>
                      <Input placeholder="说明" maxLength={500} />
                    </Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} style={{ marginTop: 4 }} />
                  </Space>
                ))}
                {fields.length < 12 && (
                  <Button block type="dashed" icon={<PlusOutlined />} onClick={() => add()}>
                    添加流程步骤
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </Card>

        <Card size="small" title="页脚" style={{ marginBottom: 24 }}>
          <Form.Item name="footer_text" label="页脚文案" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={2} maxLength={500} placeholder="© 2026 Yiwu Shirun Headwear. All rights reserved." />
          </Form.Item>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void submit()} style={{ minWidth: 120 }}>
            保存全部
          </Button>
        </div>
      </Form>
    </div>
  )
}
