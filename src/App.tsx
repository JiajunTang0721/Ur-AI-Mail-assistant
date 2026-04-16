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
const FOCUS_OPTIONS = ['鎷涜仒', '宸ヤ綔', '瀛︿笟']

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
    ? '鏀惰捣鎬?
    : selectedMessageId
      ? '璇︽儏鑱斿姩鎬?
      : '灞曞紑鎬?

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
    setFeedbackNote(`宸插皢鈥?{describeMail(messageId)}鈥濇爣璁颁负宸插鐞嗐€俙)
  }

  const handleMuteSimilar = (messageId: string) => {
    const mail = getMailRecord(messageId, statusMap)
    setFeedbackNote(`鍚庣画浼氬噺灏戔€?{mail?.senderName ?? '璇ユ潵婧?}鈥濊繖绫婚偖浠剁殑鎻愰啋棰戞銆俙)
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
          <p className="eyebrow">Mail assistant / Gmail Side Panel V1</p>
          <h1>閭欢閲嶇偣鍔╂墜</h1>
          <p className="story-summary">
            杩欐槸涓€鐗?Gmail 渚ц竟鍔╂墜婕旂ず锛岄噸鐐瑰睍绀哄父鐪嬫敹浠朵汉銆佸叧娉ㄤ富棰樸€侀偖浠朵紭鍏堢骇瀵艰埅鍜岀浉浼奸偖浠惰仛鍚堛€?            鍙充晶闈㈡澘鐜板湪鍙繚鐣欎竴濂楃畝娲佸鑸紝涓嶅啀閲嶅灞曠ず澶氫釜鍏ュ彛銆?          </p>
        </div>

        <div className="story-actions">
          <button className="ghost-button" type="button" onClick={handleResetDemo}>
            閲嶇疆婕旂ず
          </button>
          <div className="story-pills">
            <span className="story-pill strong">{surfaceState}</span>
            <span className="story-pill">楂樹紭鍏堢骇 {panelData.overview.highPriorityCount}</span>
            <span className="story-pill">寰呭鐞?{panelData.overview.todoCount}</span>
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
                  setFeedbackNote(`宸茶褰曪細鎻愰珮鈥?{describeMail(messageId)}鈥濊繖绫婚偖浠剁殑鎻愰啋鏉冮噸銆俙)
                }
                onFeedbackNotImportant={(messageId) =>
                  setFeedbackNote(`宸茶褰曪細闄嶄綆鈥?{describeMail(messageId)}鈥濊繖绫婚偖浠剁殑浼樺厛绾с€俙)
                }
                onFeedbackLess={(messageId) =>
                  setFeedbackNote(`宸茶褰曪細鍚庣画灏戞彁閱掍笌鈥?{describeMail(messageId)}鈥濈浉浼肩殑鍐呭銆俙)
                }
              />
            ) : (
              <button
                className="assistant-launcher"
                type="button"
                onClick={() => setIsExpanded(true)}
                aria-label="灞曞紑閭欢閲嶇偣鍔╂墜"
              >
                <span className="assistant-launcher-icon">AI</span>
                <span className="assistant-launcher-text">鍔╂墜</span>
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

