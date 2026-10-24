import { useCallback, useEffect, useState } from 'react'
import { App, Button, Empty, Form, Input, Radio } from 'antd'
import {
  InfoCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { get, put } from '../../api/client'
import type { PageContent } from '../../api/types'
import PageHeader from '../../components/PageHeader'
import PageSection from '../../components/PageSection'
import PageLoading from '../../components/PageLoading'
import PageError from '../../components/PageError'

// 页面编辑：受控 HTML 编辑器 + 沙箱预览
export default function PageEdit(): JSX.Element {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState('')
  const [pageTitle, setPageTitle] = useState('')

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const { data: p } = await get<PageContent>(`/admin/pages/${slug}`)
      setPageTitle(p.title)
      form.setFieldsValue({
        title: p.title,
        body: p.body,
        status: p.status,
        seo_title: p.seo_title,
        seo_desc: p.seo_desc,
      })
      setPreview(p.body)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [form, slug])

  useEffect(() => {
    void load()
  }, [load])

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

  const header = (): JSX.Element => (
    <PageHeader
      variant="editor"
      title={pageTitle || '编辑页面'}
      description={
        <>
          公开站路径 <span className="sc-code">/{slug}/</span> · 内容保存前由服务端执行白名单过滤
        </>
      }
      extra={
        loading || error ? undefined : (
          <>
            <Button onClick={() => navigate('/admin/pages')}>取消</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => void submit()}
            >
              保存页面
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

      <div className="sc-note">
        <InfoCircleOutlined />
        <span>
          仅允许常规 HTML 标签；script / iframe / on* 事件属性 / javascript: 链接将被服务端过滤。
          右侧预览运行在禁用脚本的沙箱中。
        </span>
      </div>

      <Form form={form} layout="vertical" initialValues={{ status: 'draft' }}>
        <PageSection title="页面信息" description="标题显示在公开站页面与浏览器标签中">
          <div className="sc-form-grid">
            <Form.Item
              name="title"
              label="标题"
              rules={[{ required: true, message: '请输入标题' }, { max: 200 }]}
            >
              <Input maxLength={200} />
            </Form.Item>
            <Form.Item name="status" label="发布状态">
              <Radio.Group>
                <Radio value="draft">草稿</Radio>
                <Radio value="published">发布</Radio>
              </Radio.Group>
            </Form.Item>
          </div>
        </PageSection>

        <div className="sc-editor-grid">
          <div className="sc-editor-pane">
            <PageSection
              title="HTML 内容"
              description="使用受控 HTML 编辑页面正文"
              extra={<span className="sc-toolbar__meta">{preview.length.toLocaleString()} 字符</span>}
            >
              <Form.Item
                name="body"
                label="页面内容（HTML）"
                rules={[{ max: 500000 }]}
                extra="支持 h2/h3/p/ul/li/img/a/strong/em/table 等；粘贴前请确认来源安全"
                style={{ marginBottom: 0 }}
              >
                <Input.TextArea
                  rows={22}
                  className="sc-code-editor"
                  onChange={(e) => setPreview(e.target.value)}
                />
              </Form.Item>
            </PageSection>
          </div>

          <div className="sc-editor-pane">
            <PageSection
              title="安全预览"
              description="沙箱 iframe 渲染，脚本不会执行"
              extra={<span className="sc-toolbar__meta">只读</span>}
            >
              {preview.trim() ? (
                <>
                  <iframe
                    title="页面预览"
                    sandbox=""
                    className="sc-preview-frame"
                    srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>
                      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',Arial,sans-serif;font-size:14px;line-height:1.75;max-width:720px;margin:24px auto;padding:0 16px;color:#20232c;background:#fff}
                      h1,h2,h3{line-height:1.35;color:#20232c}
                      h2{font-size:22px;margin:0 0 12px}
                      h3{font-size:17px;margin:20px 0 8px}
                      p{margin:0 0 12px}
                      ul,ol{padding-left:22px;margin:0 0 12px}
                      a{color:#199b78}
                      img{max-width:100%;height:auto;border-radius:6px}
                      table{width:100%;border-collapse:collapse}
                      th,td{border:1px solid #e4ece9;padding:8px 10px;text-align:left}
                    </style></head><body>${preview}</body></html>`}
                  />
                  <p className="sc-preview-note">
                    预览使用禁用脚本的沙箱，与公开站最终渲染可能存在细微样式差异。
                  </p>
                </>
              ) : (
                <div className="sc-preview-placeholder">
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="输入 HTML 后在此预览" />
                </div>
              )}
            </PageSection>
          </div>
        </div>

        <PageSection title="SEO" description="留空时使用页面标题">
          <div className="sc-form-grid">
            <Form.Item name="seo_title" label="SEO 标题" className="sc-span-2">
              <Input maxLength={200} />
            </Form.Item>
            <Form.Item name="seo_desc" label="SEO 描述" className="sc-span-2">
              <Input.TextArea rows={3} maxLength={500} />
            </Form.Item>
          </div>
        </PageSection>
      </Form>
    </div>
  )
}
