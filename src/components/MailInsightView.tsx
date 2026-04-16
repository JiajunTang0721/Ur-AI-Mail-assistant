import { PRIORITY_LABELS } from '../types'
import type { MailInsightDetail } from '../types'

type MailInsightViewProps = {
  detail: MailInsightDetail
  onBack: () => void
  onMarkDone: (messageId: string) => void
  onFeedbackImportant: (messageId: string) => void
  onFeedbackNotImportant: (messageId: string) => void
  onFeedbackLess: (messageId: string) => void
}

export function MailInsightView({
  detail,
  onBack,
  onMarkDone,
  onFeedbackImportant,
  onFeedbackNotImportant,
  onFeedbackLess,
}: MailInsightViewProps) {
  return (
    <div className="insight-view">
      <button className="ghost-button small" type="button" onClick={onBack}>
        返回列表
      </button>

      <section className="insight-hero">
        <div className="insight-title-row">
          <div>
            <p className="eyebrow quiet">当前邮件解读</p>
            <h3>{detail.subject}</h3>
          </div>
          <span className={`priority-pill ${detail.priority}`}>
            {PRIORITY_LABELS[detail.priority]}
          </span>
        </div>
        <p className="insight-sender">
          {detail.senderName}
          {detail.senderEmail ? ` · ${detail.senderEmail}` : ''}
        </p>
      </section>

      <section className="insight-block">
        <h4>一句话重点</h4>
        <p>{detail.focusText}</p>
      </section>

      <section className="insight-block split">
        <div>
          <h4>建议动作</h4>
          <p>{detail.suggestedAction ?? '当前无需立即处理。'}</p>
        </div>
        <div>
          <h4>截止时间</h4>
          <p>{detail.deadlineDisplay ?? '暂未识别到明确截止时间。'}</p>
        </div>
      </section>

      <section className="insight-block">
        <h4>判断依据</h4>
        <ul className="reason-list">
          {detail.reasonBullets.map((reason) => (
            <li key={`${detail.messageId}-${reason}`}>{reason}</li>
          ))}
        </ul>
      </section>

      <section className="insight-block">
        <h4>快速反馈</h4>
        <div className="card-actions compact">
          <button className="secondary-button" type="button" onClick={() => onMarkDone(detail.messageId)}>
            标记已处理
          </button>
          <button className="ghost-button small" type="button" onClick={() => onFeedbackImportant(detail.messageId)}>
            这类更重要
          </button>
          <button className="ghost-button small" type="button" onClick={() => onFeedbackNotImportant(detail.messageId)}>
            这类不重要
          </button>
          <button className="ghost-button small" type="button" onClick={() => onFeedbackLess(detail.messageId)}>
            以后少提醒
          </button>
        </div>
      </section>
    </div>
  )
}
