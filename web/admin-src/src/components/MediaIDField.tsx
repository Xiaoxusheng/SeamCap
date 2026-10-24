import { useEffect, useState } from 'react'
import { Button, Tooltip } from 'antd'
import { DeleteOutlined, PictureOutlined } from '@ant-design/icons'
import { cachedMedia, fetchMedia } from '../api/client'
import type { Media } from '../api/types'
import MediaPicker from './MediaPicker'
import MediaThumb from './MediaThumb'

// 表单字段：媒体 ID 单选（value = media_id），带缩略回显
export default function MediaIDField(props: {
  value?: number | null
  onChange?: (v: number | null) => void
}): JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [media, setMedia] = useState<Media | null>(() =>
    props.value ? cachedMedia(props.value) ?? null : null,
  )

  useEffect(() => {
    let alive = true
    if (props.value) {
      const hit = cachedMedia(props.value)
      if (hit) setMedia(hit)
      void fetchMedia(props.value).then((m) => {
        if (alive) setMedia(m)
      })
    } else {
      setMedia(null)
    }
    return () => {
      alive = false
    }
  }, [props.value])

  return (
    <div className="sc-media-field">
      {media ? (
        <span className="sc-media-field__preview">
          <MediaThumb media={media} alt={media.alt_text || media.original_name} />
          <span className="sc-media-field__name" title={media.original_name}>
            {media.original_name}
          </span>
        </span>
      ) : (
        <span className="sc-media-field__empty">
          <Button icon={<PictureOutlined />} onClick={() => setPickerOpen(true)}>
            选择媒体
          </Button>
        </span>
      )}
      {media && (
        <Button size="small" onClick={() => setPickerOpen(true)}>
          更换
        </Button>
      )}
      {props.value != null && (
        <Tooltip title="移除媒体">
          <Button
            type="text"
            className="sc-icon-btn"
            danger
            icon={<DeleteOutlined />}
            aria-label="移除媒体"
            onClick={() => props.onChange?.(null)}
          />
        </Tooltip>
      )}
      <MediaPicker
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        onOk={(items) => {
          setPickerOpen(false)
          if (items.length > 0) props.onChange?.(items[0].id)
        }}
      />
    </div>
  )
}
