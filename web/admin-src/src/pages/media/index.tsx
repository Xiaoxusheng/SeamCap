import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Tooltip,
  Upload,
} from 'antd'
import {
  CloudUploadOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleFilled,
  ReloadOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import {
  ApiError,
  cacheMedia,
  fmtBytes,
  fmtTime,
  get,
  mediaFullURL,
  request,
} from '../../api/client'
import type { Media } from '../../api/types'
import PageHeader from '../../components/PageHeader'
import PageError from '../../components/PageError'
import EmptyState from '../../components/EmptyState'

// 媒体库：紧凑上传条 / 素材网格 / 大图+侧栏预览 / ALT / 替换 / 删除
export default function MediaPage(): JSX.Element {
  const { message } = App.useApp()
  const [keyword, setKeyword] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<Media[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(0)

  const [preview, setPreview] = useState<Media | null>(null)
  const [altTarget, setAltTarget] = useState<Media | null>(null)
  const [altText, setAltText] = useState('')
  const [altSaving, setAltSaving] = useState(false)
  const [replaceTarget, setReplaceTarget] = useState<Media | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [refBlock, setRefBlock] = useState<{ count: string; refs: string } | null>(null)

  const load = useCallback(async (query: string, p: number): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(p), per_page: '24' })
      if (query) params.set('q', query)
      const { data, pagination } = await get<Media[]>('/admin/media?' + params.toString())
      cacheMedia(data)
      setList(data)
      setTotal(pagination?.total ?? 0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(q, page)
  }, [load, q, page])

  const doUpload = async (file: File): Promise<void> => {
    setUploading((n) => n + 1)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await request<Media>('/admin/media', { method: 'POST', body: fd })
      cacheMedia([data])
      message.success(`已上传 ${data.original_name}`)
      if (page !== 1) setPage(1)
      else await load(q, 1)
    } catch (e) {
      if (e instanceof ApiError && e.status === 413) message.error('文件超过大小限制')
      else message.error(`上传失败：${(e as Error).message}`)
    } finally {
      setUploading((n) => n - 1)
    }
  }

  const doReplace = async (file: File): Promise<void> => {
    if (!replaceTarget) return
    setReplacing(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await request<Media>(`/admin/media/${replaceTarget.id}`, { method: 'PUT', body: fd })
      message.success(`已替换 ${replaceTarget.original_name}`)
      setReplaceTarget(null)
      await load(q, page)
    } catch (e) {
      message.error(`替换失败：${(e as Error).message}`)
    } finally {
      setReplacing(false)
    }
  }

  const saveAlt = async (): Promise<void> => {
    if (!altTarget) return
    setAltSaving(true)
    try {
      await request<Media>(`/admin/media/${altTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt_text: altText }),
      })
      message.success('ALT 已更新')
      setAltTarget(null)
      await load(q, page)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setAltSaving(false)
    }
  }

  const remove = async (m: Media): Promise<void> => {
    try {
      await request(`/admin/media/${m.id}`, { method: 'DELETE' })
      message.success('已删除')
      if (preview?.id === m.id) setPreview(null)
      await load(q, page)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.fields) {
        setRefBlock({ count: e.fields.reference_count ?? '?', refs: e.fields.references ?? '' })
      } else {
        message.error((e as Error).message)
      }
    }
  }

  const copyURL = async (m: Media): Promise<void> => {
    try {
      await navigator.clipboard.writeText(mediaFullURL(m.url))
      message.success('URL 已复制')
    } catch {
      message.warning('复制失败，请手动复制：' + mediaFullURL(m.url))
    }
  }

  const openAlt = (m: Media): void => {
    setPreview(null)
    setAltTarget(m)
    setAltText(m.alt_text)
  }

  const openReplace = (m: Media): void => {
    setPreview(null)
    setReplaceTarget(m)
  }

  const formatLabel = (m: Media): string =>
    m.mime_type.split('/')[1]?.toUpperCase() ?? m.mime_type

  return (
    <div>
      <PageHeader
        title="媒体库"
        description="集中管理产品图、工艺图与视频素材；被引用的素材删除前需先移除引用。"
        extra={
          <>
            <span className="sc-toolbar__meta">共 {total} 个文件</span>
            <Tooltip title="刷新列表">
              <Button
                type="text"
                className="sc-icon-btn"
                aria-label="刷新列表"
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void load(q, page)}
              />
            </Tooltip>
          </>
        }
      />

      <div className="sc-upload-block">
        <Upload.Dragger
          multiple
          showUploadList={false}
          className="sc-upload-strip"
          accept=".jpg,.jpeg,.png,.webp,.avif,.mp4"
          customRequest={({ file, onSuccess }) => {
            void doUpload(file as File).then(() => onSuccess?.(undefined as never))
          }}
        >
          <span className="sc-upload-strip__icon" aria-hidden="true">
            <CloudUploadOutlined />
          </span>
          <span className="sc-upload-strip__text">
            <span className="sc-upload-strip__title">
              {uploading > 0 ? `正在上传 ${uploading} 个文件…` : '拖拽文件到此处上传'}
            </span>
            <span className="sc-upload-strip__hint">
              支持 JPG / PNG / WebP / AVIF / MP4 · 图片 ≤ 10MB · 视频 ≤ 500MB · 重复内容自动去重
            </span>
          </span>
          <span className="sc-upload-strip__action">选择文件</span>
        </Upload.Dragger>
      </div>

      <div className="sc-filterbar">
        <Input.Search
          className="sc-toolbar__search"
          placeholder="搜索文件名 / ALT"
          allowClear
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            if (e.target.value === '' && q !== '') {
              setQ('')
              setPage(1)
            }
          }}
          onSearch={(v) => {
            setQ(v.trim())
            setPage(1)
          }}
        />
        <div className="sc-toolbar__spacer" />
        <span className="sc-toolbar__meta">
          {q ? `搜索「${q}」· ` : ''}每页 24 个 · 图片与视频
        </span>
      </div>

      {error ? (
        <PageError message={error} onRetry={() => void load(q, page)} />
      ) : loading && list.length === 0 ? (
        <div className="sc-media-grid" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <div className="sc-media-card" key={i}>
              <div className="sc-skeleton sc-skel-media" />
              <div className="sc-media-card__info">
                <div className="sc-skeleton sc-skel-line" style={{ width: '78%' }} />
                <div className="sc-skeleton sc-skel-line" style={{ width: '52%', height: 10 }} />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          className="sc-panel"
          icon={<CloudUploadOutlined />}
          title={q ? '没有符合搜索条件的素材' : '还没有媒体文件'}
          description={
            q
              ? '尝试更换关键词，或清空搜索查看全部素材。'
              : '拖拽图片或视频到上方上传区域，或点击选择文件。'
          }
          action={
            q ? (
              <Button
                onClick={() => {
                  setKeyword('')
                  setQ('')
                  setPage(1)
                }}
              >
                清空搜索
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="sc-media-grid">
            {list.map((m) => {
              const isVideo = m.mime_type.startsWith('video')
              return (
                <article className="sc-media-card" key={m.id}>
                  <div className="sc-media-card__thumb">
                    {isVideo ? (
                      <div className="sc-media-card__video">
                        <PlayCircleFilled />
                      </div>
                    ) : (
                      <img src={m.url} alt={m.alt_text || m.original_name} loading="lazy" />
                    )}
                    <button
                      type="button"
                      className="sc-media-card__open"
                      aria-label={`预览 ${m.original_name}`}
                      onClick={() => setPreview(m)}
                    />
                    {isVideo && <span className="sc-media-card__badge">视频</span>}
                  </div>
                  <div className="sc-media-card__info">
                    <div className="sc-media-card__name" title={m.original_name}>
                      {m.original_name}
                    </div>
                    <div className="sc-media-card__meta">
                      {formatLabel(m)} · {fmtBytes(m.size_bytes)}
                      {m.width ? ` · ${m.width}×${m.height}` : ''}
                    </div>
                    <div className="sc-media-card__alt" title={m.alt_text || '未设置 ALT'}>
                      ALT：{m.alt_text || '未设置'}
                    </div>
                  </div>
                  <div className="sc-media-card__actions">
                    <Tooltip title="复制 URL">
                      <Button
                        type="text"
                        aria-label="复制 URL"
                        icon={<CopyOutlined />}
                        onClick={() => void copyURL(m)}
                      />
                    </Tooltip>
                    <Tooltip title="编辑 ALT">
                      <Button
                        type="text"
                        aria-label="编辑 ALT"
                        icon={<EditOutlined />}
                        onClick={() => openAlt(m)}
                      />
                    </Tooltip>
                    <Tooltip title="替换文件">
                      <Button
                        type="text"
                        aria-label="替换文件"
                        icon={<SwapOutlined />}
                        onClick={() => openReplace(m)}
                      />
                    </Tooltip>
                    <div className="sc-toolbar__spacer" />
                    <Popconfirm
                      title="删除该媒体？"
                      description="被引用的素材需先移除引用"
                      okText="删除"
                      okButtonProps={{ danger: true }}
                      cancelText="取消"
                      onConfirm={() => remove(m)}
                    >
                      <Tooltip title="删除">
                        <Button
                          type="text"
                          danger
                          className="sc-media-delete"
                          aria-label="删除"
                          icon={<DeleteOutlined />}
                        />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </article>
              )
            })}
          </div>

          {total > 24 && (
            <div className="sc-media-pagination">
              <Pagination
                current={page}
                pageSize={24}
                total={total}
                showSizeChanger={false}
                showTotal={(t) => `共 ${t} 个文件`}
                onChange={(p) => setPage(p)}
              />
            </div>
          )}
        </>
      )}

      <Modal
        title="素材预览"
        open={preview != null}
        footer={null}
        onCancel={() => setPreview(null)}
        width={1000}
        destroyOnHidden
      >
        {preview && (
          <div className="sc-media-preview">
            <div className="sc-media-preview__stage">
              {preview.mime_type.startsWith('video') ? (
                <video src={preview.url} controls playsInline />
              ) : (
                <img src={preview.url} alt={preview.alt_text || preview.original_name} />
              )}
            </div>
            <div className="sc-media-preview__side">
              <h3 className="sc-media-preview__name">{preview.original_name}</h3>
              <dl className="sc-meta-list">
                <div className="sc-meta-row">
                  <dt>类型</dt>
                  <dd className="sc-mono">{preview.mime_type}</dd>
                </div>
                <div className="sc-meta-row">
                  <dt>尺寸</dt>
                  <dd className="sc-mono">
                    {preview.width && preview.height
                      ? `${preview.width} × ${preview.height}`
                      : '—'}
                  </dd>
                </div>
                <div className="sc-meta-row">
                  <dt>体积</dt>
                  <dd className="sc-tabular">{fmtBytes(preview.size_bytes)}</dd>
                </div>
                <div className="sc-meta-row">
                  <dt>上传时间</dt>
                  <dd className="sc-tabular">{fmtTime(preview.created_at)}</dd>
                </div>
                <div className="sc-meta-row">
                  <dt>ALT</dt>
                  <dd>{preview.alt_text || '未设置'}</dd>
                </div>
              </dl>
              <div>
                <div className="sc-detail-field__label">访问地址</div>
                <div className="sc-media-preview__url">{mediaFullURL(preview.url)}</div>
              </div>
              <div className="sc-media-preview__actions">
                <Button icon={<CopyOutlined />} onClick={() => void copyURL(preview)}>
                  复制 URL
                </Button>
                <Button icon={<EditOutlined />} onClick={() => openAlt(preview)}>
                  编辑 ALT
                </Button>
                <Button icon={<SwapOutlined />} onClick={() => openReplace(preview)}>
                  替换
                </Button>
                <Popconfirm
                  title="删除该媒体？"
                  description="被引用的素材需先移除引用"
                  okText="删除"
                  okButtonProps={{ danger: true }}
                  cancelText="取消"
                  onConfirm={() => remove(preview)}
                >
                  <Button danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={`编辑 ALT：${altTarget?.original_name ?? ''}`}
        open={altTarget != null}
        onCancel={() => setAltTarget(null)}
        onOk={() => void saveAlt()}
        confirmLoading={altSaving}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <p className="sc-helper" style={{ marginBottom: 10 }}>
          替代文本用于 SEO 与无障碍阅读，请描述图片内容而非堆砌关键词。
        </p>
        <Input.TextArea
          rows={4}
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          maxLength={500}
          showCount
          placeholder="图片替代文本（SEO / 无障碍）"
          autoFocus
        />
      </Modal>

      <Modal
        title={`替换文件：${replaceTarget?.original_name ?? ''}`}
        open={replaceTarget != null}
        onCancel={() => setReplaceTarget(null)}
        footer={null}
        width={520}
      >
        <Upload.Dragger
          showUploadList={false}
          disabled={replacing}
          className="sc-upload-strip"
          accept=".jpg,.jpeg,.png,.webp,.avif,.mp4"
          customRequest={({ file, onSuccess }) => {
            void doReplace(file as File).then(() => onSuccess?.(undefined as never))
          }}
        >
          <span className="sc-upload-strip__icon" aria-hidden="true">
            <CloudUploadOutlined />
          </span>
          <span className="sc-upload-strip__text">
            <span className="sc-upload-strip__title">
              {replacing ? '正在替换…' : '选择新文件'}
            </span>
            <span className="sc-upload-strip__hint">
              须与原文件同为 {replaceTarget?.mime_type ?? ''}
            </span>
          </span>
        </Upload.Dragger>
      </Modal>

      <Modal
        title="无法删除：媒体仍被引用"
        open={refBlock != null}
        onCancel={() => setRefBlock(null)}
        footer={
          <Button type="primary" onClick={() => setRefBlock(null)}>
            知道了
          </Button>
        }
        width={500}
      >
        <p className="sc-helper" style={{ marginBottom: 10 }}>
          该媒体被 <strong>{refBlock?.count}</strong> 处引用，请先在对应位置移除引用：
        </p>
        <ul className="sc-ref-list">
          {(refBlock?.refs ?? '')
            .split('; ')
            .filter(Boolean)
            .map((r) => (
              <li key={r}>{r}</li>
            ))}
        </ul>
      </Modal>
    </div>
  )
}
