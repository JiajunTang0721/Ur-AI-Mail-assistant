import { useState } from 'react'
import './App.css'
import { AssistantPanel } from './components/AssistantPanel'
import { GmailWorkspace } from './components/GmailWorkspace'
import {
  buildPanelData,
  getFrequentSenderOptions,
  getInboxItems,
  getMailDetail,
  getMailRecord,
  getSenderHistoryEntries,
  initialStatusMap,
} from './data/mockData'
import type { ItemStatus, OpenSource, SenderOption, TabKey } from './types'

const DEFAULT_TAB: TabKey = 'today_focus'
const CUSTOM_SENDER = '__custom_sender__'
const CUSTOM_FOCUS = '__custom_focus__'
const FOCUS_OPTIONS = ['招聘', '工作', '学业']

function App() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>(DEFAULT_TAB)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [statusMap, setStatusMap] = useState<Record<string, ItemStatus>>({
    ...initialStatusMap,
  })
  const [feedbackNote, setFeedbackNote] = useState('')
  const [senderClickCounts, setSenderClickCounts] = useState<Record<string, number>>({})
  const [selectedSenders, setSelectedSenders] = useState<string[]>([])
  const [selectedFocuses, setSelectedFocuses] = useState<string[]>([])
  const [customSender, setCustomSender] = useState('')
  const [customFocus, setCustomFocus] = useState('')
  const [customSenderEntries, setCustomSenderEntries] = useState<string[]>([])

  const senderOptions = getFrequentSenderOptions(senderClickCounts)
  const senderHistory = getSenderHistoryEntries(senderClickCounts)
  const visibleSenderOptions: SenderOption[] = senderOptions
  const activeSenderFilters = selectedSenders.filter((value) => value !== CUSTOM_SENDER)
  const activeFocusFilters = selectedFocuses.filter((value) => value !== CUSTOM_FOCUS)

  const panelData = buildPanelData(statusMap, activeTab, {
    senderNames: activeSenderFilters,
    customSenderQuery: selectedSenders.includes(CUSTOM_SENDER) ? customSender : undefined,
    focusTopics: activeFocusFilters,
    customFocusQuery: selectedFocuses.includes(CUSTOM_FOCUS) ? customFocus : undefined,
  })

  const inboxItems = getInboxItems(statusMap)
  const selectedMail = selectedMessageId ? getMailRecord(selectedMessageId, statusMap) : undefined
  const selectedDetail = selectedMessageId
    ? getMailDetail(selectedMessageId, statusMap)
    : undefined

  const surfaceState = !isExpanded
    ? '收起态'
    : selectedMessageId
      ? '详情联动态'
      : '展开态'

  const toggleSelection = (
    value: string,
    currentValues: string[],
    setValues: (updater: string[]) => void,
  ) => {
    if (currentValues.includes(value)) {
      setValues(currentValues.filter((item) => item !== value))
      return
    }

    setValues([...currentValues, value])
  }

  const describeMail = (messageId: string) => {
    const record = getMailRecord(messageId, statusMap)
    return record?.subject ?? messageId
  }

  const handleOpenMail = (messageId: string, source: OpenSource) => {
    if (source === 'panel') {
      const record = getMailRecord(messageId, statusMap)

      if (record) {
        setSenderClickCounts((current) => ({
          ...current,
          [record.senderName]: (current[record.senderName] ?? 0) + 1,
        }))
      }
    }

    setSelectedMessageId(messageId)
    setIsExpanded(true)
  }

  const handleMarkDone = (messageId: string) => {
    setStatusMap((current) => ({
      ...current,
      [messageId]: 'done',
    }))
    setFeedbackNote(`已将“${describeMail(messageId)}”标记为已处理。`)
  }

  const handleMuteSimilar = (messageId: string) => {
    const mail = getMailRecord(messageId, statusMap)
    setFeedbackNote(`后续会减少“${mail?.senderName ?? '该来源'}”这类邮件的提醒频次。`)
  }

  const handleResetDemo = () => {
    setStatusMap({ ...initialStatusMap })
    setSelectedMessageId(null)
    setActiveTab(DEFAULT_TAB)
    setIsExpanded(true)
    setFeedbackNote('')
    setSenderClickCounts({})
    setSelectedSenders([])
    setSelectedFocuses([])
    setCustomSender('')
    setCustomFocus('')
    setCustomSenderEntries([])
  }

  const handleAddCustomSender = () => {
    const value = customSender.trim()

    if (!value) {
      return
    }

    if (!customSenderEntries.includes(value)) {
      setCustomSenderEntries((current) => [...current, value])
    }

    if (!selectedSenders.includes(value)) {
      setSelectedSenders((current) => [...current.filter((item) => item !== CUSTOM_SENDER), value])
    }

    setCustomSender('')
  }

  const handleRemoveCustomSender = (value: string) => {
    setCustomSenderEntries((current) => current.filter((item) => item !== value))
    setSelectedSenders((current) => current.filter((item) => item !== value))
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" aria-hidden="true"></div>
      <div className="ambient ambient-right" aria-hidden="true"></div>

      <header className="story-header">
        <div className="story-copy">
          <p className="eyebrow">Lark Mail Assistant / Gmail Side Panel V1</p>
          <h1>邮件重点助手</h1>
          <p className="story-summary">
            这是一版 Gmail 侧边助手演示，重点展示常看收件人、关注主题、邮件优先级导航和相似邮件聚合。
            右侧面板现在只保留一套简洁导航，不再重复展示多个入口。
          </p>
        </div>

        <div className="story-actions">
          <button className="ghost-button" type="button" onClick={handleResetDemo}>
            重置演示
          </button>
          <div className="story-pills">
            <span className="story-pill strong">{surfaceState}</span>
            <span className="story-pill">高优先级 {panelData.overview.highPriorityCount}</span>
            <span className="story-pill">待处理 {panelData.overview.todoCount}</span>
          </div>
        </div>
      </header>

      {feedbackNote ? <div className="note-banner">{feedbackNote}</div> : null}

      <section className="browser-shell">
        <div className="browser-topbar">
          <div className="window-dots" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="browser-tab">mail.google.com/mail/u/0/#inbox</div>
          <div className="browser-avatar">JJ</div>
        </div>

        <div className={`workspace-layout ${isExpanded ? 'panel-open' : 'panel-collapsed'}`}>
          <GmailWorkspace
            inboxItems={inboxItems}
            selectedMail={selectedMail}
            onSelectMail={(messageId) => handleOpenMail(messageId, 'workspace')}
            onBackToInbox={() => setSelectedMessageId(null)}
          />

          <aside className={`assistant-rail ${isExpanded ? 'is-open' : 'is-closed'}`}>
            {isExpanded ? (
              <AssistantPanel
                panelData={panelData}
                detail={selectedDetail}
                commonSenderOptions={visibleSenderOptions}
                customSenderEntries={customSenderEntries}
                selectedSenders={selectedSenders}
                customSenderValue={customSender}
                senderHistory={senderHistory}
                selectedFocuses={selectedFocuses}
                customFocusValue={customFocus}
                focusOptions={FOCUS_OPTIONS}
                onClose={() => setIsExpanded(false)}
                onBackToList={() => setSelectedMessageId(null)}
                onTabChange={(tab) => setActiveTab(tab)}
                onOpenMail={(messageId) => handleOpenMail(messageId, 'panel')}
                onMarkDone={handleMarkDone}
                onMuteSimilar={handleMuteSimilar}
                onToggleSender={(sender) =>
                  toggleSelection(sender, selectedSenders, setSelectedSenders)
                }
                onCustomSenderChange={setCustomSender}
                onAddCustomSender={handleAddCustomSender}
                onRemoveCustomSender={handleRemoveCustomSender}
                onToggleFocus={(focus) =>
                  toggleSelection(focus, selectedFocuses, setSelectedFocuses)
                }
                onCustomFocusChange={setCustomFocus}
                onFeedbackImportant={(messageId) =>
                  setFeedbackNote(`已记录：提高“${describeMail(messageId)}”这类邮件的提醒权重。`)
                }
                onFeedbackNotImportant={(messageId) =>
                  setFeedbackNote(`已记录：降低“${describeMail(messageId)}”这类邮件的优先级。`)
                }
                onFeedbackLess={(messageId) =>
                  setFeedbackNote(`已记录：后续少提醒与“${describeMail(messageId)}”相似的内容。`)
                }
              />
            ) : (
              <button
                className="assistant-launcher"
                type="button"
                onClick={() => setIsExpanded(true)}
                aria-label="展开邮件重点助手"
              >
                <span className="assistant-launcher-icon">AI</span>
                <span className="assistant-launcher-text">助手</span>
                <span className="assistant-launcher-count">
                  {panelData.overview.highPriorityCount}
                </span>
              </button>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}

export default App
