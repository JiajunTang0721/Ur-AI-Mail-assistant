import { useState } from 'react'
import { MailBundleCard } from './MailBundleCard'
import { MailCard } from './MailCard'
import { MailInsightView } from './MailInsightView'
import { SectionBlock } from './SectionBlock'
import { TAB_LABELS } from '../types'
import type {
  ExpandedPanelData,
  HistoryEntry,
  MailInsightDetail,
  MailListItem,
  SenderOption,
  TabKey,
} from '../types'

const CUSTOM_SENDER = '__custom_sender__'
const CUSTOM_FOCUS = '__custom_focus__'
const TAB_ORDER: TabKey[] = ['today_focus', 'todo', 'due_soon', 'ignorable']

type AssistantPanelProps = {
  panelData: ExpandedPanelData
  detail?: MailInsightDetail
  commonSenderOptions: SenderOption[]
  customSenderEntries: string[]
  selectedSenders: string[]
  customSenderValue: string
  senderHistory: HistoryEntry[]
  selectedFocuses: string[]
  customFocusValue: string
  focusOptions: string[]
  onClose: () => void
  onBackToList: () => void
  onTabChange: (tab: TabKey) => void
  onOpenMail: (messageId: string) => void
  onMarkDone: (messageId: string) => void
  onMuteSimilar: (messageId: string) => void
  onToggleSender: (sender: string) => void
  onCustomSenderChange: (value: string) => void
  onAddCustomSender: () => void
  onRemoveCustomSender: (value: string) => void
  onToggleFocus: (focus: string) => void
  onCustomFocusChange: (value: string) => void
  onFeedbackImportant: (messageId: string) => void
  onFeedbackNotImportant: (messageId: string) => void
  onFeedbackLess: (messageId: string) => void
}

type FilterSectionKey = 'senders' | 'history' | 'focus'

type RenderCard =
  | {
      kind: 'single'
      item: MailListItem
    }
  | {
      kind: 'bundle'
      key: string
      label: string
      items: MailListItem[]
    }

const buildVisibleCards = (items: MailListItem[]): RenderCard[] => {
  const groupedItems = new Map<string, MailListItem[]>()

  for (const item of items) {
    if (!item.aggregationKey) {
      continue
    }

    const current = groupedItems.get(item.aggregationKey) ?? []
    current.push(item)
    groupedItems.set(item.aggregationKey, current)
  }

  const cards: RenderCard[] = []
  const seenBundleKeys = new Set<string>()

  for (const item of items) {
    if (!item.aggregationKey) {
      cards.push({
        kind: 'single',
        item,
      })
      continue
    }

    if (seenBundleKeys.has(item.aggregationKey)) {
      continue
    }

    seenBundleKeys.add(item.aggregationKey)
    const bundleItems = groupedItems.get(item.aggregationKey) ?? [item]

    if (bundleItems.length === 1) {
      cards.push({
        kind: 'single',
        item,
      })
      continue
    }

    cards.push({
      kind: 'bundle',
      key: item.aggregationKey,
      label: item.aggregationLabel ?? '相似邮件',
      items: bundleItems,
    })
  }

  return cards
}

export function AssistantPanel({
  panelData,
  detail,
  commonSenderOptions,
  customSenderEntries,
  selectedSenders,
  customSenderValue,
  senderHistory,
  selectedFocuses,
  customFocusValue,
  focusOptions,
  onClose,
  onBackToList,
  onTabChange,
  onOpenMail,
  onMarkDone,
  onMuteSimilar,
  onToggleSender,
  onCustomSenderChange,
  onAddCustomSender,
  onRemoveCustomSender,
  onToggleFocus,
  onCustomFocusChange,
  onFeedbackImportant,
  onFeedbackNotImportant,
  onFeedbackLess,
}: AssistantPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<FilterSectionKey, boolean>>({
    senders: false,
    history: false,
    focus: false,
  })

  const syncText = (() => {
    if (!panelData.meta.lastSyncedAt) {
      return panelData.meta.lastSyncedText
    }

    const syncedAt = new Date(panelData.meta.lastSyncedAt)
    const hh = String(syncedAt.getHours()).padStart(2, '0')
    const mm = String(syncedAt.getMinutes()).padStart(2, '0')
    return `今天 ${hh}:${mm} 已同步`
  })()

  const toggleSection = (section: FilterSectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

  const configuredSenderCount = selectedSenders.filter((value) => value !== CUSTOM_SENDER).length
  const configuredFocusCount =
    selectedFocuses.filter((value) => value !== CUSTOM_FOCUS).length +
    (selectedFocuses.includes(CUSTOM_FOCUS) && customFocusValue.trim() ? 1 : 0)

  const senderSummary =
    configuredSenderCount > 0 ? `已设置 ${configuredSenderCount} 位` : '未设置'
  const historySummary =
    senderHistory.length > 0 ? `已记录 ${senderHistory.length} 位` : '暂无记录'
  const focusSummary =
    configuredFocusCount > 0 ? `已设置 ${configuredFocusCount} 项` : '未设置'

  const getVisibleCount = (items: MailListItem[]) => buildVisibleCards(items).length

  const getTabCount = (tab: TabKey) => {
    if (tab === 'today_focus') {
      return (
        getVisibleCount(panelData.todayFocus.mustHandleItems) +
        getVisibleCount(panelData.todayFocus.worthAttentionItems)
      )
    }

    if (tab === 'todo') {
      return panelData.todo.sections.reduce(
        (count, section) => count + getVisibleCount(section.items),
        0,
      )
    }

    if (tab === 'due_soon') {
      return (
        getVisibleCount(panelData.dueSoon.todayItems) +
        getVisibleCount(panelData.dueSoon.next48hItems) +
        getVisibleCount(panelData.dueSoon.thisWeekItems)
      )
    }

    return getVisibleCount(panelData.ignorable.ignorableItems)
  }

  const renderMailStack = (
    items: MailListItem[],
    options?: {
      allowMute?: boolean
    },
  ) => {
    const visibleCards = buildVisibleCards(items)

    if (visibleCards.length === 0) {
      return (
        <div className="empty-state compact">
          <strong>暂无内容</strong>
        </div>
      )
    }

    return (
      <div className="card-stack">
        {visibleCards.map((card) =>
          card.kind === 'single' ? (
            <MailCard
              item={card.item}
              key={card.item.messageId}
              onOpenMail={onOpenMail}
              onMarkDone={onMarkDone}
              onMuteSimilar={options?.allowMute ? onMuteSimilar : undefined}
            />
          ) : (
            <MailBundleCard
              items={card.items}
              key={card.key}
              label={card.label}
              onOpenMail={onOpenMail}
              onMuteSimilar={options?.allowMute ? onMuteSimilar : undefined}
            />
          ),
        )}
      </div>
    )
  }

  const renderTabBody = (tab: TabKey) => {
    if (tab === 'today_focus') {
      return (
        <>
          <SectionBlock
            title="必须处理"
            count={getVisibleCount(panelData.todayFocus.mustHandleItems)}
          >
            {renderMailStack(panelData.todayFocus.mustHandleItems)}
          </SectionBlock>

          <SectionBlock
            title="值得关注"
            count={getVisibleCount(panelData.todayFocus.worthAttentionItems)}
          >
            {renderMailStack(panelData.todayFocus.worthAttentionItems)}
          </SectionBlock>
        </>
      )
    }

    if (tab === 'todo') {
      return panelData.todo.sections.map((section) => (
        <SectionBlock
          title={section.sectionTitle}
          count={getVisibleCount(section.items)}
          key={section.sectionKey}
        >
          {renderMailStack(section.items)}
        </SectionBlock>
      ))
    }

    if (tab === 'due_soon') {
      return (
        <>
          <SectionBlock title="今天内到期" count={getVisibleCount(panelData.dueSoon.todayItems)}>
            {renderMailStack(panelData.dueSoon.todayItems)}
          </SectionBlock>
          <SectionBlock
            title="48 小时内到期"
            count={getVisibleCount(panelData.dueSoon.next48hItems)}
          >
            {renderMailStack(panelData.dueSoon.next48hItems)}
          </SectionBlock>
          <SectionBlock
            title="本周内到期"
            count={getVisibleCount(panelData.dueSoon.thisWeekItems)}
          >
            {renderMailStack(panelData.dueSoon.thisWeekItems)}
          </SectionBlock>
        </>
      )
    }

    return (
      <SectionBlock title="可忽略" count={getVisibleCount(panelData.ignorable.ignorableItems)}>
        {renderMailStack(panelData.ignorable.ignorableItems, { allowMute: true })}
      </SectionBlock>
    )
  }

  return (
    <div className="assistant-panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow quiet">邮件重点助手</p>
          <h2>{detail ? '当前邮件解读' : '帮你先看重要的'}</h2>
          <p className="panel-sync">{syncText}</p>
        </div>
        <button className="ghost-button small square" type="button" onClick={onClose}>
          ×
        </button>
      </header>

      {detail ? (
        <MailInsightView
          detail={detail}
          onBack={onBackToList}
          onMarkDone={onMarkDone}
          onFeedbackImportant={onFeedbackImportant}
          onFeedbackNotImportant={onFeedbackNotImportant}
          onFeedbackLess={onFeedbackLess}
        />
      ) : (
        <div className="assistant-body">
          <div className="filter-stack">
            <section className={`filter-card is-collapsible ${expandedSections.senders ? 'is-open' : ''}`}>
              <button
                aria-expanded={expandedSections.senders}
                className="filter-card-toggle"
                type="button"
                onClick={() => toggleSection('senders')}
              >
                <div className="filter-card-toggle-copy">
                  <strong>常看收件人</strong>
                  <span className="filter-card-summary">{senderSummary}</span>
                </div>
                <span className={`filter-card-arrow ${expandedSections.senders ? 'is-open' : ''}`}>
                  ▾
                </span>
              </button>

              <div className="filter-card-content">
                <div className="filter-card-body">
                  <div className="filter-choice-row">
                    {commonSenderOptions.map((option) => (
                      <label
                        className={`filter-check ${selectedSenders.includes(option.value) ? 'is-active' : ''}`}
                        key={option.value}
                      >
                        <input
                          checked={selectedSenders.includes(option.value)}
                          onChange={() => onToggleSender(option.value)}
                          type="checkbox"
                        />
                        <span>{option.label}</span>
                        <em>{option.count}</em>
                      </label>
                    ))}

                    <label
                      className={`filter-check custom ${selectedSenders.includes(CUSTOM_SENDER) ? 'is-active' : ''}`}
                    >
                      <input
                        checked={selectedSenders.includes(CUSTOM_SENDER)}
                        onChange={() => onToggleSender(CUSTOM_SENDER)}
                        type="checkbox"
                      />
                      <span>自定义</span>
                    </label>
                  </div>

                  {selectedSenders.includes(CUSTOM_SENDER) ? (
                    <div className="filter-input-row">
                      <input
                        className="filter-input"
                        onChange={(event) => onCustomSenderChange(event.target.value)}
                        placeholder="输入邮箱或发件人"
                        type="text"
                        value={customSenderValue}
                      />
                      <button className="secondary-button small" type="button" onClick={onAddCustomSender}>
                        添加
                      </button>
                    </div>
                  ) : null}

                  {customSenderEntries.length > 0 ? (
                    <div className="custom-chip-row">
                      {customSenderEntries.map((entry) => (
                        <div className="custom-chip" key={entry}>
                          <label
                            className={`filter-check inline ${selectedSenders.includes(entry) ? 'is-active' : ''}`}
                          >
                            <input
                              checked={selectedSenders.includes(entry)}
                              onChange={() => onToggleSender(entry)}
                              type="checkbox"
                            />
                            <span>{entry}</span>
                          </label>
                          <button
                            aria-label={`删除 ${entry}`}
                            className="chip-delete"
                            onClick={() => onRemoveCustomSender(entry)}
                            type="button"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className={`filter-card is-collapsible ${expandedSections.history ? 'is-open' : ''}`}>
              <button
                aria-expanded={expandedSections.history}
                className="filter-card-toggle"
                type="button"
                onClick={() => toggleSection('history')}
              >
                <div className="filter-card-toggle-copy">
                  <strong>历史数据追踪</strong>
                  <span className="filter-card-summary">{historySummary}</span>
                </div>
                <span className={`filter-card-arrow ${expandedSections.history ? 'is-open' : ''}`}>
                  ▾
                </span>
              </button>

              <div className="filter-card-content">
                <div className="filter-card-body">
                  {senderHistory.length > 0 ? (
                    <div className="history-list">
                      {senderHistory.map((entry, index) => (
                        <div className="history-item" key={entry.senderName}>
                          <span className="history-rank">#{index + 1}</span>
                          <span className="history-name">{entry.senderName}</span>
                          <span className="history-count">{entry.count} 次</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="history-empty">暂无记录</p>
                  )}
                </div>
              </div>
            </section>

            <section className={`filter-card is-collapsible ${expandedSections.focus ? 'is-open' : ''}`}>
              <button
                aria-expanded={expandedSections.focus}
                className="filter-card-toggle"
                type="button"
                onClick={() => toggleSection('focus')}
              >
                <div className="filter-card-toggle-copy">
                  <strong>我关注的</strong>
                  <span className="filter-card-summary">{focusSummary}</span>
                </div>
                <span className={`filter-card-arrow ${expandedSections.focus ? 'is-open' : ''}`}>
                  ▾
                </span>
              </button>

              <div className="filter-card-content">
                <div className="filter-card-body">
                  <div className="filter-choice-row">
                    {focusOptions.map((focus) => (
                      <label
                        className={`filter-check ${selectedFocuses.includes(focus) ? 'is-active' : ''}`}
                        key={focus}
                      >
                        <input
                          checked={selectedFocuses.includes(focus)}
                          onChange={() => onToggleFocus(focus)}
                          type="checkbox"
                        />
                        <span>{focus}</span>
                      </label>
                    ))}

                    <label
                      className={`filter-check custom ${selectedFocuses.includes(CUSTOM_FOCUS) ? 'is-active' : ''}`}
                    >
                      <input
                        checked={selectedFocuses.includes(CUSTOM_FOCUS)}
                        onChange={() => onToggleFocus(CUSTOM_FOCUS)}
                        type="checkbox"
                      />
                      <span>自定义</span>
                    </label>
                  </div>

                  {selectedFocuses.includes(CUSTOM_FOCUS) ? (
                    <input
                      className="filter-input"
                      onChange={(event) => onCustomFocusChange(event.target.value)}
                      placeholder="输入关键词"
                      type="text"
                      value={customFocusValue}
                    />
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          <div className="tab-nav compact" role="tablist" aria-label="邮件重点导航">
            {TAB_ORDER.map((tab) => (
              <button
                aria-selected={panelData.activeTab === tab}
                className={`tab-nav-button compact ${panelData.activeTab === tab ? 'is-active' : ''}`}
                key={tab}
                role="tab"
                type="button"
                onClick={() => onTabChange(tab)}
              >
                <span>{TAB_LABELS[tab]}</span>
                <strong>{getTabCount(tab)}</strong>
              </button>
            ))}
          </div>

          <section className="tab-panel" role="tabpanel" aria-label={TAB_LABELS[panelData.activeTab]}>
            <div className="tab-panel-body">{renderTabBody(panelData.activeTab)}</div>
          </section>
        </div>
      )}
    </div>
  )
}
