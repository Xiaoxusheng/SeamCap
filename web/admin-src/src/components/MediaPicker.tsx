import { useCallback, useEffect, useState } from 'react'
import { App, Button, Empty, Input, Modal, Space, Spin, Upload } from 'antd'
import { InboxOutlined, PlayCircleFilled, ReloadOutlined } from '@ant-design/icons'
import { cacheMedia, fmtBytes, request } from '../api/client'
import type { Media } from '../api/types'

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
  const [uploading, setUploading] = useState(0)
  const [selected, setSelected] = useState<Map<number, Media>>(new Map())

  const load = useCallback(async (query: string, p: number): Promise<void> => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), per_page: '24' })
      if (query) params.set('q', query)
      const { data, pagination } = await request<Media[]>('/admin/media?' + params.toString())
      cacheMedia(data)
      setList(data)
      setTotal(pagination?.total ?? data.length)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [message])

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
      width={860}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" disabled={selected.size === 0} onClick={() => onOk([...selected.values()])}>
            确定{selected.size > 0 ? `（已选 ${selected.size}）` : ''}
          </Button>
        </Space>
      }
    >
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
        <Input
          placeholder="搜索文件名 / ALT"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onPressEnter={search}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={search}>
          搜索
        </Button>
      </Space.Compact>
      <Upload.Dragger
        multiple
        showUploadList={false}
        customRequest={({ file, onSuccess }) => {
          void doUpload(file as File).then(() => onSuccess?.(undefined as never))
        }}
        accept=".jpg,.jpeg,.png,.webp,.avif,.mp4"
        style={{ marginBottom: 12, padding: '4px 0' }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text" style={{ fontSize: 13 }}>
          点击或拖拽上传{uploading > 0 ? `（正在上传 ${uploading} 个…）` : ''} · 图片≤10MB 视频≤500MB
        </p>
      </Upload.Dragger>
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : list.length === 0 ? (
          <Empty description="暂无媒体，先上传一个" />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {list.map((m) => {
              const isVideo = m.mime_type.startsWith('video')
              const isSelected = selected.has(m.id)
              return (
                <div
                  key={m.id}
                  onClick={() => toggle(m)}
                  style={{
                    width: 124,
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #0369A1' : '1px solid #E3E7ED',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: '#fff',
                  }}
                >
                  <div style={{ height: 92, background: '#F1F3F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isVideo ? (
                      <PlayCircleFilled style={{ fontSize: 32, color: '#9299A5' }} />
                    ) : (
                      <img src={m.url} alt={m.alt_text} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.original_name}>
                      {m.original_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9299A5' }}>{fmtBytes(m.size_bytes)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {total > 24 && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button size="small" onClick={() => setPage((p) => p + 1)} disabled={list.length >= total}>
            加载更多（{list.length}/{total}）
          </Button>
        </div>
      )}
    </Modal>
  )
}
