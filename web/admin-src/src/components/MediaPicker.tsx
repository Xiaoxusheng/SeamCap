import { useCallback, useEffect, useState } from 'react'
import { App, Button, Input, Modal, Pagination, Upload } from 'antd'
import { CheckCircleFilled, CloudUploadOutlined, PictureOutlined, PlayCircleFilled } from '@ant-design/icons'
import { cacheMedia, fmtBytes, request } from '../api/client'
import type { Media } from '../api/types'
import PageError from './PageError'
import EmptyState from './EmptyState'

interface Props {
  open: boolean
  multiple?: boolean
  onCancel: () => void
  onOk: (items: Media[]) => void
}

// 媒体选择器：搜索 + 上传 + 网格多选/单选
export default function MediaPicker({ open, multiple = false, onCancel, onOk }: Props): JSX.Element {
  const { message } = App.useApp()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<Media[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(0)
  const [selected, setSelected] = useState<Map<number, Media>>(new Map())

  const load = useCallback(async (query: string, p: number): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(p), per_page: '24' })
      if (query) params.set('q', query)
      const { data, pagination } = await request<Media[]>('/admin/media?' + params.toString())
      cacheMedia(data)
      setList(data)
      setTotal(pagination?.total ?? data.length)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setSelected(new Map())
      void load(q, page)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, page])

  const search = (): void => {
    setPage(1)
    void load(q, 1)
  }

  const toggle = (m: Media): void => {
    setSelected((prev) => {
      const next = new Map(prev)
      if (multiple) {
        if (next.has(m.id)) next.delete(m.id)
        else next.set(m.id, m)
      } else {
        next.clear()
        next.set(m.id, m)
      }
      return next
    })
  }

  const doUpload = async (file: File): Promise<void> => {
    setUploading((n) => n + 1)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await request<Media>('/admin/media', { method: 'POST', body: fd })
      cacheMedia([data])
      setList((prev) => [data, ...prev])
      setTotal((n) => n + 1)
      if (multiple) setSelected((prev) => new Map(prev).set(data.id, data))
      else setSelected(new Map([[data.id, data]]))
      message.success(`已上传 ${data.original_name}`)
    } catch (e) {
      message.error(`上传失败：${(e as Error).message}`)
    } finally {
      setUploading((n) => n - 1)
    }
  }

  return (
    <Modal
      title={multiple ? '选择媒体（可多选）' : '选择媒体'}
      open={open}
      width={900}
      onCancel={onCancel}
      destroyOnHidden
      footer={
        <div className="sc-picker-footer">
          <span className="sc-toolbar__meta">
            {selected.size > 0 ? `已选 ${selected.size} 个素材` : '尚未选择素材'}
          </span>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <Button onClick={onCancel}>取消</Button>
            <Button
              type="primary"
              disabled={selected.size === 0}
              onClick={() => onOk([...selected.values()])}
            >
              确定
            </Button>
          </span>
        </div>
      }
    >
      <Input.Search
        placeholder="搜索文件名 / ALT"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onSearch={search}
        allowClear
        style={{ marginBottom: 12 }}
      />
      <Upload.Dragger
        multiple
        showUploadList={false}
        className="sc-upload-strip sc-upload-strip--compact"
        customRequest={({ file, onSuccess }) => {
          void doUpload(file as File).then(() => onSuccess?.(undefined as never))
        }}
        accept=".jpg,.jpeg,.png,.webp,.avif,.mp4"
        style={{ marginBottom: 14 }}
      >
        <span className="sc-upload-strip__icon" aria-hidden="true">
          <CloudUploadOutlined />
        </span>
        <span className="sc-upload-strip__text">
          <span className="sc-upload-strip__title">
            {uploading > 0 ? `正在上传 ${uploading} 个文件…` : '拖拽或点击上传'}
          </span>
          <span className="sc-upload-strip__hint">图片 ≤ 10MB · 视频 ≤ 500MB</span>
        </span>
      </Upload.Dragger>

      <div className="sc-picker-scroll">
        {error ? (
          <PageError message={error} onRetry={() => void load(q, page)} />
        ) : loading && list.length === 0 ? (
          <div className="sc-picker-grid" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <div className="sc-picker-item" key={i}>
                <span className="sc-skeleton sc-skel-media" />
                <span className="sc-picker-item__info">
                  <span className="sc-skeleton sc-skel-line" style={{ width: '80%' }} />
                </span>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="sc-picker-empty">
            <EmptyState
              bare
              icon={<PictureOutlined />}
              title="暂无媒体"
              description="先在上方上传一个文件，再从这里选择。"
            />
          </div>
        ) : (
          <div className="sc-picker-grid">
            {list.map((m) => {
              const isVideo = m.mime_type.startsWith('video')
              const isSelected = selected.has(m.id)
              return (
                <button
                  type="button"
                  key={m.id}
                  className={`sc-picker-item${isSelected ? ' is-selected' : ''}`}
                  onClick={() => toggle(m)}
                  aria-pressed={isSelected}
                  aria-label={`选择 ${m.original_name}`}
                >
                  <span className="sc-picker-item__thumb">
                    {isVideo ? (
                      <span className="sc-picker-item__video">
                        <PlayCircleFilled />
                      </span>
                    ) : (
                      <img src={m.url} alt={m.alt_text || m.original_name} loading="lazy" />
                    )}
                    {isSelected && (
                      <span className="sc-picker-item__check">
                        <CheckCircleFilled />
                      </span>
                    )}
                  </span>
                  <span className="sc-picker-item__info">
                    <span className="sc-picker-item__name" title={m.original_name}>
                      {m.original_name}
                    </span>
                    <span className="sc-picker-item__meta">
                      {isVideo ? '视频' : '图片'} · {fmtBytes(m.size_bytes)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {total > 24 && (
        <div className="sc-picker-pagination">
          <Pagination
            size="small"
            current={page}
            pageSize={24}
            total={total}
            showSizeChanger={false}
            onChange={(p) => setPage(p)}
          />
        </div>
      )}
    </Modal>
  )
}
