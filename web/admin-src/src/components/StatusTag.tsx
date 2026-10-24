import type { CraftStatus, InquiryStatus, ProductStatus } from '../api/types'

// 状态标签：颜色 + 文字双通道，统一高度/圆角/字号
function Status({ variant, children }: { variant: string; children: string }): JSX.Element {
  return <span className={`sc-status sc-status--${variant}`}>{children}</span>
}

export function ProductStatusTag({ status }: { status: ProductStatus }): JSX.Element {
  const map: Record<ProductStatus, { variant: string; text: string }> = {
    draft: { variant: 'draft', text: '草稿' },
    published: { variant: 'published', text: '已发布' },
    archived: { variant: 'archived', text: '已归档' },
  }
  const it = map[status] ?? { variant: 'default', text: status }
  return <Status variant={it.variant}>{it.text}</Status>
}

export function CraftStatusTag({ status }: { status: CraftStatus | string }): JSX.Element {
  const map: Record<string, { variant: string; text: string }> = {
    draft: { variant: 'draft', text: '草稿' },
    published: { variant: 'published', text: '已发布' },
    hidden: { variant: 'hidden', text: '已隐藏' },
  }
  const it = map[status] ?? { variant: 'default', text: status }
  return <Status variant={it.variant}>{it.text}</Status>
}

export function PageStatusTag({ status }: { status: 'draft' | 'published' }): JSX.Element {
  return status === 'published' ? (
    <Status variant="published">已发布</Status>
  ) : (
    <Status variant="draft">草稿</Status>
  )
}

export function CategoryStatusTag({ status }: { status: 'active' | 'inactive' }): JSX.Element {
  return status === 'active' ? (
    <Status variant="active">启用</Status>
  ) : (
    <Status variant="inactive">停用</Status>
  )
}

export function InquiryStatusTag({ status }: { status: InquiryStatus }): JSX.Element {
  const map: Record<InquiryStatus, { variant: string; text: string }> = {
    new: { variant: 'new', text: '新询价' },
    following: { variant: 'following', text: '跟进中' },
    replied: { variant: 'replied', text: '已回复' },
    completed: { variant: 'completed', text: '已完成' },
    spam: { variant: 'spam', text: '垃圾' },
  }
  const it = map[status] ?? { variant: 'default', text: status }
  return <Status variant={it.variant}>{it.text}</Status>
}

export function NotifyStatusTag({ status }: { status: string }): JSX.Element {
  const map: Record<string, { variant: string; text: string }> = {
    pending: { variant: 'pending', text: '待发送' },
    sent: { variant: 'sent', text: '已发送' },
    failed: { variant: 'failed', text: '发送失败' },
    skipped: { variant: 'skipped', text: '未启用' },
  }
  const it = map[status] ?? { variant: 'default', text: status }
  return <Status variant={it.variant}>{it.text}</Status>
}
