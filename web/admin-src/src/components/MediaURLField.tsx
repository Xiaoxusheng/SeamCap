import { useState } from 'react'
import { Button, Space, Typography } from 'antd'
import { LinkOutlined, PictureOutlined } from '@ant-design/icons'
import type { Media } from '../api/types'
import MediaPicker from './MediaPicker'

// 表单字段：图片 URL 字符串（advantages.image / logo_url 等）
export default function MediaURLField(props: {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
}): JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Button icon={<PictureOutlined />} onClick={() => setPickerOpen(true)}>
        选图
      </Button>
      <Typography.Text
        code
        style={{ flex: 1, padding: '4px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '30px' }}
      >
        {props.value || props.placeholder || '未选择（也可手填 /uploads/... 或外链）'}
      </Typography.Text>
      {props.value && (
        <Button icon={<LinkOutlined />} onClick={() => props.onChange?.('')} title="清除" />
      )}
      <MediaPicker
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        onOk={(items: Media[]) => {
          setPickerOpen(false)
          if (items.length > 0) props.onChange?.(items[0].url)
        }}
      />
    </Space.Compact>
  )
}
