import './popup.css'
import { chromeApi } from './chrome'
import type { RuntimeMessage, RuntimeResponse } from './chrome'

const statusEl = document.getElementById('popup-status')
const openGmailBtn = document.getElementById('open-gmail')
const authGmailBtn = document.getElementById('auth-gmail')
const togglePanelBtn = document.getElementById('toggle-panel')

const setStatus = (message: string) => {
  if (statusEl) {
    statusEl.textContent = message
  }
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

openGmailBtn?.addEventListener('click', async () => {
  const response = await sendRuntimeMessage({ type: 'LMA_OPEN_GMAIL' })
  setStatus(response.message ?? response.error ?? '已触发打开 Gmail。')
})

authGmailBtn?.addEventListener('click', async () => {
  setStatus('正在请求 Gmail 授权…')
  const response = await sendRuntimeMessage({ type: 'LMA_AUTH_GMAIL' })
  setStatus(response.message ?? response.error ?? '授权流程已触发。')
})

togglePanelBtn?.addEventListener('click', async () => {
  const response = await sendRuntimeMessage({ type: 'LMA_TOGGLE_ACTIVE_GMAIL_PANEL' })
  setStatus(response.message ?? response.error ?? '已切换侧边助手。')
})

void (async () => {
  const response = await sendRuntimeMessage({ type: 'LMA_GET_GMAIL_AUTH_STATE' })
  setStatus(response.message ?? response.error ?? '当前还没有 Gmail 授权。')
})()
