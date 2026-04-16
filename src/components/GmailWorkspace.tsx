import type { MailListItem, MailRecord } from '../types'

type GmailWorkspaceProps = {
  inboxItems: MailListItem[]
  selectedMail?: MailRecord
  onSelectMail: (messageId: string) => void
  onBackToInbox: () => void
}

const navItems = [
  ['收件箱', 12],
  ['星标邮件', 2],
  ['草稿箱', 1],
  ['已发送', 8],
  ['工作', 6],
]

export function GmailWorkspace({
  inboxItems,
  selectedMail,
  onSelectMail,
  onBackToInbox,
}: GmailWorkspaceProps) {
  return (
    <div className="gmail-shell">
      <aside className="gmail-sidebar">
        <div className="gmail-logo">
          <span className="gmail-logo-g">G</span>
          <span>mail</span>
        </div>

        <button className="compose-button" type="button">
          + 写信
        </button>

        <nav className="gmail-nav" aria-label="邮箱导航">
          {navItems.map(([label, count]) => (
            <button className="gmail-nav-item" key={label} type="button">
              <span>{label}</span>
              <span>{count}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="gmail-main">
        <div className="gmail-toolbar">
          <div className="search-pill">搜索邮件</div>
          <div className="toolbar-actions">
            <span>?</span>
            <span>⚙</span>
            <span>□</span>
          </div>
        </div>

        {selectedMail ? (
          <article className="mail-opened">
            <div className="mail-opened-header">
              <button className="ghost-button small" type="button" onClick={onBackToInbox}>
                返回收件箱
              </button>
              <div>
                <h2>{selectedMail.subject}</h2>
                <p>
                  {selectedMail.senderName}
                  {selectedMail.senderEmail ? ` · ${selectedMail.senderEmail}` : ''}
                </p>
              </div>
              <span className="mail-opened-time">{selectedMail.receivedAt}</span>
            </div>

            <div className="opened-hints">
              <span className="action-chip">{selectedMail.category ?? '普通邮件'}</span>
              {selectedMail.actionLabel ? (
                <span className="deadline-chip">{selectedMail.actionLabel}</span>
              ) : null}
            </div>

            <div className="mail-body">
              {selectedMail.bodyParagraphs.map((paragraph) => (
                <p key={`${selectedMail.messageId}-${paragraph}`}>{paragraph}</p>
              ))}
            </div>
          </article>
        ) : (
          <div className="mail-list-view">
            <div className="mail-list-toolbar">
              <span>全选</span>
              <span>刷新</span>
              <span>更多</span>
            </div>

            <div className="mail-list">
              {inboxItems.map((item) => (
                <button
                  className={`mail-row ${item.itemStatus === 'done' ? 'done' : ''}`}
                  key={item.messageId}
                  type="button"
                  onClick={() => onSelectMail(item.messageId)}
                >
                  <div className="mail-row-sender">{item.senderName}</div>
                  <div className="mail-row-body">
                    <strong>{item.subject}</strong>
                    <p>{item.shortSummary}</p>
                    <div className="mail-row-tags">
                      {item.actionLabel ? (
                        <span className="action-chip">{item.actionLabel}</span>
                      ) : null}
                      {item.deadlineText ? (
                        <span className="deadline-chip">{item.deadlineText}</span>
                      ) : null}
                      {item.itemStatus === 'done' ? <span className="done-pill">已处理</span> : null}
                    </div>
                  </div>
                  <div className="mail-row-time">{item.deadlineText ?? '昨天'}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
