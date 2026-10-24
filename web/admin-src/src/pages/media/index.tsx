import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Empty, Input, Modal, Pagination, Popconfirm, Space, Spin, Upload } from 'antd'
import { CopyOutlined, DeleteOutlined, EditOutlined, InboxOutlined, PlayCircleFilled, SwapOutlined } from '@ant-design/icons'
import { ApiError, cacheMedia, fmtBytes, fmtTime, get, mediaFullURL, request } from '../../api/client'
import type { Media } from '../../api/types'
import PageHeader from '../../components/PageHeader'

// 媒体库：上传/搜索/预览/ALT/替换/删除（409 显示引用来源）
export default function MediaPage(): JSX.Element {
  const { message } = App.useApp()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<Media[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(0)

  const [preview, setPreview] = useState<Media | null>(null)
  const [altTarget, setAltTarget] = useState<Media | null>(null)
  const [altText, setAltText] = useState('')
  const [replaceTarget, setReplaceTarget] = useState<Media | null>(null)
  const [refBlock, setRefBlock] = useState<{ count: string; refs: string } | null>(null)

  const load = useCallback(async (query: string, p: number): Promise<void> => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), per_page: '24' })
      if (query) params.set('q', query)
      const { data, pagination } = await get<Media[]>('/admin/media?' + params.toString())
      cacheMedia(data)
      setList(data)
      setTotal(pagination?.total ?? 0)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load(q, page)
  }, [load, q, page])

  const doUpload = async (file: File): Promise<void> => {
    setUploading((n) => n + 1)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await request<Media>('/admin/media', { method: 'POST', body: fd })
      message.success(`已上传 ${data.original_name}`)
      setPage(1)
      void load(q, 1)
    } catch (e) {
      if (e instanceof ApiError && e.status === 413) message.error('文件超过大小限制')
      else message.error(`上传失败：${(e as Error).message}`)
    } finally {
      setUploading((n) => n - 1)
    }
  }

  const doReplace = async (file: File): Promise<void> => {
    if (!replaceTarget) return
    try {
      const fd = new FormData()
      fd.append('file', file)
      await request<Media>(`/admin/media/${replaceTarget.id}`, { method: 'PUT', body: fd })
      message.success(`已替换 ${replaceTarget.original_name}`)
      setReplaceTarget(null)
      void load(q, page)
    } catch (e) {
      message.error(`替换失败：${(e as Error).message}`)
    }
  }

  const saveAlt = async (): Promise<void> => {
    if (!altTarget) return
    try {
      await request<Media>(`/admin/media/${altTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt_text: altText }),
      })
      message.success('ALT 已更新')
      setAltTarget(null)
      void load(q, page)
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const remove = async (m: Media): Promise<void> => {
    try {
      await request(`/admin/media/${m.id}`, { method: 'DELETE' })
      message.success('已删除')
      void load(q, page)
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

  return (
    <div>
      <PageHeader
        title="媒体库"
        description="真实格式校验（magic number）· 图片≤10MB · 视频≤500MB · 上传重复内容自动去重"
      />
      <Card size="small" style={{ marginBottom: 16 }}>
        <Upload.Dragger
          multiple
          showUploadList={false}
          accept=".jpg,.jpeg,.png,.webp,.avif,.mp4"
          customRequest={({ file, onSuccess }) => {
            void doUpload(file as File).then(() => onSuccess?.(undefined as never))
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 13 }}>
            点击或拖拽文件到此处上传{uploading > 0 ? `（正在上传 ${uploading} 个…）` : ''}
          </p>
        </Upload.Dragger>
      </Card>
      <Card size="small">
        <Space style={{ marginBottom: 12 }}>
          <Input.Search
            placeholder="搜索文件名 / ALT"
            allowClear
            style={{ width: 260 }}
            onSearch={(v) => {
              setQ(v)
              setPage(1)
            }}
          />
          <span style={{ color: '#9299A5', fontSize: 12 }}>共 {total} 个文件</span>
        </Space>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin />
          </div>
        ) : list.length === 0 ? (
          <Empty description="暂无媒体文件" />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {list.map((m) => {
              const isVideo = m.mime_type.startsWith('video')
              return (
                <div
                  key={m.id}
                  style={{
                    width: 168,
                    border: '1px solid #E3E7ED',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: '#fff',
                  }}
                >
                  <div
                    style={{ height: 118, background: '#F1F3F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setPreview(m)}
                  >
                    {isVideo ? (
                      <PlayCircleFilled style={{ fontSize: 40, color: '#9299A5' }} />
                    ) : (
                      <img src={m.url} alt={m.alt_text} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ padding: 8 }}>
                    <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.original_name}>
                      {m.original_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9299A5', marginBottom: 6 }}>
                      {fmtBytes(m.size_bytes)} · {fmtTime(m.created_at)}
                    </div>
                    <Space size={0} wrap>
                      <Button size="small" type="text" icon={<CopyOutlined />} title="复制 URL" onClick={() => void copyURL(m)} />
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        title="编辑 ALT"
                        onClick={() => {
                          setAltTarget(m)
                          setAltText(m.alt_text)
                        }}
                      />
                      <Button size="small" type="text" icon={<SwapOutlined />} title="替换文件" onClick={() => setReplaceTarget(m)} />
                      <Popconfirm
                        title="删除该媒体？"
                        okText="删除"
                        okButtonProps={{ danger: true }}
                        cancelText="取消"
                        onConfirm={() => void remove(m)}
                      >
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} title="删除" />
                      </Popconfirm>
                    </Space>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {total > 24 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Pagination current={page} pageSize={24} total={total} onChange={(p) => setPage(p)} showSizeChanger={false} />
          </div>
        )}
      </Card>

      <Modal
        title={preview?.original_name}
        open={preview != null}
        footer={null}
        onCancel={() => setPreview(null)}
        width={preview?.mime_type.startsWith('video') ? 720 : 640}
      >
        {preview &&
          (preview.mime_type.startsWith('video') ? (
            <video src={preview.url} controls style={{ width: '100%' }} />
          ) : (
            <img src={preview.url} alt={preview.alt_text} style={{ width: '100%' }} />
          ))}
        {preview && (
          <div style={{ marginTop: 8, color: '#626C7B', fontSize: 12 }}>
            {preview.mime_type} · {fmtBytes(preview.size_bytes)}
            {preview.width ? ` · ${preview.width}×${preview.height}` : ''} · /uploads/{preview.filename}
          </div>
        )}
      </Modal>

      <Modal
        title={`编辑 ALT：${altTarget?.original_name ?? ''}`}
        open={altTarget != null}
        onCancel={() => setAltTarget(null)}
        onOk={() => void saveAlt()}
        okText="保存"
        cancelText="取消"
      >
        <Input.TextArea rows={3} value={altText} onChange={(e) => setAltText(e.target.value)} maxLength={500} placeholder="图片替代文本（SEO/无障碍）" />
      </Modal>

      <Modal
        title={`替换文件：${replaceTarget?.original_name ?? ''}`}
        open={replaceTarget != null}
        onCancel={() => setReplaceTarget(null)}
        footer={null}
      >
        <Upload.Dragger
          showUploadList={false}
          accept=".jpg,.jpeg,.png,.webp,.avif,.mp4"
          customRequest={({ file, onSuccess }) => {
            void doReplace(file as File).then(() => onSuccess?.(undefined as never))
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 13 }}>
            选择新文件（须与原文件同为 {replaceTarget?.mime_type ?? ''}）
          </p>
        </Upload.Dragger>
      </Modal>

      <Modal
        title="无法删除：媒体仍被引用"
        open={refBlock != null}
        onCancel={() => setRefBlock(null)}
        footer={<Button type="primary" onClick={() => setRefBlock(null)}>知道了</Button>}
      >
        <p>
          该媒体被 <strong>{refBlock?.count}</strong> 处引用，请先在对应位置移除引用：
        </p>
        <ul style={{ paddingLeft: 20, color: '#626C7B' }}>
          {(refBlock?.refs ?? '').split('; ').filter(Boolean).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
