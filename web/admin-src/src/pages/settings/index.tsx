import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, Tooltip } from 'antd'
import { DeleteOutlined, LinkOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import { get, put } from '../../api/client'
import MediaURLField from '../../components/MediaURLField'
import PageHeader from '../../components/PageHeader'
import PageLoading from '../../components/PageLoading'
import PageError from '../../components/PageError'

interface SocialRow {
  key: string
  value: string
}

const SOCIAL_PRESETS = ['linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'x']

// 站点设置：按信息关系分组（基本信息 / 联系方式 / 社交 / SEO）
export default function SettingsPage(): JSX.Element {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [social, setSocial] = useState<SocialRow[]>([])

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const { data } = await get<Record<string, string>>('/admin/settings')
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
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    void load()
  }, [load])

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
        const socialError = err.fields.social_links
        if (socialError) message.error(socialError)
        const normalFields = Object.entries(err.fields).filter(([k]) => k !== 'social_links')
        if (normalFields.length > 0) {
          form.setFields(normalFields.map(([name, errors]) => ({ name, errors: [errors] })))
        }
      } else if (err.message && err.message !== 'Validate failed') {
        message.error(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const header = (disabled = false): JSX.Element => (
    <PageHeader
      title="站点设置"
      description="维护站点名称、联系方式、社交链接与 SEO 默认值；保存后公开站立即使用新配置。"
      extra={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          disabled={disabled}
          onClick={() => void submit()}
        >
          保存设置
        </Button>
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
        <div className="sc-settings">
          <section className="sc-settings-section">
            <div>
              <h2 className="sc-settings-section__title">网站基本信息</h2>
              <p className="sc-settings-section__desc">
                站点名称会出现在公开站标题与页脚；Logo 用于品牌展示。
              </p>
            </div>
            <div className="sc-settings-section__body">
              <div className="sc-form-grid">
                <Form.Item name="site_name" label="站点名称">
                  <Input maxLength={500} placeholder="SeamCap" />
                </Form.Item>
                <Form.Item name="logo_url" label="Logo 图">
                  <MediaURLField placeholder="选图或手填 /uploads/... 或外链" />
                </Form.Item>
              </div>
            </div>
          </section>

          <section className="sc-settings-section">
            <div>
              <h2 className="sc-settings-section__title">联系方式</h2>
              <p className="sc-settings-section__desc">
                用于全站页脚、联系页与询价入口。WhatsApp 号码会自动规范化为 wa.me 链接。
              </p>
            </div>
            <div className="sc-settings-section__body">
              <div className="sc-form-grid">
                <Form.Item
                  name="whatsapp"
                  label="WhatsApp 号码"
                  extra="含国家码，如 +86 133 8861 4562"
                >
                  <Input placeholder="+86 133 8861 4562" />
                </Form.Item>
                <Form.Item name="whatsapp_text" label="WhatsApp 预填文案">
                  <Input
                    maxLength={500}
                    placeholder="Hello, I'd like to inquire about your caps."
                  />
                </Form.Item>
                <Form.Item name="email" label="邮箱">
                  <Input maxLength={200} placeholder="sales@yiwushirun.com" />
                </Form.Item>
                <Form.Item name="phone" label="电话">
                  <Input maxLength={50} />
                </Form.Item>
                <Form.Item name="address" label="地址" className="sc-span-2">
                  <Input maxLength={500} />
                </Form.Item>
                <Form.Item name="map_link" label="地图链接" className="sc-span-2">
                  <Input maxLength={1000} placeholder="Google Maps 链接" />
                </Form.Item>
              </div>
            </div>
          </section>

          <section className="sc-settings-section">
            <div>
              <h2 className="sc-settings-section__title">社交媒体</h2>
              <p className="sc-settings-section__desc">
                平台名与主页地址；公开站页脚按此顺序展示已配置的社交链接。
              </p>
            </div>
            <div className="sc-settings-section__body">
              {social.map((row, i) => (
                <div className="sc-kv-row" key={i}>
                  <Input
                    className="sc-kv-key"
                    placeholder="平台名"
                    value={row.key}
                    onChange={(e) =>
                      setSocial(
                        social.map((r, idx) => (idx === i ? { ...r, key: e.target.value } : r)),
                      )
                    }
                  />
                  <Input
                    className="sc-kv-url"
                    placeholder="https://..."
                    value={row.value}
                    onChange={(e) =>
                      setSocial(
                        social.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)),
                      )
                    }
                  />
                  <Tooltip title="删除该社交链接">
                    <Button
                      type="text"
                      className="sc-icon-btn"
                      aria-label="删除该社交链接"
                      icon={<DeleteOutlined />}
                      onClick={() => setSocial(social.filter((_, idx) => idx !== i))}
                    />
                  </Tooltip>
                </div>
              ))}
              <div className="sc-kv-add">
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => setSocial([...social, { key: '', value: '' }])}
                >
                  添加社交链接
                </Button>
                {SOCIAL_PRESETS.filter((p) => !social.some((r) => r.key === p)).length > 0 && (
                  <span className="sc-helper">
                    常用平台：
                    {SOCIAL_PRESETS.filter((p) => !social.some((r) => r.key === p)).join(' / ')}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="sc-settings-section">
            <div>
              <h2 className="sc-settings-section__title">SEO 默认值</h2>
              <p className="sc-settings-section__desc">
                未单独设置 SEO 的页面会回退到以下默认值。
              </p>
            </div>
            <div className="sc-settings-section__body">
              <Form.Item name="seo_title" label="全站默认 SEO 标题">
                <Input maxLength={200} />
              </Form.Item>
              <Form.Item name="seo_desc" label="全站默认 SEO 描述" style={{ marginBottom: 0 }}>
                <Input.TextArea rows={4} maxLength={500} />
              </Form.Item>
            </div>
          </section>

          <div className="sc-settings-save">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => void submit()}
            >
              保存设置
            </Button>
            <span className="sc-helper">
              <LinkOutlined style={{ marginRight: 5 }} />
              保存后公开站立即使用新配置
            </span>
          </div>
        </div>
      </Form>
    </div>
  )
}
