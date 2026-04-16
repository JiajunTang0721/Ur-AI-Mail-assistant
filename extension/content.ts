import type {
  BoardType,
  FeedbackAction,
  FeedbackHistoryEntry,
  HistoryMailItem,
  RuntimeMessage,
  RuntimeResponse,
  SenderHistoryEntry,
  SummaryRefreshPayload,
  SyncAnalysisPayload,
  SyncContext,
  SyncedMailItem,
} from './chrome'

const API_BASE_URL = import.meta.env.VITE_LMA_API_BASE_URL ?? 'http://127.0.0.1:8010'

type BrowserTab = {
  id?: number
  url?: string
}

type ChromeLike = {
  runtime?: {
    lastError?: { message?: string }
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
    sendMessage: (
      tabId: number,
      message: RuntimeMessage,
      callback?: (response: RuntimeResponse) => void,
    ) => void
    query?: (
      queryInfo: { active: boolean; lastFocusedWindow: boolean },
      callback: (tabs: BrowserTab[]) => void,
    ) => void
  }
}

const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeLike }).chrome

declare global {
  interface Window {
    __LMA_EXTENSION_RUNTIME__?: {
      ensureMounted: () => void
      togglePanel: () => void
    }
  }
}

type PreferencesPayload = {
  focusTopics: string[]
  focusOrder: string[]
  vipSenders: string[]
  customFocusItems: string[]
  notImportantSenders: string[]
  mutedSenders: string[]
  processedMessageIds: string[]
  defaultBoard: BoardType
}

type LocalBoardType = BoardType | 'completed_recent'

type CompletedMailState = {
  originalBoardType: BoardType
  markedAt: string
  moveAfterAt: string
  completedAt?: string
}

type AccountState = {
  activeTab: LocalBoardType
  vipSenders: string[]
  focusOrder: string[]
  customFocusItems: string[]
  customSenderDraft: string
  customFocusDraft: string
  recentHistory: Record<string, HistoryMailItem>
  feedbackHistory: FeedbackHistoryEntry[]
  notImportantSenders: string[]
  mutedSenders: string[]
  processedMessageIds: string[]
  hiddenMessageIds: string[]
  needsReanalyze: boolean
  currentRoundFeedbackCount: number
  pendingFeedbackActions: Record<string, FeedbackAction>
  completedMailStates: Record<string, CompletedMailState>
  lastPayload: SyncAnalysisPayload | null
}

type PersistedState = {
  version: number
  lastAccountKey: string
  accounts: Record<string, AccountState>
}

type UiState = {
  isOpen: boolean
  isSyncing: boolean
  isPreferenceAnimating: boolean
  preferencesExpanded: boolean
  requiresAuth: boolean
  authChecked: boolean
  syncMessage: string
  syncError: string
  accountKey: string
  preferencesLoaded: boolean
  resummarizingMessageIds: string[]
  removingCompletedMessageIds: string[]
  expandedBundleKeys: string[]
  contentScrollTop: number
}

type CardLayoutSnapshot = {
  top: number
  left: number
}

type ViewportSnapshot = {
  scrollTop: number
  anchorCardId: string | null
  anchorOffset: number
  cardLayouts: Map<string, CardLayoutSnapshot>
}

const ROOT_ID = 'lma-ext-root'
const STORAGE_KEY = 'lma-extension-panel-state-v3'
const LEGACY_STORAGE_KEY = 'lma-extension-panel-state'
const DEFAULT_ACCOUNT_KEY = 'local-default'
const COMPLETION_DELAY_MS = 5_000
const COMPLETION_EXIT_MS = 920
const DEFAULT_FOCUS_ORDER = ['学业', '招聘', '工作', '财务']
const BOARD_ORDER: LocalBoardType[] = [
  'priority_content',
  'within_48h',
  'todo',
  'ignore',
  'completed_recent',
]
const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
  ignore: 3,
} as const

const BOARD_LABELS: Record<BoardType, string> = {
  priority_content: '优先内容',
  within_48h: '48h',
  todo: '待处理',
  ignore: '可忽略',
}

const PRIORITY_LABELS = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
  ignore: '可忽略级',
} as const

const getBoardLabel = (boardType: LocalBoardType) =>
  boardType === 'completed_recent' ? '24h内已完成' : BOARD_LABELS[boardType]

const uiState: UiState = {
  isOpen: false,
  isSyncing: false,
  isPreferenceAnimating: false,
  preferencesExpanded: false,
  requiresAuth: false,
  authChecked: false,
  syncMessage: '正在准备 Gmail 邮件面板…',
  syncError: '',
  accountKey: DEFAULT_ACCOUNT_KEY,
  preferencesLoaded: false,
  resummarizingMessageIds: [],
  removingCompletedMessageIds: [],
  expandedBundleKeys: [],
  contentScrollTop: 0,
}

let persistedState: PersistedState
let rootElement: HTMLElement | null = null
let renderScheduled = false
const completionTimers = new Map<string, number>()
const completionExitTimers = new Map<string, number>()
let pendingViewportSnapshot: ViewportSnapshot | null = null

const dedupeStrings = (values: Array<string | null | undefined>) => {
  const output: string[] = []

  for (const value of values) {
    const normalized = (value ?? '').trim()
    if (normalized && !output.includes(normalized)) {
      output.push(normalized)
    }
  }

  return output
}

const BRIEF_SUBJECT_REPEAT_SUFFIXES = ['提交要求', '需要确认', '附件说明', '近期提醒', '最新通知', '通知', '提醒', '更新', '安排']

const normalizeBriefSubjectDisplay = (value: string) => {
  let normalized = (value || '').trim().replace(/\s+/g, ' ')
  if (!normalized) {
    return ''
  }

  for (const suffix of BRIEF_SUBJECT_REPEAT_SUFFIXES) {
    const repeated = `${suffix}${suffix}`
    while (normalized.endsWith(repeated)) {
      normalized = normalized.slice(0, -suffix.length)
    }
  }

  normalized = normalized.replace(/(要求|通知|提醒|更新|安排|说明)\1+$/u, '$1')
  const exactRepeat = normalized.match(/^(.{2,16}?)\1+$/u)
  if (exactRepeat) {
    normalized = exactRepeat[1]
  }

  return normalized.trim()
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const createDefaultAccountState = (): AccountState => ({
  activeTab: 'priority_content',
  vipSenders: [],
  focusOrder: [],
  customFocusItems: [],
  customSenderDraft: '',
  customFocusDraft: '',
  recentHistory: {},
  feedbackHistory: [],
  notImportantSenders: [],
  mutedSenders: [],
  processedMessageIds: [],
  hiddenMessageIds: [],
  needsReanalyze: false,
  currentRoundFeedbackCount: 0,
  pendingFeedbackActions: {},
  completedMailStates: {},
  lastPayload: null,
})

const mapLegacyBoard = (value: unknown): BoardType => {
  switch (value) {
    case 'today_focus':
    case 'priority_content':
      return 'priority_content'
    case 'due_soon':
    case 'within_48h':
      return 'within_48h'
    case 'todo':
      return 'todo'
    case 'ignorable':
    case 'ignore':
      return 'ignore'
    default:
      return 'priority_content'
  }
}

const mapLegacyPriority = (value: unknown, boardType: BoardType) => {
  if (value === 'high' || value === 'medium' || value === 'low' || value === 'ignore') {
    return value
  }

  return boardType === 'ignore' ? 'ignore' : 'medium'
}

const mapLegacyFeedback = (value: unknown): FeedbackAction | undefined => {
  switch (value) {
    case 'more_important':
    case 'important':
      return 'more_important'
    case 'show_less':
    case 'less':
    case 'muted':
    case 'not_important':
      return 'show_less'
    default:
      return undefined
  }
}

const toHistoryItemFromUnknown = (raw: unknown): HistoryMailItem | null => {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Record<string, unknown>
  const messageId = typeof candidate.messageId === 'string' ? candidate.messageId : ''
  const senderName = typeof candidate.senderName === 'string' ? candidate.senderName : ''
  const subject = typeof candidate.subject === 'string' ? candidate.subject : ''

  if (!messageId || !senderName || !subject) {
    return null
  }

  const boardType = mapLegacyBoard(candidate.boardType ?? candidate.tab)
  const priorityLevel = mapLegacyPriority(candidate.priorityLevel ?? candidate.priority, boardType)
  const priorityScore =
    typeof candidate.priorityScore === 'number'
      ? candidate.priorityScore
      : typeof candidate.sortScore === 'number'
        ? Math.max(0, Math.min(candidate.sortScore / 100, 1))
        : boardType === 'ignore'
          ? 0.12
          : 0.5

  return {
    messageId,
    threadId: typeof candidate.threadId === 'string' ? candidate.threadId : messageId,
    senderName,
    senderEmail: typeof candidate.senderEmail === 'string' ? candidate.senderEmail : undefined,
    displaySender:
      typeof candidate.displaySender === 'string' && candidate.displaySender.trim().length > 0
        ? candidate.displaySender
        : senderName,
    subject,
    briefSubject:
      typeof candidate.briefSubject === 'string' && candidate.briefSubject.trim().length > 0
        ? normalizeBriefSubjectDisplay(candidate.briefSubject)
        : subject,
    summary: typeof candidate.summary === 'string' ? candidate.summary : '',
    aiSummary:
      typeof candidate.aiSummary === 'string'
        ? candidate.aiSummary
        : typeof candidate.summary === 'string'
          ? candidate.summary
          : '',
    aiReason: typeof candidate.aiReason === 'string' ? candidate.aiReason : '',
    actionLabel: typeof candidate.actionLabel === 'string' ? candidate.actionLabel : undefined,
    deadlineLabel:
      typeof candidate.deadlineLabel === 'string' ? candidate.deadlineLabel : undefined,
    boardType,
    priorityScore,
    priorityLevel,
    sortScore: typeof candidate.sortScore === 'number' ? candidate.sortScore : priorityScore * 100,
    boardReason: typeof candidate.boardReason === 'string' ? candidate.boardReason : '',
    priorityReasonTags: Array.isArray(candidate.priorityReasonTags)
      ? candidate.priorityReasonTags.filter((value): value is string => typeof value === 'string')
      : Array.isArray(candidate.reasonTags)
        ? candidate.reasonTags.filter((value): value is string => typeof value === 'string')
        : [],
    focusAreas: Array.isArray(candidate.focusAreas)
      ? candidate.focusAreas.filter((value): value is string => typeof value === 'string')
      : [],
    customFeatureHits: Array.isArray(candidate.customFeatureHits)
      ? candidate.customFeatureHits.filter((value): value is string => typeof value === 'string')
      : [],
    needsAction:
      typeof candidate.needsAction === 'boolean'
        ? candidate.needsAction
        : Boolean(candidate.isTodo),
    readWithin48h: Boolean(candidate.readWithin48h),
    handleWithin48h:
      typeof candidate.handleWithin48h === 'boolean'
        ? candidate.handleWithin48h
        : Boolean(candidate.isDueSoon),
    openedCount: typeof candidate.openedCount === 'number' ? candidate.openedCount : 0,
    processed: Boolean(candidate.processed),
    feedbackAction: mapLegacyFeedback(candidate.feedbackAction ?? candidate.feedback),
    lastAnalyzedAt:
      typeof candidate.lastAnalyzedAt === 'string'
        ? candidate.lastAnalyzedAt
        : new Date().toISOString(),
  }
}

const migrateLegacyFeedbackEntry = (raw: unknown): FeedbackHistoryEntry | null => {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Record<string, unknown>
  const feedbackAction = mapLegacyFeedback(candidate.feedbackAction ?? candidate.feedback)
  if (!feedbackAction) {
    return null
  }

  return {
    messageId: typeof candidate.messageId === 'string' ? candidate.messageId : undefined,
    threadId: typeof candidate.threadId === 'string' ? candidate.threadId : undefined,
    senderName: typeof candidate.senderName === 'string' ? candidate.senderName : undefined,
    senderEmail: typeof candidate.senderEmail === 'string' ? candidate.senderEmail : undefined,
    subject: typeof candidate.subject === 'string' ? candidate.subject : undefined,
    feedbackAction,
    boardType:
      typeof candidate.boardType === 'string'
        ? mapLegacyBoard(candidate.boardType)
        : undefined,
    priorityLevel:
      candidate.priorityLevel === 'high' ||
      candidate.priorityLevel === 'medium' ||
      candidate.priorityLevel === 'low' ||
      candidate.priorityLevel === 'ignore'
        ? candidate.priorityLevel
        : undefined,
    priorityScore:
      typeof candidate.priorityScore === 'number' ? candidate.priorityScore : undefined,
    focusAreas: Array.isArray(candidate.focusAreas)
      ? candidate.focusAreas.filter((value): value is string => typeof value === 'string')
      : [],
    createdAt:
      typeof candidate.createdAt === 'string'
        ? candidate.createdAt
        : new Date().toISOString(),
  }
}

const migrateLegacyAccount = (raw: unknown): AccountState => {
  if (!raw || typeof raw !== 'object') {
    return createDefaultAccountState()
  }

  const candidate = raw as Record<string, unknown>
  const nextState = createDefaultAccountState()

  nextState.activeTab =
    candidate.activeTab === 'completed_recent'
      ? 'completed_recent'
      : mapLegacyBoard(candidate.activeTab)
  nextState.vipSenders = dedupeStrings(
    Array.isArray(candidate.vipSenders)
      ? candidate.vipSenders.filter((value): value is string => typeof value === 'string')
      : Array.isArray(candidate.importantSenderNames)
        ? candidate.importantSenderNames.filter(
            (value): value is string => typeof value === 'string',
          )
        : Array.isArray(candidate.selectedSenders)
          ? candidate.selectedSenders.filter((value): value is string => typeof value === 'string')
          : [],
  )
  nextState.customFocusItems = dedupeStrings(
    Array.isArray(candidate.customFocusItems)
      ? candidate.customFocusItems.filter((value): value is string => typeof value === 'string')
      : Array.isArray(candidate.customFocusEntries)
        ? candidate.customFocusEntries.filter((value): value is string => typeof value === 'string')
        : [],
  )
  nextState.focusOrder = dedupeStrings(
    Array.isArray(candidate.focusOrder)
      ? candidate.focusOrder.filter((value): value is string => typeof value === 'string')
      : Array.isArray(candidate.selectedFocuses)
        ? candidate.selectedFocuses.filter((value): value is string => typeof value === 'string')
        : [],
  )

  nextState.customSenderDraft =
    typeof candidate.customSenderValue === 'string' ? candidate.customSenderValue : ''
  nextState.customFocusDraft =
    typeof candidate.customFocusValue === 'string' ? candidate.customFocusValue : ''
  nextState.notImportantSenders = dedupeStrings(
    Array.isArray(candidate.notImportantSenders)
      ? candidate.notImportantSenders.filter((value): value is string => typeof value === 'string')
      : Array.isArray(candidate.notImportantSenderNames)
        ? candidate.notImportantSenderNames.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
  )
  nextState.mutedSenders = dedupeStrings(
    Array.isArray(candidate.mutedSenders)
      ? candidate.mutedSenders.filter((value): value is string => typeof value === 'string')
      : Array.isArray(candidate.mutedSenderNames)
        ? candidate.mutedSenderNames.filter((value): value is string => typeof value === 'string')
        : [],
  )
  nextState.processedMessageIds = dedupeStrings(
    Array.isArray(candidate.processedMessageIds)
      ? candidate.processedMessageIds.filter((value): value is string => typeof value === 'string')
      : [],
  )
  nextState.hiddenMessageIds = dedupeStrings(
    Array.isArray(candidate.hiddenMessageIds)
      ? candidate.hiddenMessageIds.filter((value): value is string => typeof value === 'string')
      : [],
  )
  nextState.needsReanalyze = Boolean(candidate.needsRerank ?? candidate.needsReanalyze)
  nextState.currentRoundFeedbackCount =
    typeof candidate.currentRoundFeedbackCount === 'number'
      ? candidate.currentRoundFeedbackCount
      : 0
  nextState.pendingFeedbackActions =
    candidate.pendingFeedbackActions && typeof candidate.pendingFeedbackActions === 'object'
      ? Object.fromEntries(
          Object.entries(candidate.pendingFeedbackActions as Record<string, unknown>).filter(
            ([, value]) => value === 'more_important' || value === 'show_less',
          ),
        ) as Record<string, FeedbackAction>
      : {}
  nextState.completedMailStates =
    candidate.completedMailStates && typeof candidate.completedMailStates === 'object'
      ? Object.entries(candidate.completedMailStates as Record<string, unknown>).reduce<
          Record<string, CompletedMailState>
        >((accumulator, [messageId, value]) => {
          if (!value || typeof value !== 'object') {
            return accumulator
          }

          const completedState = value as Record<string, unknown>
          const originalBoardType =
            typeof completedState.originalBoardType === 'string'
              ? mapLegacyBoard(completedState.originalBoardType)
              : 'priority_content'
          const markedAt =
            typeof completedState.markedAt === 'string'
              ? completedState.markedAt
              : new Date().toISOString()
          const moveAfterAt =
            typeof completedState.moveAfterAt === 'string'
              ? completedState.moveAfterAt
              : markedAt

          accumulator[messageId] = {
            originalBoardType,
            markedAt,
            moveAfterAt,
            completedAt:
              typeof completedState.completedAt === 'string'
                ? completedState.completedAt
                : undefined,
          }
          return accumulator
        }, {})
      : {}

  if (candidate.analysisHistory && typeof candidate.analysisHistory === 'object') {
    for (const value of Object.values(candidate.analysisHistory as Record<string, unknown>)) {
      const historyItem = toHistoryItemFromUnknown(value)
      if (historyItem) {
        nextState.recentHistory[historyItem.messageId] = historyItem
      }
    }
  }

  if (Array.isArray(candidate.feedbackHistory)) {
    nextState.feedbackHistory = candidate.feedbackHistory
      .map((entry) => migrateLegacyFeedbackEntry(entry))
      .filter((entry): entry is FeedbackHistoryEntry => entry !== null)
  }

  if (candidate.lastPayload && typeof candidate.lastPayload === 'object') {
    nextState.lastPayload = candidate.lastPayload as SyncAnalysisPayload
  }

  return nextState
}

function loadPersistedState(): PersistedState {
  const emptyState: PersistedState = {
    version: 3,
    lastAccountKey: DEFAULT_ACCOUNT_KEY,
    accounts: {},
  }

  const currentRaw = globalThis.localStorage?.getItem(STORAGE_KEY)
  if (currentRaw) {
    try {
      const parsed = JSON.parse(currentRaw) as Partial<PersistedState>
      const accounts = Object.fromEntries(
        Object.entries(parsed.accounts ?? {}).map(([accountKey, accountState]) => [
          accountKey,
          migrateLegacyAccount(accountState),
        ]),
      )

      return {
        version: 3,
        lastAccountKey: parsed.lastAccountKey ?? DEFAULT_ACCOUNT_KEY,
        accounts,
      }
    } catch {
      return emptyState
    }
  }

  const legacyRaw = globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY)
  if (!legacyRaw) {
    return emptyState
  }

  try {
    const parsed = JSON.parse(legacyRaw) as Record<string, unknown>
    const accountsSource =
      parsed.accounts && typeof parsed.accounts === 'object'
        ? (parsed.accounts as Record<string, unknown>)
        : { [DEFAULT_ACCOUNT_KEY]: parsed }

    return {
      version: 3,
      lastAccountKey:
        typeof parsed.lastAccountKey === 'string' ? parsed.lastAccountKey : DEFAULT_ACCOUNT_KEY,
      accounts: Object.fromEntries(
        Object.entries(accountsSource).map(([accountKey, accountState]) => [
          accountKey,
          migrateLegacyAccount(accountState),
        ]),
      ),
    }
  } catch {
    return emptyState
  }
}

const savePersistedState = () => {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(persistedState))
}

persistedState = loadPersistedState()

const getAccountState = (accountKey = uiState.accountKey) => {
  if (!persistedState.accounts[accountKey]) {
    persistedState.accounts[accountKey] = createDefaultAccountState()
  }

  return persistedState.accounts[accountKey]
}

const setActiveAccountKey = (accountKey: string) => {
  uiState.accountKey = accountKey || DEFAULT_ACCOUNT_KEY
  persistedState.lastAccountKey = uiState.accountKey
  getAccountState(uiState.accountKey)
  savePersistedState()
}

const sendRuntimeMessage = (message: RuntimeMessage) =>
  new Promise<RuntimeResponse>((resolve) => {
    chromeApi?.runtime?.sendMessage?.(message, (response) => {
      const lastError = chromeApi?.runtime?.lastError?.message

      if (lastError) {
        resolve({
          ok: false,
          error: lastError,
        })
        return
      }

      resolve(
        response ?? {
          ok: true,
        },
      )
    })
  })

const buildPreferencesPayload = (accountState: AccountState): PreferencesPayload => ({
  focusTopics: dedupeStrings([...accountState.focusOrder, ...accountState.customFocusItems]),
  focusOrder: dedupeStrings(accountState.focusOrder),
  vipSenders: dedupeStrings(accountState.vipSenders),
  customFocusItems: dedupeStrings(accountState.customFocusItems),
  notImportantSenders: dedupeStrings(accountState.notImportantSenders),
  mutedSenders: dedupeStrings(accountState.mutedSenders),
  processedMessageIds: dedupeStrings(accountState.processedMessageIds),
  defaultBoard:
    accountState.activeTab === 'completed_recent' ? 'priority_content' : accountState.activeTab,
})

const mergePreferencesIntoAccount = (accountState: AccountState, preferences: PreferencesPayload) => {
  accountState.vipSenders = dedupeStrings([...accountState.vipSenders, ...preferences.vipSenders])
  accountState.customFocusItems = dedupeStrings([
    ...accountState.customFocusItems,
    ...preferences.customFocusItems,
  ])
  accountState.focusOrder = dedupeStrings([...accountState.focusOrder, ...preferences.focusOrder])
  accountState.notImportantSenders = dedupeStrings([
    ...accountState.notImportantSenders,
    ...preferences.notImportantSenders,
  ])
  accountState.mutedSenders = dedupeStrings([
    ...accountState.mutedSenders,
    ...preferences.mutedSenders,
  ])
  accountState.processedMessageIds = dedupeStrings([
    ...accountState.processedMessageIds,
    ...preferences.processedMessageIds,
  ])
  accountState.activeTab = preferences.defaultBoard ?? accountState.activeTab
}

const loadPreferencesFromBackend = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/preferences`)
    if (!response.ok) {
      throw new Error(await response.text())
    }

    const preferences = (await response.json()) as PreferencesPayload
    mergePreferencesIntoAccount(getAccountState(), preferences)
    uiState.preferencesLoaded = true
    savePersistedState()
    scheduleRender()
  } catch (error) {
    console.warn('Failed to load preferences from backend:', error)
  }
}

const savePreferencesToBackend = async () => {
  const accountState = getAccountState()

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildPreferencesPayload(accountState)),
    })

    if (!response.ok) {
      throw new Error(await response.text())
    }

    uiState.syncError = ''
    uiState.preferencesLoaded = true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    uiState.syncError = `同步偏好设置失败：${message}`
  }
}

const toHistoryItem = (
  item: SyncedMailItem,
  existingHistory: HistoryMailItem | undefined,
): HistoryMailItem => ({
  messageId: item.messageId,
  threadId: item.threadId ?? item.messageId,
  senderName: item.senderName,
  senderEmail: item.senderEmail ?? undefined,
  displaySender: item.displaySender ?? item.senderName,
  subject: item.subject,
  briefSubject: item.briefSubject,
  summary: item.summary,
  aiSummary: item.aiSummary,
  aiReason: item.aiReason,
  actionLabel: item.actionLabel ?? undefined,
  deadlineLabel: item.deadlineLabel ?? undefined,
  boardType: item.boardType,
  priorityScore: item.priorityScore,
  priorityLevel: item.priorityLevel,
  sortScore: item.sortScore,
  boardReason: item.displayExplanation.boardReason,
  priorityReasonTags: item.displayExplanation.priorityReasonTags,
  focusAreas: item.focusAreas,
  customFeatureHits: item.customFeatureHits,
  needsAction: item.needsAction,
  readWithin48h: item.readWithin48h,
  handleWithin48h: item.handleWithin48h,
  openedCount: existingHistory?.openedCount ?? 0,
  processed: existingHistory?.processed ?? false,
  feedbackAction: existingHistory?.feedbackAction,
  lastAnalyzedAt: new Date().toISOString(),
})

const updateHistoryFromPayload = (payload: SyncAnalysisPayload) => {
  const accountState = getAccountState()

  for (const item of payload.items) {
    const existingHistory = accountState.recentHistory[item.messageId]
    accountState.recentHistory[item.messageId] = toHistoryItem(item, existingHistory)
  }

  accountState.lastPayload = payload
}

const clearRoundFeedbackState = (accountState: AccountState) => {
  accountState.currentRoundFeedbackCount = 0
  accountState.pendingFeedbackActions = {}

  if (accountState.lastPayload) {
    accountState.lastPayload = {
      ...accountState.lastPayload,
      items: accountState.lastPayload.items.map((item) => ({
        ...item,
        feedbackState: {
          ...item.feedbackState,
          lastAction: undefined,
        },
      })),
    }
  }

  for (const historyItem of Object.values(accountState.recentHistory)) {
    historyItem.feedbackAction = undefined
  }
}

const mergeSummaryUpdateIntoState = (summaryUpdate: SummaryRefreshPayload) => {
  const accountState = getAccountState()
  const { item } = summaryUpdate
  const briefSubject = normalizeBriefSubjectDisplay(item.briefSubject)

  if (accountState.lastPayload) {
    accountState.lastPayload = {
      ...accountState.lastPayload,
      items: accountState.lastPayload.items.map((payloadItem) =>
        payloadItem.messageId === item.messageId
          ? {
              ...payloadItem,
              displaySender: item.displaySender,
              briefSubject,
              aiSummary: item.aiSummary,
              aiReason: item.aiReason,
            }
          : payloadItem,
      ),
    }
  }

  const historyItem = accountState.recentHistory[item.messageId]
  if (historyItem) {
    historyItem.displaySender = item.displaySender
    historyItem.briefSubject = briefSubject
    historyItem.aiSummary = item.aiSummary
    historyItem.aiReason = item.aiReason
    historyItem.lastAnalyzedAt = new Date().toISOString()
  }
}

const clearCompletionTimer = (messageId: string) => {
  const timerId = completionTimers.get(messageId)
  if (typeof timerId === 'number') {
    globalThis.clearTimeout(timerId)
    completionTimers.delete(messageId)
  }
}

const clearCompletionExitTimer = (messageId: string) => {
  const timerId = completionExitTimers.get(messageId)
  if (typeof timerId === 'number') {
    globalThis.clearTimeout(timerId)
    completionExitTimers.delete(messageId)
  }
}

const finalizeCompletedMail = (messageId: string) => {
  const accountState = getAccountState()
  const completedState = accountState.completedMailStates[messageId]
  if (!completedState || completedState.completedAt) {
    clearCompletionTimer(messageId)
    return
  }

  clearCompletionTimer(messageId)
  uiState.removingCompletedMessageIds = dedupeStrings([
    ...uiState.removingCompletedMessageIds,
    messageId,
  ])
  scheduleRender()

  clearCompletionExitTimer(messageId)
  const exitTimerId = globalThis.setTimeout(() => {
    completionExitTimers.delete(messageId)

    const nextState = getAccountState().completedMailStates[messageId]
    if (!nextState || nextState.completedAt) {
      uiState.removingCompletedMessageIds = uiState.removingCompletedMessageIds.filter(
        (currentId) => currentId !== messageId,
      )
      scheduleRender()
      return
    }

    nextState.completedAt = new Date().toISOString()
    uiState.removingCompletedMessageIds = uiState.removingCompletedMessageIds.filter(
      (currentId) => currentId !== messageId,
    )
    uiState.syncMessage = '已移入24h内已完成'
    savePersistedState()
    scheduleRender()
  }, COMPLETION_EXIT_MS)
  completionExitTimers.set(messageId, exitTimerId)
}

const scheduleCompletedMailFinalization = (messageId: string) => {
  const completedState = getAccountState().completedMailStates[messageId]
  if (!completedState || completedState.completedAt) {
    clearCompletionTimer(messageId)
    return
  }

  const delay = new Date(completedState.moveAfterAt).getTime() - Date.now()
  if (delay <= 0) {
    finalizeCompletedMail(messageId)
    return
  }

  clearCompletionTimer(messageId)
  const timerId = globalThis.setTimeout(() => {
    completionTimers.delete(messageId)
    finalizeCompletedMail(messageId)
  }, delay)
  completionTimers.set(messageId, timerId)
}

const normalizeCompletedMailStates = (accountState = getAccountState()) => {
  let changed = false

  for (const [messageId, completedState] of Object.entries(accountState.completedMailStates)) {
    if (completedState.completedAt) {
      clearCompletionTimer(messageId)
      continue
    }

    if (new Date(completedState.moveAfterAt).getTime() <= Date.now()) {
      completedState.completedAt = new Date().toISOString()
      clearCompletionTimer(messageId)
      changed = true
      continue
    }

    scheduleCompletedMailFinalization(messageId)
  }

  if (changed) {
    savePersistedState()
  }

  return changed
}

const getCompletedMailState = (messageId: string) => getAccountState().completedMailStates[messageId]

const getCompletionVisualState = (messageId: string) => {
  if (uiState.removingCompletedMessageIds.includes(messageId)) {
    return 'removing'
  }

  const completedState = getCompletedMailState(messageId)
  if (!completedState) {
    return 'none'
  }

  return completedState.completedAt ? 'completed' : 'pending'
}

type BoardRenderEntry =
  | {
      kind: 'single'
      item: SyncedMailItem
    }
  | {
      kind: 'bundle'
      key: string
      items: SyncedMailItem[]
      displaySender: string
      briefSubject: string
      aiSummary: string
      priorityScore: number
      priorityLevel: SyncedMailItem['priorityLevel']
      timeText: string
      boardType: LocalBoardType
      reasonTags: string[]
    }

const compareBoardItems = (left: SyncedMailItem, right: SyncedMailItem) =>
  right.priorityScore - left.priorityScore ||
  PRIORITY_ORDER[left.priorityLevel] - PRIORITY_ORDER[right.priorityLevel] ||
  right.sortScore - left.sortScore ||
  left.senderName.localeCompare(right.senderName, 'zh-CN') ||
  left.messageId.localeCompare(right.messageId, 'zh-CN')

const getEntrySortValues = (entry: BoardRenderEntry) => {
  if (entry.kind === 'bundle') {
    return {
      priorityScore: entry.priorityScore,
      priorityLevel: entry.priorityLevel,
      sortScore: Math.max(...entry.items.map((item) => item.sortScore)),
      senderName: entry.displaySender,
      messageId: entry.items[0]?.messageId ?? entry.key,
    }
  }

  return {
    priorityScore: entry.item.priorityScore,
    priorityLevel: entry.item.priorityLevel,
    sortScore: entry.item.sortScore,
    senderName: entry.item.senderName,
    messageId: entry.item.messageId,
  }
}

const compareBoardEntries = (left: BoardRenderEntry, right: BoardRenderEntry) => {
  const leftValues = getEntrySortValues(left)
  const rightValues = getEntrySortValues(right)

  return (
    rightValues.priorityScore - leftValues.priorityScore ||
    PRIORITY_ORDER[leftValues.priorityLevel] - PRIORITY_ORDER[rightValues.priorityLevel] ||
    rightValues.sortScore - leftValues.sortScore ||
    leftValues.senderName.localeCompare(rightValues.senderName, 'zh-CN') ||
    leftValues.messageId.localeCompare(rightValues.messageId, 'zh-CN')
  )
}

const normalizeBundleText = (value: string) =>
  value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\d{1,4}([:/.-]\d{1,4})+/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, ' ')
    .replace(/\b(update|notification|notice|newsletter|digest|reminder|alert|weekly|daily)\b/g, ' ')
    .replace(/(通知|提醒|更新|查看|邮件|每周|每月|推荐|速览|摘要|汇总)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const buildBundleSignature = (item: SyncedMailItem) => {
  const senderKey = normalizeBundleText(item.displaySender || item.senderName || '')
  const subjectKey = normalizeBundleText(item.briefSubject || item.subject || '')
  const reasonKey = normalizeBundleText(
    [
      item.actionLabel ?? '',
      item.deadlineLabel ?? '',
      ...item.displayExplanation.priorityReasonTags.slice(0, 2),
    ].join(' '),
  )
  const summaryKey = normalizeBundleText(item.aiSummary || '')
  const semanticKey = (subjectKey || reasonKey || summaryKey).slice(0, 30)
  return senderKey && semanticKey ? `${senderKey}::${semanticKey}` : ''
}

const isBundleExpanded = (bundleKey: string) => uiState.expandedBundleKeys.includes(bundleKey)

const getBoardRenderEntries = (
  items: SyncedMailItem[],
  boardType: LocalBoardType,
): BoardRenderEntry[] => {
  if (boardType === 'completed_recent') {
    return items.map((item) => ({ kind: 'single', item }))
  }

  const grouped = new Map<string, SyncedMailItem[]>()
  const singles: SyncedMailItem[] = []

  for (const item of items) {
    const signatureCore = buildBundleSignature(item)
    const signature = signatureCore ? `${boardType}::${signatureCore}` : ''
    if (!signature) {
      singles.push(item)
      continue
    }

    const bucket = grouped.get(signature)
    if (bucket) {
      bucket.push(item)
    } else {
      grouped.set(signature, [item])
    }
  }

  const entries: BoardRenderEntry[] = []
  const bundledIds = new Set<string>()

  for (const [bundleKey, groupedItems] of grouped.entries()) {
    if (groupedItems.length < 2) {
      singles.push(...groupedItems)
      continue
    }

    const sortedItems = [...groupedItems].sort(compareBoardItems)
    sortedItems.forEach((item) => bundledIds.add(item.messageId))

    const leadItem = sortedItems[0]
    const leadSubject = normalizeBriefSubjectDisplay(leadItem.briefSubject || '相近主题')
    entries.push({
      kind: 'bundle',
      key: bundleKey,
      items: sortedItems,
      displaySender: leadItem.displaySender || leadItem.senderName,
      briefSubject: leadSubject || '相似邮件汇总',
      aiSummary: `该来源近期连续发送了${sortedItems.length}封相似邮件，主要围绕“${leadSubject || '相近主题'}”。点击展开可查看每封具体内容。`,
      priorityScore: Math.max(...sortedItems.map((item) => item.priorityScore)),
      priorityLevel: sortedItems[0].priorityLevel,
      timeText: leadItem.timeText ?? '最近',
      boardType,
      reasonTags: dedupeStrings(
        sortedItems.flatMap((item) => [
          item.actionLabel ?? '',
          item.deadlineLabel ?? '',
          ...item.displayExplanation.priorityReasonTags.slice(0, 2),
        ]),
      ).slice(0, 4),
    })
  }

  for (const item of singles) {
    if (!bundledIds.has(item.messageId)) {
      entries.push({ kind: 'single', item })
    }
  }

  return entries.sort(compareBoardEntries)
}

const buildSenderHistory = (accountState: AccountState): SenderHistoryEntry[] => {
  const counts = new Map<string, number>()

  for (const item of Object.values(accountState.recentHistory)) {
    const baseCount = Math.max(item.openedCount ?? 0, 1)
    counts.set(item.senderName, (counts.get(item.senderName) ?? 0) + baseCount)
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
    .slice(0, 12)
    .map(([senderName, count]) => ({ senderName, count }))
}

const buildRecentHistory = (accountState: AccountState) =>
  Object.values(accountState.recentHistory)
    .sort(
      (left, right) =>
        new Date(right.lastAnalyzedAt ?? 0).getTime() -
          new Date(left.lastAnalyzedAt ?? 0).getTime() ||
        (right.openedCount ?? 0) - (left.openedCount ?? 0),
    )
    .slice(0, 180)

const buildSyncContext = (analysisMode: SyncContext['analysisMode']): SyncContext => {
  const accountState = getAccountState()

  return {
    accountKey: uiState.accountKey,
    analysisMode,
    selectedSenders: accountState.vipSenders,
    selectedFocuses: accountState.focusOrder,
    importantSenderNames: accountState.vipSenders,
    notImportantSenderNames: accountState.notImportantSenders,
    mutedSenderNames: accountState.mutedSenders,
    senderHistory: buildSenderHistory(accountState),
    recentHistory: buildRecentHistory(accountState),
    feedbackHistory: accountState.feedbackHistory.slice(-320),
    processedMessageIds: accountState.processedMessageIds,
    hiddenMessageIds: accountState.hiddenMessageIds,
  }
}

const hydrateAfterRuntimeResponse = (response: RuntimeResponse) => {
  if (response.accountKey && response.accountKey !== uiState.accountKey) {
    setActiveAccountKey(response.accountKey)
  }
}

const syncAnalysis = async (analysisMode: SyncContext['analysisMode']) => {
  if (uiState.isSyncing) {
    return
  }

  uiState.isSyncing = true
  uiState.syncError = ''
  uiState.syncMessage =
    analysisMode === 'full_reanalyze' || analysisMode === 'rerank'
      ? '正在结合最新反馈重新整理邮件'
      : '正在读取 Gmail 并生成当前轮结果'
  scheduleRender()

  const response = await sendRuntimeMessage({
    type: 'LMA_SYNC_GMAIL_ANALYSIS',
    context: buildSyncContext(analysisMode),
  })

  hydrateAfterRuntimeResponse(response)

  uiState.isSyncing = false
  uiState.requiresAuth = Boolean(response.requiresAuth)

  if (response.ok && response.payload) {
    updateHistoryFromPayload(response.payload)
    const accountState = getAccountState()
    accountState.needsReanalyze = false

    if (analysisMode === 'full_reanalyze' || analysisMode === 'rerank') {
      clearRoundFeedbackState(accountState)
    }

    uiState.syncMessage = response.message ?? `已分析${response.payload.items.length}封邮件`
    uiState.syncError = ''
    savePersistedState()
  } else {
    uiState.syncError = response.error ?? '同步 Gmail 邮件失败。'
  }

  scheduleRender()
}

const recordFeedback = async (item: SyncedMailItem, feedbackAction: FeedbackAction) => {
  const accountState = getAccountState()
  const feedbackRecord: FeedbackHistoryEntry = {
    messageId: item.messageId,
    threadId: item.threadId ?? item.messageId,
    senderName: item.senderName,
    senderEmail: item.senderEmail ?? undefined,
    subject: item.subject,
    feedbackAction,
    boardType: item.boardType,
    priorityLevel: item.priorityLevel,
    priorityScore: item.priorityScore,
    focusAreas: item.focusAreas,
    createdAt: new Date().toISOString(),
  }

  const response = await sendRuntimeMessage({
    type: 'LMA_RECORD_FEEDBACK',
    payload: {
      accountId: uiState.accountKey || DEFAULT_ACCOUNT_KEY,
      messageId: item.messageId,
      threadId: item.threadId ?? item.messageId,
      senderName: item.senderName,
      senderEmail: item.senderEmail ?? undefined,
      subject: item.subject,
      feedbackAction,
      boardType: item.boardType,
      priorityLevel: item.priorityLevel,
      priorityScore: item.priorityScore,
      focusAreas: item.focusAreas,
      createdAt: feedbackRecord.createdAt ?? new Date().toISOString(),
    },
  })

  if (!response.ok) {
    uiState.syncError = response.error ?? '记录反馈失败。'
    scheduleRender()
    return
  }

  accountState.feedbackHistory = [...accountState.feedbackHistory, feedbackRecord].slice(-320)
  accountState.needsReanalyze = true
  accountState.currentRoundFeedbackCount += 1
  accountState.pendingFeedbackActions[item.messageId] = feedbackAction

  const historyItem = accountState.recentHistory[item.messageId]
  if (historyItem) {
    historyItem.feedbackAction = feedbackAction
    historyItem.lastAnalyzedAt = new Date().toISOString()
  }

  if (accountState.lastPayload) {
    accountState.lastPayload = {
      ...accountState.lastPayload,
      items: accountState.lastPayload.items.map((payloadItem) =>
        payloadItem.messageId === item.messageId
          ? {
              ...payloadItem,
              feedbackState: {
                moreImportantCount:
                  response.feedback?.moreImportantCount ?? payloadItem.feedbackState.moreImportantCount,
                showLessCount:
                  response.feedback?.showLessCount ?? payloadItem.feedbackState.showLessCount,
                lastAction: undefined,
              },
            }
          : payloadItem,
      ),
    }
  }

  uiState.syncError = ''
  savePersistedState()
  scheduleRender()
}

const refreshMailSummary = async (item: SyncedMailItem) => {
  if (isResummarizingMessage(item.messageId)) {
    return
  }

  uiState.resummarizingMessageIds = dedupeStrings([...uiState.resummarizingMessageIds, item.messageId])
  uiState.syncError = ''
  scheduleRender()

  const response = await sendRuntimeMessage({
    type: 'LMA_REFRESH_MAIL_SUMMARY',
    messageId: item.messageId,
    context: buildSyncContext('incremental'),
  })

  hydrateAfterRuntimeResponse(response)

  if (response.ok && response.summaryUpdate) {
    mergeSummaryUpdateIntoState(response.summaryUpdate)
    uiState.syncMessage = response.message ?? '已更新当前邮件概述'
    uiState.syncError = ''
    savePersistedState()
  } else {
    uiState.syncError = response.error ?? '重新概述失败。'
  }

  uiState.resummarizingMessageIds = uiState.resummarizingMessageIds.filter(
    (messageId) => messageId !== item.messageId,
  )
  scheduleRender()
}

const markMailCompleted = (item: SyncedMailItem) => {
  const accountState = getAccountState()
  const now = new Date()
  accountState.completedMailStates[item.messageId] = {
    originalBoardType: item.boardType,
    markedAt: now.toISOString(),
    moveAfterAt: new Date(now.getTime() + COMPLETION_DELAY_MS).toISOString(),
  }
  scheduleCompletedMailFinalization(item.messageId)
  uiState.syncMessage = '已标记为完成，5秒内可恢复为未完成'
  uiState.syncError = ''
  savePersistedState()
  scheduleRender()
}

const restoreMailToIncomplete = (messageId: string) => {
  const accountState = getAccountState()
  const completedState = accountState.completedMailStates[messageId]
  if (!completedState) {
    return
  }

  delete accountState.completedMailStates[messageId]
  clearCompletionTimer(messageId)
  clearCompletionExitTimer(messageId)
  uiState.removingCompletedMessageIds = uiState.removingCompletedMessageIds.filter(
    (currentId) => currentId !== messageId,
  )

  if (accountState.activeTab === 'completed_recent') {
    accountState.activeTab = completedState.originalBoardType
  }

  uiState.syncMessage = '已恢复为未完成'
  uiState.syncError = ''
  savePersistedState()
  scheduleRender()
}

const openOriginalMail = (item: SyncedMailItem) => {
  const accountState = getAccountState()
  const historyItem = accountState.recentHistory[item.messageId]

  if (historyItem) {
    historyItem.openedCount = (historyItem.openedCount ?? 0) + 1
    historyItem.lastAnalyzedAt = new Date().toISOString()
  }

  savePersistedState()

  const targetId = item.threadId ?? item.messageId
  globalThis.location.hash = `#inbox/${encodeURIComponent(targetId)}`
}

const mutateAccountState = async (
  mutator: (accountState: AccountState) => void,
  successMessage: string,
) => {
  mutator(getAccountState())
  getAccountState().needsReanalyze = true
  savePersistedState()
  await savePreferencesToBackend()
  uiState.syncMessage = successMessage
  scheduleRender()
}

const getCurrentItems = () => getAccountState().lastPayload?.items ?? []

const getOverviewCounts = (items: SyncedMailItem[]) => {
  const counts: Record<LocalBoardType, number> = {
    priority_content: 0,
    within_48h: 0,
    todo: 0,
    ignore: 0,
    completed_recent: 0,
  }

  for (const item of items) {
    const completionState = getCompletionVisualState(item.messageId)
    if (completionState === 'completed') {
      counts.completed_recent += 1
      continue
    }

    counts[item.boardType] += 1
  }

  return counts
}

const getItemsForBoard = (items: SyncedMailItem[], boardType: LocalBoardType) =>
  items
    .filter((item) => {
      const completionState = getCompletionVisualState(item.messageId)

      if (boardType === 'completed_recent') {
        return completionState === 'completed'
      }

      if (completionState === 'completed') {
        return false
      }

      return item.boardType === boardType
    })
    .sort((left, right) => {
      if (boardType === 'completed_recent') {
        const rightCompletedAt = getCompletedMailState(right.messageId)?.completedAt ?? ''
        const leftCompletedAt = getCompletedMailState(left.messageId)?.completedAt ?? ''
        return (
          new Date(rightCompletedAt || 0).getTime() - new Date(leftCompletedAt || 0).getTime() ||
          compareBoardItems(left, right)
        )
      }

      return compareBoardItems(left, right)
    })

const formatSyncMeta = () => {
  const payload = getAccountState().lastPayload
  if (!payload) {
    return '尚未分析邮件'
  }

  const count = payload.items.length
  return `已分析${count}封邮件`
}

const getRoundFeedbackCount = () => getAccountState().currentRoundFeedbackCount

const getPendingFeedbackAction = (messageId: string) =>
  getAccountState().pendingFeedbackActions[messageId]

const isResummarizingMessage = (messageId: string) =>
  uiState.resummarizingMessageIds.includes(messageId)

const formatPriorityScoreBadge = (score: number) => {
  const normalized = Math.max(0, Math.min(score, 1))
  return `${Math.round(normalized * 100)}`
}

const renderStatusCards = () => {
  const roundFeedbackCount = getRoundFeedbackCount()

  return `
    <div class="lma-ext-status-grid">
      <div class="lma-ext-status-card is-success">
        <div class="lma-ext-status-card-icon">✓</div>
        <div class="lma-ext-status-card-copy">
          <strong>LLM已分析完成</strong>
          <span>${escapeHtml(uiState.syncMessage || '当前邮件结果已更新')}</span>
        </div>
      </div>
      <div class="lma-ext-status-card ${roundFeedbackCount > 0 ? 'is-accent' : 'is-muted'}">
        <div class="lma-ext-status-card-icon">${roundFeedbackCount}</div>
        <div class="lma-ext-status-card-copy">
          <strong>此轮已记录${roundFeedbackCount}条反馈</strong>
          <span>按“重新分析”训练模型</span>
        </div>
      </div>
    </div>
  `
}

const getHistoryPreviewSenders = () =>
  buildSenderHistory(getAccountState())
    .slice(0, 5)
    .map((entry) => ({
    senderName: entry.senderName,
    count: entry.count,
    active: getAccountState().vipSenders.includes(entry.senderName),
  }))

const getAvailableFocuses = (accountState: AccountState) =>
  dedupeStrings([...DEFAULT_FOCUS_ORDER, ...accountState.customFocusItems, ...accountState.focusOrder])

const getFocusOrderIndex = (accountState: AccountState, focus: string) =>
  accountState.focusOrder.findIndex((value) => value === focus)

const renderSyncBanner = () => {
  if (uiState.isSyncing) {
    return `
      <div class="lma-ext-sync-banner loading">
        <div class="lma-ext-sync-banner-visual" aria-hidden="true">
          <div class="lma-ext-sync-banner-robot">🤖</div>
          <div class="lma-ext-sync-ring"></div>
        </div>
        <div class="lma-ext-sync-banner-copy">
          <strong>思考中，正在分析...</strong>
          <p>${escapeHtml(uiState.syncMessage || '正在读取 Gmail、补全上下文并整理展示结果')}</p>
        </div>
      </div>
    `
  }

  if (uiState.requiresAuth) {
    return `
      <div class="lma-ext-sync-banner auth">
        <strong>需要连接 Gmail</strong>
        <p>${escapeHtml(uiState.syncError || '当前还没有 Gmail 授权，请先连接 Gmail。')}</p>
        <div class="lma-ext-sync-actions">
          <button class="lma-ext-button primary" data-action="auth-gmail" type="button">连接 Gmail</button>
        </div>
      </div>
    `
  }

  if (uiState.syncError) {
    return `
      <div class="lma-ext-sync-banner error">
        <strong>同步失败</strong>
        <p>${escapeHtml(uiState.syncError)}</p>
        <div class="lma-ext-sync-actions">
          <button class="lma-ext-button secondary" data-action="refresh-analysis" type="button">重试同步</button>
        </div>
      </div>
    `
  }

  if (!getAccountState().lastPayload) {
    return `
      <div class="lma-ext-sync-banner info">
        <strong>等待开始分析</strong>
        <p>连接 Gmail 后即可生成当前轮整理结果。</p>
      </div>
    `
  }

  return renderStatusCards()
}

const renderSettingsPanel = () => {
  const accountState = getAccountState()
  const historyPreview = getHistoryPreviewSenders()
  const summaryText = `${accountState.vipSenders.length} 位重点寄件人 · ${accountState.focusOrder.length} 个已选关注项`
  const availableFocuses = getAvailableFocuses(accountState)

  return `
    <div class="lma-ext-filter-stack">
      <div class="lma-ext-sync-actions">
        <button class="lma-ext-button secondary" data-action="refresh-analysis" type="button">同步 Gmail</button>
        <button class="lma-ext-button ${accountState.needsReanalyze ? 'primary' : 'secondary'}" data-action="reanalyze" type="button">重新分析</button>
      </div>

      <section class="lma-ext-filter-card ${uiState.preferencesExpanded ? 'is-open' : ''}">
        <button class="lma-ext-filter-card-toggle" data-action="toggle-preferences" aria-expanded="${uiState.preferencesExpanded ? 'true' : 'false'}" type="button">
          <div class="lma-ext-filter-card-toggle-copy">
            <strong>偏好设置</strong>
            <span class="lma-ext-filter-card-summary">${escapeHtml(summaryText)}</span>
          </div>
          <span class="lma-ext-filter-card-arrow ${uiState.preferencesExpanded ? 'is-open' : ''}">⌄</span>
        </button>
        <div class="lma-ext-filter-card-content">
          <div class="lma-ext-filter-card-body">
            <div class="lma-ext-preference-panel">
              <section class="lma-ext-preference-group">
                <div class="lma-ext-preference-head">
                  <strong>重点寄件人</strong>
                </div>
                ${
                  historyPreview.length > 0
                    ? `
                      <div class="lma-ext-filter-choice-row">
                        ${historyPreview
                          .map(
                            (entry) => `
                              <button class="lma-ext-filter-check ${entry.active ? 'is-active' : ''}" data-action="toggle-vip-sender" data-value="${escapeHtml(entry.senderName)}" type="button">
                                <span>${escapeHtml(entry.senderName)}</span>
                                <em>${entry.count}</em>
                              </button>
                            `,
                          )
                          .join('')}
                      </div>
                    `
                    : ''
                }
                <div class="lma-ext-filter-input-row">
                  <input class="lma-ext-filter-input" data-action="custom-sender-input" placeholder="输入寄件人或邮箱" type="text" value="${escapeHtml(accountState.customSenderDraft)}" />
                  <button class="lma-ext-button secondary" data-action="add-vip-sender" type="button">添加</button>
                </div>
                ${
                  accountState.vipSenders.length > 0
                    ? `
                      <div class="lma-ext-setting-list">
                        ${accountState.vipSenders
                          .map(
                            (senderName) => `
                              <div class="lma-ext-setting-row">
                                <span>${escapeHtml(senderName)}</span>
                                <button class="lma-ext-chip-delete" data-action="remove-vip-sender" data-value="${escapeHtml(senderName)}" type="button">×</button>
                              </div>
                            `,
                          )
                          .join('')}
                      </div>
                    `
                    : '<div class="lma-ext-empty">还没有设置重点寄件人。</div>'
                }
              </section>

              <section class="lma-ext-preference-group">
                <div class="lma-ext-preference-head">
                  <strong>关注顺序</strong>
                  <div class="lma-ext-preference-head-actions">
                    <button class="lma-ext-button ghost" data-action="reset-focus-order" type="button" ${accountState.focusOrder.length === 0 ? 'disabled' : ''}>重置顺序</button>
                  </div>
                </div>
                <div class="lma-ext-filter-choice-row">
                  ${availableFocuses
                    .map(
                      (focus) => {
                        const orderIndex = getFocusOrderIndex(accountState, focus)
                        const isActive = orderIndex >= 0

                        return `
                          <button class="lma-ext-filter-check ${isActive ? 'is-active' : ''} ${!DEFAULT_FOCUS_ORDER.includes(focus) ? 'custom' : ''}" data-action="toggle-focus-option" data-value="${escapeHtml(focus)}" type="button">
                            ${isActive ? `<em class="lma-ext-filter-check-order">${orderIndex + 1}</em>` : ''}
                            <span>${escapeHtml(focus)}</span>
                          </button>
                        `
                      },
                    )
                    .join('')}
                </div>
                <div class="lma-ext-filter-input-row">
                  <input class="lma-ext-filter-input" data-action="custom-focus-input" placeholder="输入自定义关注内容" type="text" value="${escapeHtml(accountState.customFocusDraft)}" />
                  <button class="lma-ext-button secondary" data-action="add-focus" type="button">添加</button>
                </div>
                ${
                  accountState.customFocusItems.length > 0
                    ? `
                      <div class="lma-ext-setting-list">
                        ${accountState.customFocusItems
                          .map(
                            (focus) => `
                              <div class="lma-ext-setting-row is-compact">
                                <span>${escapeHtml(focus)}</span>
                                <button class="lma-ext-chip-delete" data-action="remove-custom-focus" data-value="${escapeHtml(focus)}" type="button">×</button>
                              </div>
                            `,
                          )
                          .join('')}
                      </div>
                    `
                    : ''
                }
              </section>
            </div>
          </div>
        </div>
      </section>
    </div>
  `
}

const renderBoardIcon = (boardType: LocalBoardType) => {
  switch (boardType) {
    case 'priority_content':
      return `
        <span class="lma-ext-overview-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 18V6"></path>
            <path d="M7 11L12 6L17 11"></path>
          </svg>
        </span>
      `
    case 'within_48h':
      return `
        <span class="lma-ext-overview-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="13" r="7"></circle>
            <path d="M12 13V9"></path>
            <path d="M12 13L15 15"></path>
            <path d="M9 4L6.5 6"></path>
            <path d="M15 4L17.5 6"></path>
          </svg>
        </span>
      `
    case 'todo':
      return `
        <span class="lma-ext-overview-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 17.5V20H6.5L17 9.5L14.5 7L4 17.5Z"></path>
            <path d="M13.5 8L16 10.5"></path>
          </svg>
        </span>
      `
    case 'completed_recent':
      return `
        <span class="lma-ext-overview-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M7 12.5L10.5 16L17 9.5"></path>
            <circle cx="12" cy="12" r="8"></circle>
          </svg>
        </span>
      `
    case 'ignore':
      return `
        <span class="lma-ext-overview-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M7 12H17"></path>
            <circle cx="12" cy="12" r="8"></circle>
          </svg>
        </span>
      `
  }

  return ''
}

const renderOverview = (items: SyncedMailItem[]) => {
  const counts = getOverviewCounts(items)
  const accountState = getAccountState()

  return `
    <div class="lma-ext-overview-grid">
      ${BOARD_ORDER.map(
        (boardType) => `
          <button class="lma-ext-overview-card ${accountState.activeTab === boardType ? 'is-active' : ''}" data-action="switch-tab" data-tab="${boardType}" data-board="${boardType}" type="button">
            <span class="lma-ext-overview-card-label">${renderBoardIcon(boardType)}<span>${getBoardLabel(boardType)}</span></span>
            <strong>${counts[boardType]}</strong>
          </button>
        `,
      ).join('')}
    </div>
  `
}

const renderReasonChips = (item: SyncedMailItem) => {
  const chips = dedupeStrings([
    item.actionLabel ?? '',
    item.deadlineLabel ?? '',
    ...item.displayExplanation.priorityReasonTags,
    ...item.customFeatureHits.slice(0, 2),
  ]).slice(0, 5)

  if (chips.length === 0) {
    return ''
  }

  return `
    <div class="lma-ext-card-side-group">
      ${chips
        .map((chip) => `<span class="lma-ext-chip lma-ext-chip-muted">${escapeHtml(chip)}</span>`)
        .join('')}
    </div>
  `
}

const renderFeedbackRow = (item: SyncedMailItem) => {
  const lastAction = getPendingFeedbackAction(item.messageId)
  const moreLabel =
    item.feedbackState.moreImportantCount > 0
      ? `更重要 · ${item.feedbackState.moreImportantCount}`
      : '更重要'
  const lessLabel =
    item.feedbackState.showLessCount > 0 ? `少显示 · ${item.feedbackState.showLessCount}` : '少显示'

  return `
    <div class="lma-ext-feedback-row ${lastAction ? 'is-confirmed' : ''}">
      <span class="lma-ext-feedback-label">反馈</span>
      <button class="lma-ext-feedback-chip ${lastAction === 'more_important' ? 'is-active' : ''}" data-action="feedback-more" data-message-id="${escapeHtml(item.messageId)}" type="button">${escapeHtml(moreLabel)}</button>
      <button class="lma-ext-feedback-chip ${lastAction === 'show_less' ? 'is-active' : ''}" data-action="feedback-less" data-message-id="${escapeHtml(item.messageId)}" type="button">${escapeHtml(lessLabel)}</button>
      ${
        lastAction
          ? `<span class="lma-ext-feedback-confirmation">本轮已加入反馈</span>`
          : ''
      }
    </div>
  `
}

const renderCard = (item: SyncedMailItem) => {
  const senderInfo = item.displaySender || item.senderName
  const briefSubject = normalizeBriefSubjectDisplay(item.briefSubject || item.subject)
  const isSummaryRefreshing = isResummarizingMessage(item.messageId)
  const completionState = getCompletionVisualState(item.messageId)
  const isCompleted = completionState !== 'none'
  const completeButtonLabel = isCompleted ? '恢复为未完成' : '已完成'
  const completeButtonClass = isCompleted ? 'secondary' : 'ghost'

  return `
    <article class="lma-ext-card ${isCompleted ? 'is-completed' : ''} ${completionState === 'pending' ? 'is-completion-pending' : ''} ${completionState === 'removing' ? 'is-removing' : ''}" data-card-id="mail:${escapeHtml(item.messageId)}">
      <div class="lma-ext-card-layout">
        <div class="lma-ext-card-main">
          <div class="lma-ext-card-head">
            <div class="lma-ext-card-title">
              <span class="lma-ext-priority level-${item.priorityLevel}" title="本地模型优先级分数">${formatPriorityScoreBadge(item.priorityScore)}</span>
              <div class="lma-ext-card-title-copy">
                <strong>${escapeHtml(senderInfo)}</strong>
                <h4>${escapeHtml(briefSubject)}</h4>
              </div>
            </div>
            <span class="lma-ext-time">${escapeHtml(item.timeText ?? '最近')}</span>
          </div>
          <div class="lma-ext-ai-block">
            <p class="lma-ext-ai-summary">${escapeHtml(item.aiSummary)}</p>
          </div>
        </div>
        <aside class="lma-ext-card-side">
          <div class="lma-ext-card-side-group">
            <span class="lma-ext-chip lma-ext-chip-accent">${escapeHtml(PRIORITY_LABELS[item.priorityLevel])}</span>
            <span class="lma-ext-chip lma-ext-chip-muted">${escapeHtml(BOARD_LABELS[item.boardType])}</span>
          </div>
          ${renderReasonChips(item)}
        </aside>
      </div>
      <div class="lma-ext-actions">
        <button class="lma-ext-button primary" data-action="open-original" data-message-id="${escapeHtml(item.messageId)}" type="button">查看原邮件</button>
        <button class="lma-ext-button ghost" data-action="refresh-summary" data-message-id="${escapeHtml(item.messageId)}" type="button" ${isSummaryRefreshing ? 'disabled' : ''}>${isSummaryRefreshing ? '概述中…' : '重新概述'}</button>
        <button class="lma-ext-button ${completeButtonClass}" data-action="toggle-completed" data-message-id="${escapeHtml(item.messageId)}" type="button">${completeButtonLabel}</button>
      </div>
      ${renderFeedbackRow(item)}
    </article>
  `
}

const renderBundleCard = (bundle: Extract<BoardRenderEntry, { kind: 'bundle' }>) => {
  const expanded = isBundleExpanded(bundle.key)
  const briefSubject = normalizeBriefSubjectDisplay(bundle.briefSubject)

  return `
    <article class="lma-ext-card lma-ext-bundle-card ${expanded ? 'is-expanded' : ''}" data-card-id="bundle:${escapeHtml(bundle.key)}">
      <div class="lma-ext-card-layout">
        <div class="lma-ext-card-main">
          <div class="lma-ext-card-head">
            <div class="lma-ext-card-title">
              <span class="lma-ext-priority level-${bundle.priorityLevel}" title="聚合后的优先级参考">${formatPriorityScoreBadge(bundle.priorityScore)}</span>
              <div class="lma-ext-card-title-copy">
                <strong>${escapeHtml(bundle.displaySender)}</strong>
                <h4>${escapeHtml(briefSubject)}</h4>
              </div>
            </div>
            <span class="lma-ext-time">${escapeHtml(bundle.timeText)}</span>
          </div>
          <div class="lma-ext-ai-block">
            <p class="lma-ext-ai-summary">${escapeHtml(bundle.aiSummary)}</p>
          </div>
        </div>
        <aside class="lma-ext-card-side">
          <div class="lma-ext-card-side-group">
            <span class="lma-ext-chip lma-ext-chip-accent">已合并 ${bundle.items.length} 封</span>
            <span class="lma-ext-chip lma-ext-chip-muted">${escapeHtml(getBoardLabel(bundle.boardType))}</span>
          </div>
          ${
            bundle.reasonTags.length > 0
              ? `
                <div class="lma-ext-card-side-group">
                  ${bundle.reasonTags
                    .map(
                      (tag) =>
                        `<span class="lma-ext-chip lma-ext-chip-muted">${escapeHtml(tag)}</span>`,
                    )
                    .join('')}
                </div>
              `
              : ''
          }
        </aside>
      </div>
      <div class="lma-ext-actions">
        <button class="lma-ext-button ghost" data-action="toggle-bundle" data-bundle-key="${escapeHtml(bundle.key)}" type="button">${expanded ? '收起具体邮件' : '展开具体邮件'}</button>
      </div>
      ${
        expanded
          ? `
            <div class="lma-ext-bundle-preview is-expanded">
              ${bundle.items.map((item) => renderCard(item)).join('')}
            </div>
          `
          : ''
      }
    </article>
  `
}

const renderBoardSection = (items: SyncedMailItem[]) => {
  const activeBoard = getAccountState().activeTab
  const boardItems = getItemsForBoard(items, activeBoard)
  const renderEntries = getBoardRenderEntries(boardItems, activeBoard)

  return `
    <section class="lma-ext-section">
      <header class="lma-ext-section-head">
        <h3>${escapeHtml(getBoardLabel(activeBoard))}</h3>
        <span class="lma-ext-count">${boardItems.length}</span>
      </header>
      <div class="lma-ext-stack">
        ${
          renderEntries.length > 0
            ? renderEntries
                .map((entry) => (entry.kind === 'bundle' ? renderBundleCard(entry) : renderCard(entry.item)))
                .join('')
            : '<div class="lma-ext-empty">当前板块暂无邮件。</div>'
        }
      </div>
    </section>
  `
}

const renderPanel = () => {
  const items = getCurrentItems()

  return `
    <div class="lma-ext-shell ${uiState.isOpen ? 'is-open' : ''}">
      <button class="lma-ext-launcher" data-action="toggle-panel" type="button">
        <span class="lma-ext-launcher-icon">AI</span>
        <span class="lma-ext-launcher-copy">重点助手</span>
      </button>
      <aside class="lma-ext-panel ${uiState.isOpen ? 'is-open' : ''}">
        <header class="lma-ext-header">
          <div>
            <div class="lma-ext-title-row">
              <h2>邮箱整理助手</h2>
              <span class="lma-ext-title-meta">${escapeHtml(formatSyncMeta())}</span>
            </div>
          </div>
          <button class="lma-ext-close" data-action="close-panel" type="button">×</button>
        </header>
        <div class="lma-ext-panel-body">
          ${renderSyncBanner()}
          ${renderSettingsPanel()}
          ${renderOverview(items)}
          <div class="lma-ext-content-shell">
            <div class="lma-ext-content">
              ${renderBoardSection(items)}
            </div>
          </div>
        </div>
      </aside>
    </div>
  `
}

const LIQUID_GROUP_SELECTORS = [
  '.lma-ext-header',
  '.lma-ext-sync-actions',
  '.lma-ext-filter-choice-row',
  '.lma-ext-filter-input-row',
  '.lma-ext-preference-head-actions',
  '.lma-ext-overview-grid',
  '.lma-ext-actions',
  '.lma-ext-feedback-row',
  '.lma-ext-setting-list',
]

const setLiquidPointerVars = (element: HTMLElement, clientX: number, clientY: number) => {
  const rect = element.getBoundingClientRect()
  element.style.setProperty('--glass-x', `${clientX - rect.left}px`)
  element.style.setProperty('--glass-y', `${clientY - rect.top}px`)
}

const bindStandaloneLiquidTarget = (target: HTMLButtonElement) => {
  if (target.dataset.liquidBound === 'true') {
    return
  }

  target.dataset.liquidBound = 'true'
  target.classList.add('lma-ext-liquid-target')

  const activate = (event: PointerEvent) => {
    if (target.disabled) {
      return
    }

    setLiquidPointerVars(target, event.clientX, event.clientY)
    target.classList.add('is-liquid-hovered')
  }

  target.addEventListener('pointerenter', activate)
  target.addEventListener('pointermove', activate)
  target.addEventListener('pointerleave', () => {
    target.classList.remove('is-liquid-hovered')
  })
}

const bindLiquidGroup = (group: HTMLElement) => {
  if (group.dataset.liquidBound === 'true') {
    return
  }

  group.dataset.liquidBound = 'true'
  group.classList.add('lma-ext-liquid-group')

  const indicator = document.createElement('span')
  indicator.className = 'lma-ext-liquid-indicator'
  group.prepend(indicator)

  const targets = () =>
    Array.from(group.querySelectorAll<HTMLButtonElement>('button.lma-ext-liquid-target')).filter(
      (target) => !target.disabled,
    )

  const clear = () => {
    indicator.style.opacity = '0'
    targets().forEach((target) => target.classList.remove('is-liquid-hovered'))
  }

  const activate = (target: HTMLButtonElement, event: PointerEvent) => {
    const groupRect = group.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()

    targets().forEach((item) => item.classList.toggle('is-liquid-hovered', item === target))

    indicator.style.opacity = '1'
    indicator.style.width = `${targetRect.width}px`
    indicator.style.height = `${targetRect.height}px`
    indicator.style.borderRadius = getComputedStyle(target).borderRadius
    indicator.style.transform = `translate(${targetRect.left - groupRect.left}px, ${targetRect.top - groupRect.top}px)`

    indicator.style.setProperty('--glass-x', `${event.clientX - targetRect.left}px`)
    indicator.style.setProperty('--glass-y', `${event.clientY - targetRect.top}px`)
    setLiquidPointerVars(target, event.clientX, event.clientY)
  }

  group.addEventListener('pointermove', (event) => {
    const eventTarget = event.target
    if (!(eventTarget instanceof HTMLElement)) {
      return
    }

    const target = eventTarget.closest<HTMLButtonElement>('button.lma-ext-liquid-target')
    if (!target || !group.contains(target) || target.disabled) {
      return
    }

    activate(target, event)
  })

  group.addEventListener('pointerleave', clear)
}

const wireLiquidGlass = () => {
  if (!rootElement) {
    return
  }

  const buttons = Array.from(rootElement.querySelectorAll<HTMLButtonElement>('button'))
  buttons.forEach((button) => button.classList.add('lma-ext-liquid-target'))

  rootElement
    .querySelectorAll<HTMLElement>(LIQUID_GROUP_SELECTORS.join(','))
    .forEach((group) => bindLiquidGroup(group))

  buttons
    .filter((button) => !button.closest('.lma-ext-liquid-group'))
    .forEach((button) => bindStandaloneLiquidTarget(button))
}

const wireScrollShadow = () => {
  if (!rootElement) {
    return
  }

  const shell = rootElement.querySelector<HTMLElement>('.lma-ext-content-shell')
  const content = rootElement.querySelector<HTMLElement>('.lma-ext-content')

  if (!shell || !content) {
    return
  }

  const syncShadow = () => {
    uiState.contentScrollTop = content.scrollTop
    shell.classList.toggle('is-scrolled', content.scrollTop > 6)
  }

  content.addEventListener('scroll', syncShadow, { passive: true })
  syncShadow()
}

const captureViewportSnapshot = (): ViewportSnapshot | null => {
  if (!rootElement) {
    return null
  }

  const content = rootElement.querySelector<HTMLElement>('.lma-ext-content')
  if (!content) {
    return null
  }

  const contentRect = content.getBoundingClientRect()
  const cardLayouts = new Map<string, CardLayoutSnapshot>()
  let anchorCardId: string | null = null
  let anchorOffset = 0

  content.querySelectorAll<HTMLElement>('[data-card-id]').forEach((card) => {
    const cardId = card.dataset.cardId
    if (!cardId) {
      return
    }

    const rect = card.getBoundingClientRect()
    cardLayouts.set(cardId, { top: rect.top, left: rect.left })

    if (anchorCardId === null && rect.bottom > contentRect.top + 8) {
      anchorCardId = cardId
      anchorOffset = rect.top - contentRect.top
    }
  })

  return {
    scrollTop: content.scrollTop,
    anchorCardId,
    anchorOffset,
    cardLayouts,
  }
}

const snapshotContentScrollTop = () => {
  const snapshot = captureViewportSnapshot()
  if (!snapshot) {
    return
  }

  uiState.contentScrollTop = snapshot.scrollTop
  pendingViewportSnapshot = snapshot
}

const restoreViewportSnapshot = (snapshot: ViewportSnapshot | null) => {
  if (!rootElement || !snapshot) {
    return
  }

  const content = rootElement.querySelector<HTMLElement>('.lma-ext-content')
  if (!content) {
    return
  }

  const applyScroll = () => {
    let nextScrollTop = snapshot.scrollTop

    if (snapshot.anchorCardId) {
      const anchor = Array.from(content.querySelectorAll<HTMLElement>('[data-card-id]')).find(
        (card) => card.dataset.cardId === snapshot.anchorCardId,
      )

      if (anchor) {
        const contentRect = content.getBoundingClientRect()
        const currentOffset = anchor.getBoundingClientRect().top - contentRect.top
        nextScrollTop += currentOffset - snapshot.anchorOffset
      }
    }

    content.scrollTop = Math.max(0, nextScrollTop)
    uiState.contentScrollTop = content.scrollTop
  }

  applyScroll()
  globalThis.requestAnimationFrame(applyScroll)
}

const animateCardLayoutChanges = (snapshot: ViewportSnapshot | null) => {
  if (!rootElement || !snapshot) {
    return
  }

  const content = rootElement.querySelector<HTMLElement>('.lma-ext-content')
  if (!content) {
    return
  }

  globalThis.requestAnimationFrame(() => {
    content.querySelectorAll<HTMLElement>('[data-card-id]').forEach((card) => {
      if (card.classList.contains('is-removing')) {
        return
      }

      const cardId = card.dataset.cardId
      if (!cardId) {
        return
      }

      const previous = snapshot.cardLayouts.get(cardId)
      if (!previous) {
        return
      }

      const rect = card.getBoundingClientRect()
      const deltaX = previous.left - rect.left
      const deltaY = previous.top - rect.top
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return
      }

      card.classList.add('is-layout-animating')
      card.style.transition = 'none'
      card.style.transform = `translate(${deltaX}px, ${deltaY}px)`
      card.style.willChange = 'transform'

      globalThis.requestAnimationFrame(() => {
        let cleaned = false
        const cleanup = () => {
          if (cleaned) {
            return
          }
          cleaned = true
          card.classList.remove('is-layout-animating')
          card.style.transition = ''
          card.style.transform = ''
          card.style.willChange = ''
        }

        card.style.transition = 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1)'
        card.style.transform = 'translate(0, 0)'
        card.addEventListener('transitionend', cleanup, { once: true })
        globalThis.setTimeout(cleanup, 640)
      })
    })
  })
}

const applyPreferencesExpandedState = (expanded: boolean) => {
  if (!rootElement) {
    return
  }

  const card = rootElement.querySelector<HTMLElement>('.lma-ext-filter-card')
  const arrow = rootElement.querySelector<HTMLElement>('.lma-ext-filter-card-arrow')
  const toggle = rootElement.querySelector<HTMLElement>('.lma-ext-filter-card-toggle')

  card?.classList.toggle('is-open', expanded)
  arrow?.classList.toggle('is-open', expanded)
  toggle?.setAttribute('aria-expanded', expanded ? 'true' : 'false')
}

const render = () => {
  if (!rootElement) {
    return
  }

  renderScheduled = false
  const viewportSnapshot = pendingViewportSnapshot ?? captureViewportSnapshot()
  if (viewportSnapshot) {
    uiState.contentScrollTop = viewportSnapshot.scrollTop
  }
  pendingViewportSnapshot = null
  normalizeCompletedMailStates()
  rootElement.innerHTML = renderPanel()
  const nextContent = rootElement.querySelector<HTMLElement>('.lma-ext-content')
  if (nextContent && viewportSnapshot) {
    nextContent.scrollTop = viewportSnapshot.scrollTop
  }
  applyPreferencesExpandedState(uiState.preferencesExpanded)
  wireLiquidGlass()
  wireScrollShadow()
  restoreViewportSnapshot(viewportSnapshot)
  animateCardLayoutChanges(viewportSnapshot)
}

const scheduleRender = () => {
  if (renderScheduled) {
    return
  }

  renderScheduled = true
  globalThis.requestAnimationFrame(render)
}

const ensureMounted = () => {
  const existingRoot = document.getElementById(ROOT_ID)
  if (existingRoot instanceof HTMLElement) {
    rootElement = existingRoot
    return
  }

  rootElement = document.createElement('div')
  rootElement.id = ROOT_ID
  document.body.appendChild(rootElement)
}

const bindRootListeners = () => {
  if (!rootElement || rootElement.dataset.bound === 'true') {
    return
  }

  rootElement.dataset.bound = 'true'
  rootElement.addEventListener('click', (event) => {
    void handleClick(event)
  })
  rootElement.addEventListener('input', handleInput)
}

const findItemByMessageId = (messageId: string) =>
  getCurrentItems().find((item) => item.messageId === messageId)

const handleClick = async (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof HTMLElement)) {
    return
  }

  const actionElement = target.closest<HTMLElement>('[data-action]')
  if (!actionElement) {
    return
  }

  const action = actionElement.dataset.action
  if (!action) {
    return
  }

  if (!['toggle-panel', 'close-panel', 'switch-tab', 'reanalyze'].includes(action)) {
    snapshotContentScrollTop()
  }

  if (action === 'toggle-panel') {
    uiState.isOpen = !uiState.isOpen
    scheduleRender()

    if (uiState.isOpen && getCurrentItems().length === 0 && uiState.authChecked && !uiState.requiresAuth) {
      void syncAnalysis('incremental')
    }
    return
  }

  if (action === 'close-panel') {
    uiState.isOpen = false
    scheduleRender()
    return
  }

  if (action === 'switch-tab') {
    const boardType = actionElement.dataset.tab as LocalBoardType | undefined
    if (boardType) {
      getAccountState().activeTab = boardType
      savePersistedState()
      scheduleRender()
    }
    return
  }

  if (action === 'toggle-bundle') {
    const bundleKey = actionElement.dataset.bundleKey
    if (!bundleKey) {
      return
    }

    uiState.expandedBundleKeys = uiState.expandedBundleKeys.includes(bundleKey)
      ? uiState.expandedBundleKeys.filter((currentKey) => currentKey !== bundleKey)
      : dedupeStrings([...uiState.expandedBundleKeys, bundleKey])
    scheduleRender()
    return
  }

  if (action === 'toggle-preferences') {
    uiState.preferencesExpanded = !uiState.preferencesExpanded
    applyPreferencesExpandedState(uiState.preferencesExpanded)
    return
  }

  if (action === 'auth-gmail') {
    uiState.syncError = ''
    uiState.syncMessage = '正在请求 Gmail 授权…'
    scheduleRender()

    const response = await sendRuntimeMessage({ type: 'LMA_AUTH_GMAIL' })
    hydrateAfterRuntimeResponse(response)
    uiState.authChecked = true
    uiState.requiresAuth = Boolean(response.requiresAuth && !response.ok)
    uiState.syncError = response.ok ? '' : response.error ?? 'Gmail 授权失败。'
    uiState.syncMessage = response.message ?? uiState.syncMessage

    if (response.ok) {
      await loadPreferencesFromBackend()
      await syncAnalysis('incremental')
      return
    }

    scheduleRender()
    return
  }

  if (action === 'refresh-analysis') {
    void syncAnalysis('incremental')
    return
  }

  if (action === 'reanalyze') {
    void syncAnalysis('full_reanalyze')
    return
  }

  if (action === 'open-original') {
    const messageId = actionElement.dataset.messageId
    if (!messageId) {
      return
    }

    const item = findItemByMessageId(messageId)
    if (item) {
      openOriginalMail(item)
    }
    return
  }

  if (action === 'refresh-summary') {
    const messageId = actionElement.dataset.messageId
    if (!messageId) {
      return
    }

    const item = findItemByMessageId(messageId)
    if (item) {
      await refreshMailSummary(item)
    }
    return
  }

  if (action === 'toggle-completed') {
    const messageId = actionElement.dataset.messageId
    if (!messageId) {
      return
    }

    if (getCompletedMailState(messageId)) {
      restoreMailToIncomplete(messageId)
      return
    }

    const item = findItemByMessageId(messageId)
    if (item) {
      markMailCompleted(item)
    }
    return
  }

  if (action === 'feedback-more' || action === 'feedback-less') {
    const messageId = actionElement.dataset.messageId
    if (!messageId) {
      return
    }

    const item = findItemByMessageId(messageId)
    if (item) {
      await recordFeedback(item, action === 'feedback-more' ? 'more_important' : 'show_less')
    }
    return
  }

  if (action === 'toggle-vip-sender') {
    const senderName = actionElement.dataset.value
    if (!senderName) {
      return
    }

    await mutateAccountState((accountState) => {
      accountState.vipSenders = accountState.vipSenders.includes(senderName)
        ? accountState.vipSenders.filter((value) => value !== senderName)
        : dedupeStrings([...accountState.vipSenders, senderName])
    }, '重点寄件人已更新，重新分析后生效。')
    return
  }

  if (action === 'remove-vip-sender') {
    const senderName = actionElement.dataset.value
    if (!senderName) {
      return
    }

    await mutateAccountState((accountState) => {
      accountState.vipSenders = accountState.vipSenders.filter((value) => value !== senderName)
    }, '重点寄件人已更新，重新分析后生效。')
    return
  }

  if (action === 'add-vip-sender') {
    const senderName = getAccountState().customSenderDraft.trim()
    if (!senderName) {
      return
    }

    await mutateAccountState((accountState) => {
      accountState.vipSenders = dedupeStrings([...accountState.vipSenders, senderName])
      accountState.customSenderDraft = ''
    }, '重点寄件人已更新，重新分析后生效。')
    return
  }

  if (action === 'toggle-focus-option') {
    const focus = actionElement.dataset.value
    if (!focus) {
      return
    }

    await mutateAccountState((accountState) => {
      accountState.focusOrder = accountState.focusOrder.includes(focus)
        ? accountState.focusOrder.filter((value) => value !== focus)
        : dedupeStrings([...accountState.focusOrder, focus])
      if (!DEFAULT_FOCUS_ORDER.includes(focus)) {
        accountState.customFocusItems = dedupeStrings([...accountState.customFocusItems, focus])
      }
    }, '关注顺序已更新，重新分析后生效。')
    return
  }

  if (action === 'reset-focus-order') {
    await mutateAccountState((accountState) => {
      accountState.focusOrder = []
    }, '关注顺序已重置，重新分析后生效。')
    return
  }

  if (action === 'add-focus') {
    const focus = getAccountState().customFocusDraft.trim()
    if (!focus) {
      return
    }

    await mutateAccountState((accountState) => {
      accountState.customFocusItems = dedupeStrings([...accountState.customFocusItems, focus])
      accountState.focusOrder = dedupeStrings([...accountState.focusOrder, focus])
      accountState.customFocusDraft = ''
    }, '关注顺序已更新，重新分析后生效。')
    return
  }

  if (action === 'remove-custom-focus') {
    const focus = actionElement.dataset.value
    if (!focus) {
      return
    }

    await mutateAccountState((accountState) => {
      accountState.focusOrder = accountState.focusOrder.filter((value) => value !== focus)
      accountState.customFocusItems = accountState.customFocusItems.filter((value) => value !== focus)
    }, '关注顺序已更新，重新分析后生效。')
    return
  }
}

const handleInput = (event: Event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }

  const action = target.dataset.action
  if (action === 'custom-sender-input') {
    getAccountState().customSenderDraft = target.value
    savePersistedState()
    return
  }

  if (action === 'custom-focus-input') {
    getAccountState().customFocusDraft = target.value
    savePersistedState()
  }
}

const checkAuthState = async () => {
  const response = await sendRuntimeMessage({ type: 'LMA_GET_GMAIL_AUTH_STATE' })

  hydrateAfterRuntimeResponse(response)
  uiState.authChecked = true
  uiState.requiresAuth = Boolean(response.requiresAuth && !response.ok)
  uiState.syncError = response.ok ? '' : response.error ?? ''
  uiState.syncMessage = response.message ?? '准备读取 Gmail 邮件…'

  if (response.ok) {
    await loadPreferencesFromBackend()
    await syncAnalysis('incremental')
    return
  }

  scheduleRender()
}

const bootstrap = () => {
  setActiveAccountKey(persistedState.lastAccountKey || DEFAULT_ACCOUNT_KEY)
  ensureMounted()
  bindRootListeners()

  chromeApi?.runtime?.onMessage?.addListener(
    (message: RuntimeMessage, sender, sendResponse: (response: RuntimeResponse) => void) => {
      void sender

      if (message.type === 'LMA_TOGGLE_PANEL') {
        uiState.isOpen = !uiState.isOpen
        ensureMounted()
        scheduleRender()

        if (uiState.isOpen && getCurrentItems().length === 0 && uiState.authChecked && !uiState.requiresAuth) {
          void syncAnalysis('incremental')
        }

        sendResponse({
          ok: true,
          message: uiState.isOpen ? '已打开 Gmail 助手。' : '已收起 Gmail 助手。',
        })
      }
    },
  )

  globalThis.setInterval(() => {
    if (!document.getElementById(ROOT_ID)) {
      rootElement = null
      ensureMounted()
      bindRootListeners()
      scheduleRender()
    }
  }, 2500)

  scheduleRender()
  void checkAuthState()
}

if (window.__LMA_EXTENSION_RUNTIME__) {
  window.__LMA_EXTENSION_RUNTIME__.ensureMounted()
} else {
  window.__LMA_EXTENSION_RUNTIME__ = {
    ensureMounted: () => {
      ensureMounted()
      bindRootListeners()
      scheduleRender()
    },
    togglePanel: () => {
      uiState.isOpen = !uiState.isOpen
      ensureMounted()
      bindRootListeners()
      scheduleRender()
    },
  }

  bootstrap()
}
