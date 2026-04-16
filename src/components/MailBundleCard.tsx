import { useState } from 'react'
import type { MailListItem, Priority } from '../types'

type MailBundleCardProps = {
  items: MailListItem[]
  label: string
  onOpenMail: (messageId: string) => void
  onMuteSimilar?: (messageId: string) => void
}

const priorityIconMap: Record<Priority, string> = {
  high: '✦',
  medium: '•',
  low: '○',
}

export function MailBundleCard({
  items,
  label,
  onOpenMail,
  onMuteSimilar,
}: MailBundleCardProps) {
  const [expanded, setExpanded] = useState(false)
  const leadItem = items[0]
  const previewItems = items.slice(0, 3)

  return (
    <article className="mail-card mail-bundle-card">
      <div className="mail-card-header">
        <div className="mail-card-title-group">
          <span className={`priority-dot ${leadItem.priority}`} aria-hidden="true">
            {priorityIconMap[leadItem.priority]}
          </span>
          <div className="mail-card-title-copy">
            <strong>{leadItem.senderName}</strong>
            <h4>{items.length} 封{label}已合并</h4>
          </div>
        </div>

        <span className="section-count">{items.length}</span>
      </div>

      <p className="mail-card-summary">
        同一发件人的相似邮件已合并展示，需要查看时再展开并选择具体邮件。
      </p>

      <div className="mail-card-strip">
        <span className="tag-chip">
          <span aria-hidden="true">+</span>
          <span>{label}</span>
        </span>
        <span className="deadline-chip">
          <span aria-hidden="true">↗</span>
          <span>按需展开</span>
        </span>
      </div>

      <div className="bundle-preview">
        {previewItems.map((item) => (
          <div className="bundle-preview-row" key={item.messageId}>
            <span className="bundle-preview-subject">{item.subject}</span>
            <span className="bundle-preview-time">{item.deadlineText ?? '最近'}</span>
          </div>
        ))}
        {items.length > previewItems.length ? (
          <div className="bundle-preview-row muted">
            <span className="bundle-preview-subject">还有 {items.length - previewItems.length} 封相似邮件</span>
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="bundle-list">
          {items.map((item) => (
            <div className="bundle-item" key={item.messageId}>
              <div className="bundle-item-copy">
                <strong>{item.subject}</strong>
                <span>{item.deadlineText ?? item.shortSummary}</span>
              </div>
              <button className="ghost-button small" type="button" onClick={() => onOpenMail(item.messageId)}>
                打开
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="card-actions">
        <button className="primary-button" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? '收起列表' : `查看 ${items.length} 封`}
        </button>

        {onMuteSimilar ? (
          <button className="ghost-button small" type="button" onClick={() => onMuteSimilar(leadItem.messageId)}>
            少提醒
          </button>
        ) : null}
      </div>
    </article>
  )
}
