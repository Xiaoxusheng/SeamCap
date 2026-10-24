import { useEffect, useState } from 'react'
import { Button, Card, Empty, Select, Space, App } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { fetchMedia } from '../api/client'
import type { Media, MediaLink } from '../api/types'
import MediaPicker from './MediaPicker'

// 画廊编辑器（受控）：value = MediaLink[]，支持增删/上下移排序/角色（可选）
export default function GalleryEditor(props: {
  value: MediaLink[]
  onChange: (v: MediaLink[]) => void
  withRole?: boolean
}): JSX.Element {
  const { message } = App.useApp()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [thumbs, setThumbs] = useState<Record<number, Media>>({})

  useEffect(() => {
    let alive = true
    for (const link of props.value) {
      if (!thumbs[link.media_id]) {
        void fetchMedia(link.media_id).then((m) => {
          if (alive && m) setThumbs((prev) => ({ ...prev, [m.id]: m }))
        })
      }
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value])

  const update = (next: MediaLink[]): void => {
    props.onChange(next.map((l, i) => ({ ...l, sort_order: i })))
  }

  const move = (index: number, dir: -1 | 1): void => {
    const next = [...props.value]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    update(next)
  }

  const setRole = (index: number, role: string): void => {
    const next = props.value.map((l, i) => (i === index ? { ...l, role } : l))
    if (role === 'main') {
      // 最多一个 main：其余降为 gallery
      const mainIdx = next.findIndex((l, i) => l.role === 'main' && i !== index)
      if (mainIdx >= 0) next[mainIdx] = { ...next[mainIdx], role: 'gallery' }
    }
    update(next)
  }

  const addItems = (items: Media[]): void => {
    setPickerOpen(false)
    const existing = new Set(props.value.map((l) => l.media_id))
    const add = items
      .filter((m) => !existing.has(m.id))
      .map((m, i) => ({ media_id: m.id, role: props.withRole ? 'gallery' : undefined, sort_order: props.value.length + i }))
    if (items.some((m) => existing.has(m.id))) message.info('部分图片已在画廊中，已跳过重复项')
    if (add.length > 0) update([...props.value, ...add])
  }

  return (
    <Card
      size="small"
      title={`画廊（${props.value.length} 张）`}
      extra={
        <Button icon={<PlusOutlined />} onClick={() => setPickerOpen(true)}>
          添加图片
        </Button>
      }
    >
      {props.value.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无画廊图片，点击右上角添加" />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {props.value.map((link, i) => {
            const m = thumbs[link.media_id]
            return (
              <div
                key={`${link.media_id}-${i}`}
                style={{
                  width: 150,
                  border: '1px solid #E3E7ED',
                  borderRadius: 8,
                  padding: 8,
                  background: '#fff',
                }}
              >
                <div style={{ height: 90, background: '#F1F3F6', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {m && !m.mime_type.startsWith('video') ? (
                    <img src={m.url} alt={m.alt_text} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: '#9299A5', fontSize: 12 }}>#{link.media_id}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'center' }}>
                  <Button size="small" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(i, -1)} />
                  <Button size="small" icon={<ArrowDownOutlined />} disabled={i === props.value.length - 1} onClick={() => move(i, 1)} />
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => update(props.value.filter((_, idx) => idx !== i))} />
                </div>
                {props.withRole && (
                  <Select
                    size="small"
                    value={link.role ?? 'gallery'}
                    onChange={(v) => setRole(i, v)}
                    style={{ width: '100%', marginTop: 6 }}
                    options={[
                      { value: 'main', label: '主图 (main)' },
                      { value: 'gallery', label: '画廊 (gallery)' },
                      { value: 'detail', label: '细节 (detail)' },
                    ]}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
      <MediaPicker open={pickerOpen} multiple onCancel={() => setPickerOpen(false)} onOk={addItems} />
      <Space />
    </Card>
  )
}
