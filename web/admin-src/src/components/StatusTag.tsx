import { Tag } from 'antd'
import type { InquiryStatus, ProductStatus } from '../api/types'

// 状态标签：色 + 文字双通道
export function ProductStatusTag({ status }: { status: ProductStatus }): JSX.Element {
  const map: Record<ProductStatus, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    published: { color: 'success', text: '已发布' },
    archived: { color: 'warning', text: '已归档' },
  }
  const it = map[status] ?? { color: 'default', text: status }
  return <Tag color={it.color}>{it.text}</Tag>
}

export function CraftStatusTag({ status }: { status: string }): JSX.Element {
  const map: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    published: { color: 'success', text: '已发布' },
    hidden: { color: 'warning', text: '已隐藏' },
  }
  const it = map[status] ?? { color: 'default', text: status }
  return <Tag color={it.color}>{it.text}</Tag>
}

export function InquiryStatusTag({ status }: { status: InquiryStatus }): JSX.Element {
  const map: Record<InquiryStatus, { color: string; text: string }> = {
    new: { color: 'processing', text: '新询价' },
    following: { color: 'warning', text: '跟进中' },
    replied: { color: 'cyan', text: '已回复' },
    completed: { color: 'success', text: '已完成' },
    spam: { color: 'error', text: '垃圾' },
  }
  const it = map[status] ?? { color: 'default', text: status }
  return <Tag color={it.color}>{it.text}</Tag>
}

export function NotifyStatusTag({ status }: { status: string }): JSX.Element {
  const map: Record<string, { color: string; text: string }> = {
    pending: { color: 'default', text: '待发送' },
    sent: { color: 'success', text: '已发送' },
    failed: { color: 'error', text: '发送失败' },
    skipped: { color: 'default', text: '未启用' },
  }
  const it = map[status] ?? { color: 'default', text: status }
  return <Tag color={it.color}>{it.text}</Tag>
}
