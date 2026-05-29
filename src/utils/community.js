import { appEnv } from '../lib/env'

export const DEFAULT_TELEGRAM_URL = 'https://t.me/ONLY_GAINS_PLACEHOLDER'
export const TELEGRAM_URL = appEnv.telegramUrl || DEFAULT_TELEGRAM_URL
export const REPORT_ISSUE_TEMPLATE = 'Only Gains 2.0 feedback:\nDevice:\nBrowser:\nWhat happened:\nScreenshot attached? Yes/No'
export const OPEN_ADD_TO_HOME_SCREEN_EVENT = 'only_gains_open_add_to_home_screen'

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  document.body.appendChild(textarea)
  textarea.select()

  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

export async function copyReportIssueTemplate() {
  await copyText(REPORT_ISSUE_TEMPLATE)
}

export function openAddToHomeScreenPrompt() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(OPEN_ADD_TO_HOME_SCREEN_EVENT))
}
