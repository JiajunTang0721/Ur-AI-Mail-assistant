export type TabKey = 'today_focus' | 'todo' | 'due_soon' | 'ignorable'
export type Priority = 'high' | 'medium' | 'low'
export type ItemStatus = 'pending' | 'done'
export type OpenSource = 'panel' | 'workspace'

export type PanelMeta = {
  assistantName: string
  lastSyncedText: string
  lastSyncedAt?: string
}

export type OverviewCounts = {
  highPriorityCount: number
  todoCount: number
  dueSoon48hCount: number
  ignorableCount: number
}

export type MailListItem = {
  messageId: string
  threadId: string
  senderName: string
  senderEmail?: string
  subject: string
  shortSummary: string
  actionRequired: boolean
  actionLabel?: string
  deadlineText?: string
  deadlineTs?: string | null
  priority: Priority
  reasonTags: string[]
  itemStatus: ItemStatus
  aggregationKey?: string
  aggregationLabel?: string
}

export type TodayFocusContent = {
  mustHandleItems: MailListItem[]
  worthAttentionItems: MailListItem[]
}

export type TodoSection = {
  sectionKey: string
  sectionTitle: string
  items: MailListItem[]
}

export type TodoContent = {
  sections: TodoSection[]
}

export type DueSoonContent = {
  todayItems: MailListItem[]
  next48hItems: MailListItem[]
  thisWeekItems: MailListItem[]
}

export type IgnorableContent = {
  ignorableItems: MailListItem[]
}

export type MailInsightDetail = {
  messageId: string
  threadId: string
  senderName: string
  senderEmail?: string
  subject: string
  category?: string
  priority: Priority
  focusText: string
  suggestedAction?: string
  deadlineDisplay?: string
  reasonBullets: string[]
}

export type ExpandedPanelData = {
  meta: PanelMeta
  overview: OverviewCounts
  activeTab: TabKey
  todayFocus: TodayFocusContent
  todo: TodoContent
  dueSoon: DueSoonContent
  ignorable: IgnorableContent
}

export type MailRecord = MailListItem & {
  category?: string
  focusAreas: string[]
  focusText: string
  suggestedAction?: string
  deadlineDisplay?: string
  reasonBullets: string[]
  receivedAt: string
  previewLines: string[]
  bodyParagraphs: string[]
}

export type PanelFilters = {
  senderNames: string[]
  customSenderQuery?: string
  focusTopics: string[]
  customFocusQuery?: string
}

export type SenderOption = {
  value: string
  label: string
  count: number
}

export type HistoryEntry = {
  senderName: string
  count: number
}

export const TAB_LABELS: Record<TabKey, string> = {
  today_focus: '高优先级',
  todo: '待处理',
  due_soon: '48h 到期',
  ignorable: '可忽略',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高优',
  medium: '中优',
  low: '低优',
}
