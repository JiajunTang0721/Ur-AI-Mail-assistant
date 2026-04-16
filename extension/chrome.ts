export const GMAIL_INBOX_URL = 'https://mail.google.com/mail/u/0/#inbox'
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
export const API_BASE_URL = import.meta.env.VITE_LMA_API_BASE_URL ?? 'http://127.0.0.1:8010'

export type BoardType = 'priority_content' | 'within_48h' | 'todo' | 'ignore'
export type PriorityLevel = 'high' | 'medium' | 'low' | 'ignore'
export type FeedbackAction = 'more_important' | 'show_less'

export type SenderHistoryEntry = {
  senderName: string
  count: number
}

export type FeedbackHistoryEntry = {
  messageId?: string
  threadId?: string | null
  senderName?: string
  senderEmail?: string | null
  subject?: string
  feedbackAction: FeedbackAction
  boardType?: BoardType | null
  priorityLevel?: PriorityLevel | null
  priorityScore?: number | null
  focusAreas: string[]
  createdAt: string
}

export type HistoryMailItem = {
  messageId: string
  threadId?: string | null
  senderName: string
  senderEmail?: string | null
  displaySender?: string
  subject: string
  briefSubject: string
  summary: string
  aiSummary: string
  aiReason: string
  actionLabel?: string | null
  deadlineLabel?: string | null
  boardType: BoardType
  priorityScore: number
  priorityLevel: PriorityLevel
  sortScore: number
  boardReason?: string
  priorityReasonTags: string[]
  focusAreas: string[]
  customFeatureHits: string[]
  needsAction?: boolean
  readWithin48h?: boolean
  handleWithin48h?: boolean
  openedCount?: number
  processed?: boolean
  feedbackAction?: FeedbackAction
  lastAnalyzedAt?: string
}

export type SyncContext = {
  accountKey?: string
  analysisMode?: 'incremental' | 'full_reanalyze' | 'resummary' | 'rerank'
  selectedSenders: string[]
  selectedFocuses: string[]
  customSenderValue?: string
  customFocusValue?: string
  importantSenderNames: string[]
  notImportantSenderNames: string[]
  mutedSenderNames: string[]
  senderHistory: SenderHistoryEntry[]
  recentHistory: HistoryMailItem[]
  feedbackHistory: FeedbackHistoryEntry[]
  processedMessageIds: string[]
  hiddenMessageIds: string[]
}

export type RawMessagePayload = {
  messageId: string
  threadId: string
  senderName: string
  senderEmail?: string
  subject: string
  summary: string
  bodyExcerpt: string
  timeText: string
  timestamp?: string
  isUnread: boolean
  hasAttachment: boolean
  labelIds: string[]
  threadMessageCount: number
}

export type SyncedMailItem = {
  messageId: string
  threadId?: string | null
  senderName: string
  senderEmail?: string | null
  displaySender?: string
  subject: string
  summary: string
  bodyExcerpt?: string
  timeText?: string | null
  timestamp?: string | null
  isUnread: boolean
  hasAttachment?: boolean
  labelIds?: string[]
  threadMessageCount?: number
  briefSubject: string
  aiSummary: string
  aiReason: string
  actionLabel?: string | null
  deadlineLabel?: string | null
  boardType: BoardType
  priorityScore: number
  priorityLevel: PriorityLevel
  sortScore: number
  needsAction?: boolean
  readWithin48h?: boolean
  handleWithin48h?: boolean
  focusAreas: string[]
  customFeatureHits: string[]
  displayExplanation: {
    boardReason: string
    priorityReasonTags: string[]
  }
  feedbackState: {
    moreImportantCount: number
    showLessCount: number
    lastAction?: FeedbackAction | null
  }
}

export type SyncAnalysisPayload = {
  generatedAt: string
  engine: 'llm' | 'rules'
  overview: {
    priorityContentCount: number
    within48hCount: number
    todoCount: number
    ignoreCount: number
  }
  items: SyncedMailItem[]
}

export type SummaryRefreshPayload = {
  generatedAt: string
  engine: 'llm' | 'rules'
  item: {
    messageId: string
    displaySender: string
    briefSubject: string
    aiSummary: string
    aiReason: string
  }
}

export type FeedbackPayload = {
  accountId: string
  messageId: string
  threadId?: string | null
  senderName?: string
  senderEmail?: string | null
  subject?: string
  feedbackAction: FeedbackAction
  boardType?: BoardType | null
  priorityLevel?: PriorityLevel | null
  priorityScore?: number | null
  focusAreas: string[]
  createdAt: string
}

export type RuntimeMessage =
  | { type: 'LMA_TOGGLE_PANEL' }
  | { type: 'LMA_OPEN_GMAIL' }
  | { type: 'LMA_TOGGLE_ACTIVE_GMAIL_PANEL' }
  | { type: 'LMA_AUTH_GMAIL' }
  | { type: 'LMA_GET_GMAIL_AUTH_STATE' }
  | { type: 'LMA_SYNC_GMAIL_ANALYSIS'; context: SyncContext }
  | { type: 'LMA_REFRESH_MAIL_SUMMARY'; messageId: string; context: SyncContext }
  | { type: 'LMA_RECORD_FEEDBACK'; payload: FeedbackPayload }

export type RuntimeResponse = {
  ok: boolean
  message?: string
  error?: string
  requiresAuth?: boolean
  accountKey?: string
  payload?: SyncAnalysisPayload
  summaryUpdate?: SummaryRefreshPayload
  feedback?: {
    moreImportantCount: number
    showLessCount: number
    recordedAt: string
  }
}

type BrowserTab = {
  id?: number
  url?: string
}

type ChromeLike = {
  runtime?: {
    lastError?: { message?: string }
    getManifest?: () => {
      oauth2?: {
        client_id?: string
        scopes?: string[]
      }
    }
    onInstalled?: { addListener: (listener: () => void) => void }
    onMessage?: {
      addListener: (
        listener: (
          message: RuntimeMessage,
          sender: unknown,
          sendResponse: (response: RuntimeResponse) => void,
        ) => boolean | void,
      ) => void
    }
    sendMessage?: (
      message: RuntimeMessage,
      callback?: (response: RuntimeResponse) => void,
    ) => void
  }
  tabs?: {
    create: (options: { url: string }) => void
    query: (
      queryInfo: { active: boolean; lastFocusedWindow: boolean },
      callback: (tabs: BrowserTab[]) => void,
    ) => void
    sendMessage: (
      tabId: number,
      message: RuntimeMessage,
      callback?: (response: RuntimeResponse) => void,
    ) => void
  }
  scripting?: {
    executeScript: (
      injection: {
        target: { tabId: number }
        files: string[]
      },
      callback?: () => void,
    ) => void
    insertCSS: (
      injection: {
        target: { tabId: number }
        files: string[]
      },
      callback?: () => void,
    ) => void
  }
  action?: {
    onClicked?: {
      addListener: (listener: (tab: BrowserTab) => void | Promise<void>) => void
    }
  }
  identity?: {
    getAuthToken?: (
      details: { interactive: boolean; scopes?: string[] },
      callback?: (token?: string) => void,
    ) => void
    clearAllCachedAuthTokens?: (callback?: () => void) => void
  }
}

export const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeLike }).chrome
