import { useState } from 'react'
import { Button, Input, Tooltip } from 'antd'
import { CloseOutlined, PictureOutlined } from '@ant-design/icons'
import type { Media } from '../api/types'
import MediaPicker from './MediaPicker'

// 表单字段：图片 URL 字符串（advantages.image / logo_url 等）
// 注意：不用 Space.Compact——compact 的 -1px 边框重叠在缩放渲染下会吃掉按钮边框，
// 改为带间隙的独立描边元素（.sc-url-field）
export default function MediaURLField(props: {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
}): JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="sc-url-field">
      <Button icon={<PictureOutlined />} onClick={() => setPickerOpen(true)}>
        选图
      </Button>
      <Input
        value={props.value ?? ''}
        onChange={(e) => props.onChange?.(e.target.value)}
        placeholder={props.placeholder || '选图或手填 /uploads/... 或外链'}
      />
      {props.value ? (
        <Tooltip title="清除图片">
          <Button
            icon={<CloseOutlined />}
            aria-label="清除图片"
            onClick={() => props.onChange?.('')}
          />
        </Tooltip>
      ) : null}
      <MediaPicker
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        onOk={(items: Media[]) => {
          setPickerOpen(false)
          if (items.length > 0) props.onChange?.(items[0].url)
        }}
      />
    </div>
  )
}
