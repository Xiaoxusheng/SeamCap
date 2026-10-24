import { useCallback, useEffect, useState } from 'react'
import { App, Button, Input, Modal } from 'antd'
import { FileTextOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { fmtTime, get, put } from '../../api/client'
import type { PageContent } from '../../api/types'
import PageHeader from '../../components/PageHeader'
import PageError from '../../components/PageError'
import { PageStatusTag } from '../../components/StatusTag'
import EmptyState from '../../components/EmptyState'

// 页面管理：轻量 CMS 列表 + 新建（PUT upsert 语义）
export default function PageList(): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [list, setList] = useState<PageContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const { data } = await get<PageContent[]>('/admin/pages')
      setList(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const create = async (): Promise<void> => {
    const slug = newSlug.trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) {
      message.warning('Slug 仅允许小写字母 / 数字 / 连字符')
      return
    }
    setCreating(true)
    try {
      await put(`/admin/pages/${slug}`, { title: '未命名页面', body: '', status: 'draft' })
      message.success('页面已创建，请继续编辑')
      setCreateOpen(false)
      setNewSlug('')
      navigate(`/admin/pages/${slug}/edit`)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="页面管理"
        description="关于我们、隐私政策等独立页面；内容为受控 HTML，保存前由服务端白名单过滤。"
        extra={
          <>
            <span className="sc-toolbar__meta">共 {list.length} 个页面</span>
            <Button
              type="text"
              className="sc-icon-btn"
              aria-label="刷新列表"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => void load()}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新建页面
            </Button>
          </>
        }
      />

      {error ? (
        <PageError message={error} onRetry={() => void load()} />
      ) : loading && list.length === 0 ? (
        <div className="sc-cms-list" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="sc-cms-row" key={i}>
              <span className="sc-skeleton sc-skel-line" style={{ width: '42%' }} />
              <span className="sc-skeleton sc-skel-line" style={{ width: '70%' }} />
              <span className="sc-skeleton sc-skel-line" style={{ width: 50, height: 20 }} />
              <span className="sc-skeleton sc-skel-line" style={{ width: 84 }} />
              <span />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          className="sc-panel"
          icon={<FileTextOutlined />}
          title="还没有独立页面"
          description="创建关于我们、隐私政策或运输说明等页面，发布后即可在公开站访问。"
          action={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新建页面
            </Button>
          }
        />
      ) : (
        <div className="sc-cms-list">
          <div className="sc-cms-head" aria-hidden="true">
            <span>页面标题</span>
            <span>Slug</span>
            <span>状态</span>
            <span>更新时间</span>
            <span />
          </div>
          {list.map((p) => (
            <button
              type="button"
              className="sc-cms-row"
              key={p.id}
              onClick={() => navigate(`/admin/pages/${p.slug}/edit`)}
              aria-label={`编辑页面：${p.title}`}
            >
              <span className="sc-cms-row__title">{p.title}</span>
              <span className="sc-cms-row__slug">{p.slug}</span>
              <span className="sc-cms-row__status">
                <PageStatusTag status={p.status} />
              </span>
              <span className="sc-cms-row__time">{fmtTime(p.updated_at)}</span>
              <span className="sc-cms-row__arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
      )}

      <Modal
        title="新建页面"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void create()}
        confirmLoading={creating}
        okText="创建草稿"
        cancelText="取消"
        width={480}
      >
        <div style={{ marginTop: 8 }}>
          <label className="sc-field-label" htmlFor="new-page-slug">
            页面 Slug
          </label>
          <Input
            id="new-page-slug"
            placeholder="e.g. shipping-guide"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            onPressEnter={() => void create()}
            autoFocus
          />
          <p className="sc-helper" style={{ marginTop: 6 }}>
            仅小写字母 / 数字 / 连字符；创建后可在编辑页完善标题与内容
          </p>
        </div>
      </Modal>
    </div>
  )
}
