import { API_BASE_URL, GMAIL_INBOX_URL, GMAIL_READONLY_SCOPE, chromeApi } from './chrome'
import type {
  FeedbackPayload,
  RawMessagePayload,
  RuntimeMessage,
  RuntimeResponse,
  SummaryRefreshPayload,
  SyncAnalysisPayload,
  SyncContext,
} from './chrome'

type BrowserTab = {
  id?: number
  url?: string
}

type GmailListResponse = {
  messages?: Array<{
    id: string
    threadId: string
  }>
}

type GmailProfileResponse = {
  emailAddress?: string
}

type GmailHeader = {
  name?: string
  value?: string
}

type GmailPayloadPart = {
  mimeType?: string
  filename?: string
  body?: {
    data?: string
  }
  headers?: GmailHeader[]
  parts?: GmailPayloadPart[]
}

type GmailMessageResponse = {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  payload?: GmailPayloadPart
}

type GmailThreadResponse = {
  id: string
  messages?: Array<{
    id: string
  }>
}

type FeedbackApiResponse = {
  recordedAt: string
  moreImportantCount: number
  showLessCount: number
}

type ResummaryApiResponse = SummaryRefreshPayload

const GMAIL_SYNC_LIMIT = Math.max(25, Number(import.meta.env.VITE_GMAIL_SYNC_LIMIT ?? '100'))
const GMAIL_FETCH_CONCURRENCY = 4
const GMAIL_FETCH_RETRY_LIMIT = 3

const normalizeGoogleClientId = (value?: string) => {
  if (!value) {
    return ''
  }

  return value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/(\.apps\.googleusercontent\.com)+$/i, '.apps.googleusercontent.com')
}

const GOOGLE_CLIENT_ID = normalizeGoogleClientId(
  chromeApi?.runtime?.getManifest?.().oauth2?.client_id ??
    import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ??
    '',
)

const isGmailUrl = (url?: string) => Boolean(url?.startsWith('https://mail.google.com/'))

const hasGoogleOAuthConfig = () =>
  Boolean(GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith('REPLACE_WITH_'))

const injectAssistantIntoTab = (tabId: number) =>
  new Promise<void>((resolve, reject) => {
    chromeApi?.scripting?.insertCSS(
      {
        target: { tabId },
        files: ['content.css'],
      },
      () => {
        const insertCssError = chromeApi?.runtime?.lastError?.message

        if (insertCssError) {
          reject(new Error(insertCssError))
          return
        }

        chromeApi?.scripting?.executeScript(
          {
            target: { tabId },
            files: ['content.js'],
          },
          () => {
            const executeScriptError = chromeApi?.runtime?.lastError?.message

            if (executeScriptError) {
              reject(new Error(executeScriptError))
              return
            }

            resolve()
          },
        )
      },
    )
  })

const sendMessageToTab = (tabId: number, message: RuntimeMessage) =>
  new Promise<RuntimeResponse>((resolve, reject) => {
    chromeApi?.tabs?.sendMessage(tabId, message, (response) => {
      const lastError = chromeApi?.runtime?.lastError?.message

      if (lastError) {
        reject(new Error(lastError))
        return
      }

      resolve(
        response ?? {
          ok: true,
          message: '宸插垏鎹?Gmail 鍙充晶鍔╂墜銆?,
        },
      )
    })
  })

const ensureInjectedAndToggle = async (tabId: number) => {
  try {
    return await sendMessageToTab(tabId, { type: 'LMA_TOGGLE_PANEL' })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (!errorMessage.includes('Receiving end does not exist')) {
      throw error
    }

    await injectAssistantIntoTab(tabId)
    return sendMessageToTab(tabId, { type: 'LMA_TOGGLE_PANEL' })
  }
}

const openGmailTab = () => {
  chromeApi?.tabs?.create({ url: GMAIL_INBOX_URL })
}

const toggleAssistantForTab = async (tab?: BrowserTab): Promise<RuntimeResponse> => {
  if (!tab?.id) {
    return {
      ok: false,
      error: '娌℃湁妫€娴嬪埌褰撳墠娲诲姩鏍囩椤点€?,
    }
  }

  if (!isGmailUrl(tab.url)) {
    openGmailTab()
    return {
      ok: true,
      message: '褰撳墠涓嶆槸 Gmail锛屽凡涓轰綘鎵撳紑 Gmail銆?,
    }
  }

  try {
    return await ensureInjectedAndToggle(tab.id)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      error: `鏆傛椂鏃犳硶杩炴帴 Gmail 椤甸潰锛?{errorMessage}`,
    }
  }
}

const toggleAssistantForActiveTab = (sendResponse: (response: RuntimeResponse) => void) => {
  chromeApi?.tabs?.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
    try {
      sendResponse(await toggleAssistantForTab(tabs[0]))
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })
}

const respondWithTask = (
  sendResponse: (response: RuntimeResponse) => void,
  task: Promise<RuntimeResponse>,
) => {
  task
    .then(sendResponse)
    .catch((error) => {
      console.error('Mail assistant background task failed:', error)
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    })
}

const getAuthToken = (interactive: boolean) =>
  new Promise<string>((resolve, reject) => {
    if (!chromeApi?.identity?.getAuthToken) {
      reject(new Error('褰撳墠鐜涓嶆敮鎸?Chrome Identity API銆?))
      return
    }

    chromeApi.identity.getAuthToken(
      {
        interactive,
        scopes: [GMAIL_READONLY_SCOPE],
      },
      (token) => {
        const lastError = chromeApi?.runtime?.lastError?.message

        if (lastError) {
          reject(new Error(lastError))
          return
        }

        if (!token) {
          reject(new Error('鏈幏鍙栧埌 Gmail 鎺堟潈浠ょ墝銆?))
          return
        }

        resolve(token)
      },
    )
  })

const sleep = (ms: number) => new Promise((resolve) => globalThis.setTimeout(resolve, ms))

const isRetryableGmailError = (status: number) => status === 429 || status >= 500

const gmailFetch = async <T>(token: string, path: string, attempt = 0): Promise<T> => {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()

    if (attempt < GMAIL_FETCH_RETRY_LIMIT && isRetryableGmailError(response.status)) {
      await sleep(400 * 2 ** attempt)
      return gmailFetch<T>(token, path, attempt + 1)
    }

    throw new Error(`Gmail API ${response.status}: ${text}`)
  }

  return (await response.json()) as T
}

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) => {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= items.length) {
        return
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => worker()),
  )

  return results
}

const decodeBase64Url = (value?: string) => {
  if (!value) {
    return ''
  }

  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padding = '='.repeat((4 - (base64.length % 4 || 4)) % 4)

  try {
    return decodeURIComponent(
      Array.from(globalThis.atob(base64 + padding))
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
  } catch {
    return globalThis.atob(base64 + padding)
  }
}

const stripHtml = (value: string) =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const extractBodyText = (payload?: GmailPayloadPart): string => {
  if (!payload) {
    return ''
  }

  const directText =
    payload.body?.data && payload.mimeType === 'text/plain'
      ? decodeBase64Url(payload.body.data)
      : payload.body?.data && payload.mimeType === 'text/html'
        ? stripHtml(decodeBase64Url(payload.body.data))
        : ''

  if (directText) {
    return directText
  }

  for (const part of payload.parts ?? []) {
    const partText = extractBodyText(part)
    if (partText) {
      return partText
    }
  }

  if (payload.body?.data) {
    return stripHtml(decodeBase64Url(payload.body.data))
  }

  return ''
}

const hasAttachment = (payload?: GmailPayloadPart): boolean => {
  if (!payload) {
    return false
  }

  if ((payload.filename ?? '').trim().length > 0) {
    return true
  }

  return (payload.parts ?? []).some((part) => hasAttachment(part))
}

const getHeaderValue = (payload: GmailPayloadPart | undefined, name: string) =>
  payload?.headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

const parseSender = (fromHeader: string) => {
  const match = fromHeader.match(/^(.*?)(?:\s*<([^>]+)>)?$/)
  const senderName = match?.[1]?.replace(/^"|"$/g, '').trim() || fromHeader
  const senderEmail = match?.[2]?.trim() || undefined

  return {
    senderName: senderName || senderEmail || '鏈煡鍙戜欢浜?,
    senderEmail,
  }
}

const formatTimeText = (value?: string) => {
  if (!value) {
    return '鏈€杩?
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const resolveTimestamp = (message: GmailMessageResponse, dateHeader: string) => {
  if (message.internalDate) {
    const internalDate = new Date(Number(message.internalDate))
    if (!Number.isNaN(internalDate.getTime())) {
      return internalDate.toISOString()
    }
  }

  const headerDate = new Date(dateHeader)
  if (!Number.isNaN(headerDate.getTime())) {
    return headerDate.toISOString()
  }

  return undefined
}

const toRawMessagePayload = (
  message: GmailMessageResponse,
  threadMessageCount: number,
): RawMessagePayload => {
  const fromHeader = getHeaderValue(message.payload, 'From')
  const subject = getHeaderValue(message.payload, 'Subject') || '(鏃犳爣棰橀偖浠?'
  const dateHeader = getHeaderValue(message.payload, 'Date')
  const bodyText = extractBodyText(message.payload)
  const summary = message.snippet?.trim() || bodyText.slice(0, 220)
  const { senderName, senderEmail } = parseSender(fromHeader)
  const labelIds = message.labelIds ?? []
  const timestamp = resolveTimestamp(message, dateHeader)

  return {
    messageId: message.id,
    threadId: message.threadId,
    senderName,
    senderEmail,
    subject,
    summary,
    bodyExcerpt: bodyText.slice(0, 4000),
    timeText: formatTimeText(timestamp ?? dateHeader),
    timestamp,
    isUnread: labelIds.includes('UNREAD'),
    hasAttachment: hasAttachment(message.payload),
    labelIds,
    threadMessageCount: Math.max(threadMessageCount, 1),
  }
}

const fetchThreadMessageCounts = async (token: string, threadIds: string[]) => {
  const uniqueThreadIds = Array.from(new Set(threadIds.filter(Boolean)))
  const entries = await mapWithConcurrency(
    uniqueThreadIds,
    GMAIL_FETCH_CONCURRENCY,
    async (threadId) => {
      const thread = await gmailFetch<GmailThreadResponse>(
        token,
        `/users/me/threads/${threadId}?format=minimal`,
      )

      return [threadId, Math.max(thread.messages?.length ?? 1, 1)] as const
    },
  )

  return new Map(entries)
}

const fetchInboxMessages = async (token: string) => {
  const list = await gmailFetch<GmailListResponse>(
    token,
    `/users/me/messages?labelIds=INBOX&maxResults=${GMAIL_SYNC_LIMIT}`,
  )

  const messageRefs = list.messages ?? []
  const messages = await mapWithConcurrency(
    messageRefs,
    GMAIL_FETCH_CONCURRENCY,
    (messageRef) =>
      gmailFetch<GmailMessageResponse>(token, `/users/me/messages/${messageRef.id}?format=full`),
  )

  const fallbackThreadCounts = new Map<string, number>()
  for (const message of messages) {
    fallbackThreadCounts.set(
      message.threadId,
      (fallbackThreadCounts.get(message.threadId) ?? 0) + 1,
    )
  }

  let threadCounts = fallbackThreadCounts
  try {
    threadCounts = await fetchThreadMessageCounts(token, messages.map((message) => message.threadId))
  } catch (error) {
    console.warn('Failed to fetch exact Gmail thread counts. Falling back to observed inbox counts.', error)
  }

  return messages.map((message) =>
    toRawMessagePayload(message, threadCounts.get(message.threadId) ?? 1),
  )
}

const fetchSingleMessage = async (token: string, messageId: string) => {
  const message = await gmailFetch<GmailMessageResponse>(
    token,
    `/users/me/messages/${messageId}?format=full`,
  )

  let threadMessageCount = 1
  try {
    const thread = await gmailFetch<GmailThreadResponse>(
      token,
      `/users/me/threads/${message.threadId}?format=minimal`,
    )
    threadMessageCount = Math.max(thread.messages?.length ?? 1, 1)
  } catch (error) {
    console.warn('Failed to fetch thread size for single-message refresh.', error)
  }

  return toRawMessagePayload(message, threadMessageCount)
}

const fetchGmailProfile = (token: string) =>
  gmailFetch<GmailProfileResponse>(token, '/users/me/profile')

const normalizeBackendFetchError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  const lowerCaseMessage = message.toLowerCase()

  if (lowerCaseMessage.includes('failed to fetch')) {
    return `鏃犳硶杩炴帴鏈湴鍒嗘瀽鍚庣 ${API_BASE_URL}銆傝纭 FastAPI 姝ｅ湪杩愯锛屽苟涓旀墿灞曞凡缁忛噸鏂板姞杞姐€俙
  }

  if (message.includes('Gmail API 429')) {
    return 'Gmail 褰撳墠璇锋眰杩囦簬棰戠箒锛岀郴缁熷凡鑷姩闄嶄綆骞跺彂骞跺仛閲嶈瘯锛涘鏋滀粛澶辫触锛岃绋嶅悗鍑犵鍐嶈瘯銆?
  }

  return message
}

const buildAnalysisEndpoint = (mode: SyncContext['analysisMode']) => {
  if (mode === 'full_reanalyze' || mode === 'rerank') {
    return `${API_BASE_URL}/api/v1/reanalyze`
  }

  return `${API_BASE_URL}/api/v1/analyze/messages`
}

const postAnalysis = async (
  messages: RawMessagePayload[],
  context: SyncContext,
  accountKey: string,
): Promise<SyncAnalysisPayload> => {
  const response = await fetch(buildAnalysisEndpoint(context.analysisMode), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      projectContext: {
        ...context,
        accountKey,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`鍚庣鍒嗘瀽鎺ュ彛杩斿洖 ${response.status}: ${text}`)
  }

  return (await response.json()) as SyncAnalysisPayload
}

const syncInboxAnalysis = async (context: SyncContext): Promise<RuntimeResponse> => {
  if (!hasGoogleOAuthConfig()) {
    return {
      ok: false,
      requiresAuth: true,
      error:
        '杩樻病鏈夐厤缃?Google OAuth Client ID銆傝鍏堝湪 `.env` 涓缃?`VITE_GOOGLE_OAUTH_CLIENT_ID`銆?,
    }
  }

  let token: string

  try {
    token = await getAuthToken(false)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      requiresAuth: true,
      error: message,
    }
  }

  try {
    const [profile, messages] = await Promise.all([fetchGmailProfile(token), fetchInboxMessages(token)])
    const accountKey = profile.emailAddress ?? context.accountKey ?? ''
    const payload = await postAnalysis(messages, context, accountKey)
    const mode = context.analysisMode ?? 'incremental'
    const successMessage =
      mode === 'full_reanalyze' || mode === 'rerank'
        ? `宸查噸鏂板垎鏋愭渶杩?${messages.length} 灏?Gmail 閭欢銆俙
        : `宸插垎鏋愭渶杩?${messages.length} 灏?Gmail 閭欢銆俙

    return {
      ok: true,
      message: successMessage,
      accountKey: accountKey || undefined,
      payload,
    }
  } catch (error) {
    const message = normalizeBackendFetchError(error)
    return {
      ok: false,
      error: `鍚屾 Gmail 骞跺垎鏋愬け璐ワ細${message}`,
    }
  }
}

const refreshSingleMailSummary = async (
  messageId: string,
  context: SyncContext,
): Promise<RuntimeResponse> => {
  if (!hasGoogleOAuthConfig()) {
    return {
      ok: false,
      requiresAuth: true,
      error:
        '杩樻病鏈夐厤缃?Google OAuth Client ID銆傝鍏堝湪 `.env` 涓缃?`VITE_GOOGLE_OAUTH_CLIENT_ID`銆?,
    }
  }

  let token: string

  try {
    token = await getAuthToken(false)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      requiresAuth: true,
      error: message,
    }
  }

  try {
    const [profile, message] = await Promise.all([
      fetchGmailProfile(token),
      fetchSingleMessage(token, messageId),
    ])
    const accountKey = profile.emailAddress ?? context.accountKey ?? ''
    const response = await fetch(`${API_BASE_URL}/api/v1/resummary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        projectContext: {
          ...context,
          accountKey,
          analysisMode: 'resummary',
        },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`鍚庣閲嶆柊姒傝堪鎺ュ彛杩斿洖 ${response.status}: ${text}`)
    }

    const summaryUpdate = (await response.json()) as ResummaryApiResponse

    return {
      ok: true,
      message: '宸查噸鏂版杩板綋鍓嶉偖浠躲€?,
      accountKey: accountKey || undefined,
      summaryUpdate,
    }
  } catch (error) {
    const message = normalizeBackendFetchError(error)
    return {
      ok: false,
      error: `閲嶆柊姒傝堪澶辫触锛?{message}`,
    }
  }
}

const recordFeedback = async (payload: FeedbackPayload): Promise<RuntimeResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`鍚庣鍙嶉鎺ュ彛杩斿洖 ${response.status}: ${text}`)
    }

    const result = (await response.json()) as FeedbackApiResponse

    return {
      ok: true,
      message: '鍙嶉宸茶褰曪紝閲嶆柊鍒嗘瀽鍚庝細杩涘叆璁粌鏍锋湰銆?,
      feedback: {
        moreImportantCount: result.moreImportantCount,
        showLessCount: result.showLessCount,
        recordedAt: result.recordedAt,
      },
    }
  } catch (error) {
    const message = normalizeBackendFetchError(error)
    return {
      ok: false,
      error: `璁板綍鍙嶉澶辫触锛?{message}`,
    }
  }
}

const authorizeGmail = async (): Promise<RuntimeResponse> => {
  if (!hasGoogleOAuthConfig()) {
    return {
      ok: false,
      requiresAuth: true,
      error:
        '杩樻病鏈夐厤缃?Google OAuth Client ID銆傝鍏堝湪 `.env` 涓缃?`VITE_GOOGLE_OAUTH_CLIENT_ID`銆?,
    }
  }

  try {
    const token = await getAuthToken(true)
    const profile = await fetchGmailProfile(token)
    return {
      ok: true,
      message: 'Gmail 鎺堟潈鎴愬姛銆?,
      accountKey: profile.emailAddress ?? undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      requiresAuth: true,
      error: `Gmail 鎺堟潈澶辫触锛?{message}`,
    }
  }
}

const getGmailAuthState = async (): Promise<RuntimeResponse> => {
  if (!hasGoogleOAuthConfig()) {
    return {
      ok: false,
      requiresAuth: true,
      error:
        '杩樻病鏈夐厤缃?Google OAuth Client ID銆傝鍏堝湪 `.env` 涓缃?`VITE_GOOGLE_OAUTH_CLIENT_ID`銆?,
    }
  }

  try {
    const token = await getAuthToken(false)
    const profile = await fetchGmailProfile(token)
    return {
      ok: true,
      message: 'Gmail 宸叉巿鏉冦€?,
      accountKey: profile.emailAddress ?? undefined,
    }
  } catch {
    return {
      ok: false,
      requiresAuth: true,
      error: '褰撳墠杩樻病鏈?Gmail 鎺堟潈锛岃鍏堣繛鎺?Gmail銆?,
    }
  }
}

chromeApi?.runtime?.onInstalled?.addListener(() => {
  console.info('Mail assistant MV3 installed.')
})

chromeApi?.action?.onClicked?.addListener(async (tab) => {
  await toggleAssistantForTab(tab)
})

chromeApi?.runtime?.onMessage?.addListener(
  (message: RuntimeMessage, _sender, sendResponse: (response: RuntimeResponse) => void) => {
    try {
      if (message.type === 'LMA_OPEN_GMAIL') {
        openGmailTab()
        sendResponse({
          ok: true,
          message: '宸叉墦寮€ Gmail銆?,
        })
        return
      }

      if (message.type === 'LMA_TOGGLE_ACTIVE_GMAIL_PANEL') {
        toggleAssistantForActiveTab(sendResponse)
        return true
      }

      if (message.type === 'LMA_AUTH_GMAIL') {
        respondWithTask(sendResponse, authorizeGmail())
        return true
      }

      if (message.type === 'LMA_GET_GMAIL_AUTH_STATE') {
        respondWithTask(sendResponse, getGmailAuthState())
        return true
      }

      if (message.type === 'LMA_SYNC_GMAIL_ANALYSIS') {
        respondWithTask(sendResponse, syncInboxAnalysis(message.context))
        return true
      }

      if (message.type === 'LMA_REFRESH_MAIL_SUMMARY') {
        respondWithTask(sendResponse, refreshSingleMailSummary(message.messageId, message.context))
        return true
      }

      if (message.type === 'LMA_RECORD_FEEDBACK') {
        respondWithTask(sendResponse, recordFeedback(message.payload))
        return true
      }

      return
    } catch (error) {
      console.error('Mail assistant background message handler crashed:', error)
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
      return
    }
  },
)

