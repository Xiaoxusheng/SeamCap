import { useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Space, Spin } from 'antd'
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import { get, put } from '../../api/client'
import MediaURLField from '../../components/MediaURLField'
import PageHeader from '../../components/PageHeader'

interface SocialRow {
  key: string
  value: string
}

const SOCIAL_PRESETS = ['linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'x']

// 站点设置：基础 / 联系 / 社交链接（KV 编辑器）/ SEO
export default function SettingsPage(): JSX.Element {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [social, setSocial] = useState<SocialRow[]>([])

  useEffect(() => {
    let alive = true
    get<Record<string, string>>('/admin/settings')
      .then(({ data }) => {
        if (!alive) return
        form.setFieldsValue({
          site_name: data.site_name ?? '',
          logo_url: data.logo_url ?? '',
          whatsapp: data.whatsapp ?? '',
          whatsapp_text: data.whatsapp_text ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
          map_link: data.map_link ?? '',
          seo_title: data.seo_title ?? '',
          seo_desc: data.seo_desc ?? '',
        })
        try {
          const parsed = JSON.parse(data.social_links ?? '{}') as Record<string, string>
          setSocial(Object.entries(parsed).map(([k, v]) => ({ key: k, value: v })))
        } catch {
          setSocial([])
        }
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
      const socialObj: Record<string, string> = {}
      for (const row of social) {
        const k = row.key.trim()
        if (k) socialObj[k] = row.value.trim()
      }
      const payload: Record<string, string> = {
        site_name: values.site_name ?? '',
        logo_url: values.logo_url ?? '',
        whatsapp: values.whatsapp ?? '',
        whatsapp_text: values.whatsapp_text ?? '',
        email: values.email ?? '',
        phone: values.phone ?? '',
        address: values.address ?? '',
        map_link: values.map_link ?? '',
        social_links: JSON.stringify(socialObj),
        seo_title: values.seo_title ?? '',
        seo_desc: values.seo_desc ?? '',
      }
      await put('/admin/settings', payload)
      message.success('站点设置已保存')
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
        title="站点设置"
        description="联系方式与 WhatsApp 号码将用于全站联系入口（whatsapp_link 自动规范化为 wa.me 链接）"
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void submit()}>
            保存
          </Button>
        }
      />
      <Form form={form} layout="vertical">
        <Card size="small" title="基础" style={{ marginBottom: 16 }}>
          <Space wrap size={16} align="start">
            <Form.Item name="site_name" label="站点名称" style={{ width: 280 }}>
              <Input maxLength={500} placeholder="SeamCap" />
            </Form.Item>
            <Form.Item name="logo_url" label="Logo 图" style={{ minWidth: 380 }}>
              <MediaURLField placeholder="选图或手填 /uploads/... 或外链" />
            </Form.Item>
          </Space>
        </Card>

        <Card size="small" title="联系方式" style={{ marginBottom: 16 }}>
          <Space wrap size={16} align="start">
            <Form.Item
              name="whatsapp"
              label="WhatsApp 号码"
              style={{ width: 240 }}
              extra="含国家码，如 +86 133 8861 4562"
              rules={[{ required: false }]}
            >
              <Input placeholder="+86 133 8861 4562" />
            </Form.Item>
            <Form.Item name="whatsapp_text" label="WhatsApp 预填文案" style={{ width: 420 }}>
              <Input maxLength={500} placeholder="Hello, I'd like to inquire about your caps." />
            </Form.Item>
          </Space>
          <Space wrap size={16} align="start">
            <Form.Item name="email" label="邮箱" style={{ width: 280 }}>
              <Input maxLength={200} placeholder="sales@yiwushirun.com" />
            </Form.Item>
            <Form.Item name="phone" label="电话" style={{ width: 220 }}>
              <Input maxLength={50} />
            </Form.Item>
            <Form.Item name="address" label="地址" style={{ width: 420 }}>
              <Input maxLength={500} />
            </Form.Item>
          </Space>
          <Form.Item name="map_link" label="地图链接">
            <Input maxLength={1000} placeholder="Google Maps 链接" />
          </Form.Item>
        </Card>

        <Card size="small" title="社交链接" style={{ marginBottom: 16 }}>
          {social.map((row, i) => (
            <Space key={i} align="center" wrap size={8} style={{ display: 'flex', marginBottom: 8 }}>
              <Input
                style={{ width: 160 }}
                placeholder="平台名"
                value={row.key}
                onChange={(e) => setSocial(social.map((r, idx) => (idx === i ? { ...r, key: e.target.value } : r)))}
              />
              <Input
                style={{ width: 420 }}
                placeholder="https://..."
                value={row.value}
                onChange={(e) => setSocial(social.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)))}
              />
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setSocial(social.filter((_, idx) => idx !== i))} />
            </Space>
          ))}
          <Space>
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => setSocial([...social, { key: '', value: '' }])}>
              添加
            </Button>
            {SOCIAL_PRESETS.filter((p) => !social.some((r) => r.key === p)).length > 0 && (
              <span style={{ color: '#9299A5', fontSize: 12 }}>
                常用：{SOCIAL_PRESETS.filter((p) => !social.some((r) => r.key === p)).join(' / ')}
              </span>
            )}
          </Space>
        </Card>

        <Card size="small" title="SEO 默认值" style={{ marginBottom: 24 }}>
          <Form.Item name="seo_title" label="全站默认 SEO 标题" style={{ width: 500 }}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="seo_desc" label="全站默认 SEO 描述" style={{ width: 640, marginBottom: 0 }}>
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void submit()} style={{ minWidth: 120 }}>
            保存设置
          </Button>
        </div>
      </Form>
    </div>
  )
}
