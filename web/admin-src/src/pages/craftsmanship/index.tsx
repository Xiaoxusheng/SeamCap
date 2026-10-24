import { useCallback, useEffect, useState } from 'react'
import { App, Button, Popconfirm, Tooltip } from 'antd'
import { PlusOutlined, ReloadOutlined, ToolOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { del, get } from '../../api/client'
import type { Craftsmanship } from '../../api/types'
import { CraftStatusTag } from '../../components/StatusTag'
import PageHeader from '../../components/PageHeader'
import PageError from '../../components/PageError'
import EmptyState from '../../components/EmptyState'

function shortTime(s: string): string {
  const d = dayjs(s)
  return d.isValid() ? d.format('YYYY-MM-DD') : '—'
}

// 工艺列表：作品集卡片
export default function CraftList(): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [list, setList] = useState<Craftsmanship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const { data } = await get<Craftsmanship[]>('/admin/craftsmanship')
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

  const remove = async (c: Craftsmanship): Promise<void> => {
    try {
      await del(`/admin/craftsmanship/${c.id}`)
      message.success('工艺已删除')
      await load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="工艺管理"
        description="以作品集组织工厂工艺内容：封面、标题、摘要与发布状态。"
        extra={
          <>
            <span className="sc-toolbar__meta">共 {list.length} 篇</span>
            <Tooltip title="刷新列表">
              <Button
                type="text"
                className="sc-icon-btn"
                aria-label="刷新列表"
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void load()}
              />
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/admin/craftsmanship/new')}
            >
              新建工艺
            </Button>
          </>
        }
      />

      {error ? (
        <PageError message={error} onRetry={() => void load()} />
      ) : loading && list.length === 0 ? (
        <div className="sc-craft-grid" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="sc-craft-card" key={i}>
              <div className="sc-skeleton" style={{ aspectRatio: '16 / 10' }} />
              <div className="sc-craft-card__body">
                <div className="sc-skeleton sc-skel-line" style={{ width: '68%' }} />
                <div className="sc-skeleton sc-skel-line" style={{ width: '92%' }} />
                <div className="sc-skeleton sc-skel-line sc-skel-line--short" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          className="sc-panel"
          icon={<ToolOutlined />}
          title="还没有工艺内容"
          description="创建第一篇工艺内容，用封面和正文介绍工厂的工艺能力。"
          action={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/admin/craftsmanship/new')}
            >
              新建工艺
            </Button>
          }
        />
      ) : (
        <div className="sc-craft-grid">
          {list.map((c) => (
            <article className="sc-craft-card" key={c.id}>
              <div className="sc-craft-card__cover">
                {c.cover_image && !c.cover_image.mime_type.startsWith('video') ? (
                  <button
                    type="button"
                    className="sc-craft-card__cover-btn"
                    onClick={() => navigate(`/admin/craftsmanship/${c.id}/edit`)}
                    aria-label={`编辑工艺：${c.title}`}
                  >
                    <img src={c.cover_image.url} alt={`${c.title} 封面`} loading="lazy" />
                  </button>
                ) : (
                  <span className="sc-craft-card__cover-empty">
                    <ToolOutlined />
                    暂无封面
                  </span>
                )}
              </div>
              <div className="sc-craft-card__body">
                <button
                  type="button"
                  className="sc-craft-card__title"
                  onClick={() => navigate(`/admin/craftsmanship/${c.id}/edit`)}
                  title={c.title}
                >
                  {c.title}
                </button>
                <p className="sc-craft-card__summary">{c.summary || '未填写摘要'}</p>
                <div className="sc-craft-card__meta">
                  <CraftStatusTag status={c.status} />
                  <span>排序 {c.sort_order}</span>
                  <span aria-hidden="true">·</span>
                  <span className="sc-tabular">更新 {shortTime(c.updated_at)}</span>
                </div>
                <div className="sc-craft-card__foot">
                  <span className="sc-code">{c.slug || '未设置 slug'}</span>
                  <div className="sc-craft-card__actions">
                    <Button
                      type="link"
                      size="small"
                      onClick={() => navigate(`/admin/craftsmanship/${c.id}/edit`)}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title={`删除「${c.title}」？`}
                      description="删除后无法恢复"
                      okText="删除"
                      okButtonProps={{ danger: true }}
                      cancelText="取消"
                      onConfirm={() => remove(c)}
                    >
                      <Button type="text" size="small" danger>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
