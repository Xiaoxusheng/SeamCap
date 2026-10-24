import { useEffect, useState } from 'react'
import { App, Button, Select, Tooltip } from 'antd'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PictureOutlined,
  PlayCircleFilled,
  PlusOutlined,
} from '@ant-design/icons'
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
      .map((m, i) => ({
        media_id: m.id,
        role: props.withRole ? 'gallery' : undefined,
        sort_order: props.value.length + i,
      }))
    if (items.some((m) => existing.has(m.id))) message.info('部分图片已在画廊中，已跳过重复项')
    if (add.length > 0) update([...props.value, ...add])
  }

  return (
    <div className="sc-gallery-editor">
      <div className="sc-gallery-editor__head">
        <span className="sc-gallery-editor__title">画廊 · {props.value.length} 张</span>
        <Button size="small" icon={<PlusOutlined />} onClick={() => setPickerOpen(true)}>
          添加图片
        </Button>
      </div>

      {props.value.length === 0 ? (
        <div className="sc-gallery-empty">
          <PictureOutlined />
          <p className="sc-gallery-empty__text">暂无画廊图片，点击「添加图片」按顺序选择素材</p>
        </div>
      ) : (
        <div className="sc-gallery">
          {props.value.map((link, i) => {
            const m = thumbs[link.media_id]
            const isVideo = m?.mime_type.startsWith('video')
            const isMain = link.role === 'main'
            return (
              <div
                key={`${link.media_id}-${i}`}
                className={`sc-gallery__item${isMain ? ' is-main' : ''}`}
              >
                <div className="sc-gallery__thumb">
                  {m && !isVideo ? (
                    <img src={m.url} alt={m.alt_text || m.original_name} loading="lazy" />
                  ) : isVideo ? (
                    <span className="sc-gallery__placeholder">
                      <PlayCircleFilled />
                    </span>
                  ) : (
                    <span className="sc-gallery__placeholder">#{link.media_id}</span>
                  )}
                  <span className="sc-gallery__index">{i + 1}</span>
                  {isMain && <span className="sc-gallery__main">主图</span>}
                </div>
                <div className="sc-gallery__actions">
                  <Tooltip title="前移">
                    <Button
                      size="small"
                      aria-label="前移"
                      disabled={i === 0}
                      icon={<ArrowUpOutlined />}
                      onClick={() => move(i, -1)}
                    />
                  </Tooltip>
                  <Tooltip title="后移">
                    <Button
                      size="small"
                      aria-label="后移"
                      disabled={i === props.value.length - 1}
                      icon={<ArrowDownOutlined />}
                      onClick={() => move(i, 1)}
                    />
                  </Tooltip>
                  <span className="sc-toolbar__spacer" />
                  <Tooltip title="从画廊移除">
                    <Button
                      size="small"
                      danger
                      aria-label="从画廊移除"
                      icon={<DeleteOutlined />}
                      onClick={() => update(props.value.filter((_, idx) => idx !== i))}
                    />
                  </Tooltip>
                </div>
                {props.withRole && (
                  <div className="sc-gallery__role">
                    <Select
                      size="small"
                      value={link.role ?? 'gallery'}
                      onChange={(v) => setRole(i, v)}
                      style={{ width: '100%' }}
                      options={[
                        { value: 'main', label: '主图 (main)' },
                        { value: 'gallery', label: '画廊 (gallery)' },
                        { value: 'detail', label: '细节 (detail)' },
                      ]}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <MediaPicker
        open={pickerOpen}
        multiple
        onCancel={() => setPickerOpen(false)}
        onOk={addItems}
      />
    </div>
  )
}
