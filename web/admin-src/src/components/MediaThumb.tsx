import { PictureOutlined, PlayCircleFilled } from '@ant-design/icons'
import type { Media } from '../api/types'

// 统一媒体缩略图：无图占位 / 视频标识 / 内容图片
export default function MediaThumb({
  media,
  alt,
  large = false,
}: {
  media?: Media | null
  alt?: string
  large?: boolean
}): JSX.Element {
  const className = large ? 'sc-thumb sc-thumb--lg' : 'sc-thumb'

  if (!media) {
    return (
      <span className={className} aria-hidden="true">
        <PictureOutlined />
      </span>
    )
  }

  if (media.mime_type.startsWith('video')) {
    return (
      <span className={`${className} sc-thumb--video`} aria-label={alt || media.original_name}>
        <PlayCircleFilled />
      </span>
    )
  }

  return (
    <span className={className}>
      <img src={media.url} alt={alt ?? media.alt_text ?? media.original_name} loading="lazy" />
    </span>
  )
}
