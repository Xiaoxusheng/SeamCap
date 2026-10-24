import { useEffect, useState } from 'react'
import { Button, Space } from 'antd'
import { DeleteOutlined, PictureOutlined } from '@ant-design/icons'
import { fetchMedia } from '../api/client'
import type { Media } from '../api/types'
import MediaPicker from './MediaPicker'

// 表单字段：媒体 ID 单选（value = media_id），带缩略回显
export default function MediaIDField(props: {
  value?: number | null
  onChange?: (v: number | null) => void
}): JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [media, setMedia] = useState<Media | null>(null)

  useEffect(() => {
    let alive = true
    if (props.value) {
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
    <Space wrap>
      {media ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid #E3E7ED',
            borderRadius: 6,
            padding: 4,
          }}
        >
          {media.mime_type.startsWith('video') ? (
            <span style={{ width: 48, height: 48, background: '#F1F3F6', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <PictureOutlined style={{ fontSize: 20, color: '#9299A5' }} />
            </span>
          ) : (
            <img src={media.url} alt={media.alt_text} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
          )}
          <span style={{ fontSize: 12, color: '#626C7B', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {media.original_name}
          </span>
        </span>
      ) : (
        <Button icon={<PictureOutlined />} onClick={() => setPickerOpen(true)}>
          选择{props.value ? `（#${props.value}）` : '媒体'}
        </Button>
      )}
      {media && (
        <Button size="small" onClick={() => setPickerOpen(true)}>
          更换
        </Button>
      )}
      {props.value != null && (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => props.onChange?.(null)} />
      )}
      <MediaPicker
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        onOk={(items) => {
          setPickerOpen(false)
          if (items.length > 0) props.onChange?.(items[0].id)
        }}
      />
    </Space>
  )
}
