import type { MailListItem, Priority } from '../types'

type MailCardProps = {
  item: MailListItem
  onOpenMail: (messageId: string) => void
  onMarkDone?: (messageId: string) => void
  onMuteSimilar?: (messageId: string) => void
}

const priorityIconMap: Record<Priority, string> = {
  high: '✦',
  medium: '•',
  low: '○',
}

const actionIconMap: Record<string, string> = {
  回复确认: '↗',
  报名: '+',
  提交材料: '↑',
  确认信息: '✓',
  审批: '✓',
  投票: '•',
  填表: '#',
}

const reasonIconMap: Record<string, string> = {
  招聘方: '@',
  需要回复: '↗',
  '48 小时内': '⏰',
  学校官方: '*',
  报名截止: '⏰',
  求职相关: '@',
  内部项目: '#',
  今晚截止: '⏰',
  需要提交: '↑',
  项目进度: '#',
  需知悉: 'i',
  签证相关: '!',
  本周截止: '⏰',
  财务流程: '$',
  需要审批: '✓',
  内部活动: '•',
  低成本待办: '·',
  行政流程: '#',
  需要填表: '#',
  职位推荐: '@',
  批量推送: '·',
  营销推广: '*',
  促销: '%',
  产品更新: '·',
  newsletter: '·',
  活动邀请: '*',
  泛社区: '·',
  周报: '·',
  资讯聚合: '·',
}

export function MailCard({
  item,
  onOpenMail,
  onMarkDone,
  onMuteSimilar,
}: MailCardProps) {
  const visibleTags = item.reasonTags.slice(0, 3)

  return (
    <article className={`mail-card ${item.itemStatus === 'done' ? 'done' : ''}`}>
      <div className="mail-card-header">
        <div className="mail-card-title-group">
          <span className={`priority-dot ${item.priority}`} aria-hidden="true">
            {priorityIconMap[item.priority]}
          </span>
          <div className="mail-card-title-copy">
            <strong>{item.senderName}</strong>
            <h4>{item.subject}</h4>
          </div>
        </div>

        <div className="mail-card-side">
          {item.deadlineText ? <span className="mail-card-time">{item.deadlineText}</span> : null}
          {item.itemStatus === 'done' ? <span className="done-pill compact">已</span> : null}
        </div>
      </div>

      <p className="mail-card-summary">{item.shortSummary}</p>

      <div className="mail-card-strip">
        {item.actionLabel ? (
          <span className="action-chip">
            <span aria-hidden="true">{actionIconMap[item.actionLabel] ?? '·'}</span>
            <span>{item.actionLabel}</span>
          </span>
        ) : null}
        {item.deadlineText ? (
          <span className="deadline-chip">
            <span aria-hidden="true">⏰</span>
            <span>{item.deadlineText}</span>
          </span>
        ) : null}
      </div>

      <div className="mail-card-tags">
        {visibleTags.map((tag) => (
          <span className="tag-chip" key={`${item.messageId}-${tag}`}>
            <span aria-hidden="true">{reasonIconMap[tag] ?? '·'}</span>
            <span>{tag}</span>
          </span>
        ))}
      </div>

      <div className="card-actions">
        <button className="primary-button" type="button" onClick={() => onOpenMail(item.messageId)}>
          查看原邮件
        </button>

        {onMarkDone && item.actionRequired && item.itemStatus === 'pending' ? (
          <button className="secondary-button" type="button" onClick={() => onMarkDone(item.messageId)}>
            标记已处理
          </button>
        ) : null}

        {onMuteSimilar ? (
          <button className="ghost-button small" type="button" onClick={() => onMuteSimilar(item.messageId)}>
            少提醒
          </button>
        ) : null}
      </div>
    </article>
  )
}
