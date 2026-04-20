# 前端 Props 契约 V1

本契约对应现有前端四板块的目标对接 schema。若现有代码中仍沿用 `activeTab`、`today_focus`、`due_soon` 等旧命名，可保留变量名，但值域和语义应迁移到这里定义的新板块契约。

## 1. 固定组件

这些组件在展开态下始终显示，不因当前板块切换而消失。

- `AssistantPanel`
- `PanelHeader`
- `SyncStatus`
- `OverviewCards`
- `TabBar`

## 2. 切换组件

这些组件根据 `activeBoard` 渲染。

- `PriorityContentView`
- `Within48hView`
- `TodoView`
- `IgnoreView`

## 3. 详情联动组件

当用户点击“查看原邮件”后显示。

- `MailInsightView`
- `InsightHeader`
- `InsightSummary`
- `InsightAction`
- `InsightDeadline`
- `InsightReasons`
- `InsightFeedback`

```ts
type BoardType = "priority_content" | "within_48h" | "todo" | "ignore"
type PriorityLevel = "high" | "medium" | "low" | "ignore"
type FeedbackAction = "more_important" | "show_less"
type ItemStatus = "pending" | "done"

type PanelMeta = {
  assistantName: string
  lastSyncedText: string
  lastSyncedAt?: string
}

type OverviewCounts = {
  priorityContentCount: number
  within48hCount: number
  todoCount: number
  ignoreCount: number
}

type MailListItem = {
  messageId: string
  threadId: string
  senderName: string
  senderEmail?: string
  subject: string
  summary?: string
  bodyExcerpt?: string
  timeText?: string
  timestamp?: string
  isUnread: boolean
  hasAttachment?: boolean
  labelIds?: string[]
  threadMessageCount?: number
  boardType: BoardType
  priorityLevel: PriorityLevel
  priorityScore: number
  sortScore: number
  shortSummary: string
  actionRequired: boolean
  actionLabel?: string
  deadlineText?: string
  deadlineTs?: string | null
  boardReasonText?: string
  priorityReasonTags: string[]
  featureHitTags?: string[]
  feedbackState?: {
    lastAction?: FeedbackAction
    moreImportantCount?: number
    showLessCount?: number
  }
  itemStatus: ItemStatus
}

type PriorityContentContent = {
  immediateAttentionItems: MailListItem[]
  worthReviewingItems: MailListItem[]
}

type Within48hContent = {
  readWithin48hItems: MailListItem[]
  handleWithin48hItems: MailListItem[]
}

type TodoSection = {
  sectionKey: string
  sectionTitle: string
  items: MailListItem[]
}

type TodoContent = {
  sections: TodoSection[]
}

type IgnoreContent = {
  items: MailListItem[]
}

type MailInsightDetail = {
  messageId: string
  threadId: string
  senderName: string
  senderEmail?: string
  subject: string
  boardType: BoardType
  priorityLevel: PriorityLevel
  priorityScore: number
  focusText: string
  suggestedAction?: string
  deadlineDisplay?: string
  reasonBullets: string[]
}

type AssistantPanelProps = {
  meta: PanelMeta
  overview: OverviewCounts
  activeBoard: BoardType
  isDetailMode: boolean
  onClose: () => void
  onBoardChange: (board: BoardType) => void
  onOverviewCardClick: (board: BoardType) => void
}

type PanelHeaderProps = {
  assistantName: string
  onClose: () => void
}

type SyncStatusProps = {
  lastSyncedText: string
}

type OverviewCardsProps = {
  overview: OverviewCounts
  activeBoard: BoardType
  onCardClick: (board: BoardType) => void
}

type TabBarProps = {
  activeBoard: BoardType
  onBoardChange: (board: BoardType) => void
}

type PriorityContentViewProps = {
  content: PriorityContentContent
  onOpenMail: (messageId: string) => void
  onFeedback: (messageId: string, action: FeedbackAction) => void
}

type Within48hViewProps = {
  content: Within48hContent
  onOpenMail: (messageId: string) => void
  onFeedback: (messageId: string, action: FeedbackAction) => void
}

type TodoViewProps = {
  content: TodoContent
  onOpenMail: (messageId: string) => void
  onMarkDone?: (messageId: string) => void
  onFeedback: (messageId: string, action: FeedbackAction) => void
}

type IgnoreViewProps = {
  content: IgnoreContent
  onOpenMail: (messageId: string) => void
  onFeedback: (messageId: string, action: FeedbackAction) => void
}

type MailCardProps = {
  item: MailListItem
  onOpenMail: (messageId: string) => void
  onMarkDone?: (messageId: string) => void
  onFeedback?: (messageId: string, action: FeedbackAction) => void
}

type MailInsightViewProps = {
  detail: MailInsightDetail
  onBack?: () => void
  onFeedback?: (messageId: string, action: FeedbackAction) => void
}
```

## 4. 渲染规则

### 展开态

展开态固定渲染：

- `PanelHeader`
- `SyncStatus`
- `OverviewCards`
- `TabBar`

展开态内容区按 `activeBoard` 切换：

- `priority_content` -> `PriorityContentView`
- `within_48h` -> `Within48hView`
- `todo` -> `TodoView`
- `ignore` -> `IgnoreView`

### 详情联动态

当用户点击“查看原邮件”后：

- 左侧 Gmail 打开原邮件
- 右侧切换为 `MailInsightView`

## 5. 事件流

- 用户点击顶部概览卡片 -> 触发 `onOverviewCardClick(board)` -> 更新 `activeBoard`
- 用户点击 Tab -> 触发 `onBoardChange(board)` -> 更新 `activeBoard`
- 用户点击“查看原邮件” -> 触发 `onOpenMail(messageId)` -> 进入详情联动态
- 用户点击“更重要 / 少显示” -> 触发 `onFeedback(messageId, action)` -> 记录反馈并等待下次重新分析
- 用户完成某项待处理 -> 触发 `onMarkDone(messageId)` -> 更新 `itemStatus` 并刷新 overview
