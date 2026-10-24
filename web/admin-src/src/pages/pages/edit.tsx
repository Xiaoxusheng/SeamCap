import { useEffect, useState } from 'react'
import { App, Alert, Button, Card, Form, Input, Radio, Space, Spin, Tabs } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { get, put } from '../../api/client'
import type { PageContent } from '../../api/types'
import PageHeader from '../../components/PageHeader'

// 页面编辑：受控 HTML（Textarea + 沙箱预览）
export default function PageEdit(): JSX.Element {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState('')

  useEffect(() => {
    let alive = true
    get<PageContent>(`/admin/pages/${slug}`)
      .then(({ data: p }) => {
        if (!alive) return
        form.setFieldsValue({
          title: p.title,
          body: p.body,
          status: p.status,
          seo_title: p.seo_title,
          seo_desc: p.seo_desc,
        })
        setPreview(p.body)
      })
      .catch((e: Error) => message.error(e.message))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const submit = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await put(`/admin/pages/${slug}`, values)
      message.success('页面已保存')
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
        title={`编辑页面：${slug}`}
        description="内容为受控 HTML，服务端保存前执行白名单过滤"
        extra={
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/pages')}>
              返回列表
            </Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void submit()}>
              保存
            </Button>
          </>
        }
      />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="仅允许常规 HTML 标签；script / iframe / on* 事件属性 / javascript: 链接将被服务端过滤"
      />
      <Card>
        <Form form={form} layout="vertical" initialValues={{ status: 'draft' }}>
          <Space wrap size={16} align="start">
            <Form.Item name="title" label="标题 *" rules={[{ required: true, message: '请输入标题' }, { max: 200 }]} style={{ width: 360 }}>
              <Input maxLength={200} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Radio.Group
                options={[
                  { value: 'draft', label: '草稿' },
                  { value: 'published', label: '发布' },
                ]}
                optionType="button"
              />
            </Form.Item>
          </Space>
          <Tabs
            items={[
              {
                key: 'edit',
                label: 'HTML 编辑',
                children: (
                  <Form.Item
                    name="body"
                    label="页面内容（HTML）"
                    rules={[{ max: 500000 }]}
                    extra="支持 h2/h3/p/ul/li/img/a/strong/em/table 等；粘贴前请确认来源安全"
                  >
                    <Input.TextArea
                      rows={18}
                      style={{ fontFamily: 'Consolas, Menlo, monospace', fontSize: 13 }}
                      onChange={(e) => setPreview(e.target.value)}
                    />
                  </Form.Item>
                ),
              },
              {
                key: 'preview',
                label: '预览',
                children: (
                  <iframe
                    title="page-preview"
                    sandbox=""
                    srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px/1.7 -apple-system,'Segoe UI',Arial;max-width:720px;margin:24px auto;color:#202735}img{max-width:100%}</style></head><body>${preview}</body></html>`}
                    style={{ width: '100%', height: 460, border: '1px solid #E3E7ED', borderRadius: 8 }}
                  />
                ),
              },
            ]}
          />
          <Space wrap size={16}>
            <Form.Item name="seo_title" label="SEO 标题" style={{ width: 420 }}>
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
