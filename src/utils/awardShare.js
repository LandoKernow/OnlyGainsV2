import { formatActivityValue } from './activity'
import { formatDurationFromSeconds } from './profileYear'

const LIVE_SHARE_ORIGIN = 'https://onlygains.club'
const AWARD_SEEN_KEY_PREFIX = 'only_gains_award_seen_'

const AWARD_IMAGES = {
  crown: '/images/macho-toasts/crown-arnold.webp',
  road: '/images/macho-toasts/road-mo-farah.webp',
  vault: '/images/macho-toasts/vault-rocky.webp',
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
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

  return Promise.resolve()
}

function parseUtcDate(value) {
  if (!value) {
    return null
  }

  return new Date(`${value}T12:00:00.000Z`)
}

function formatMonthlyPeriod(start) {
  const startDate = parseUtcDate(start)

  if (!startDate) {
    return ''
  }

  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(startDate)
}

function formatWeeklyPeriod(start, end) {
  const startDate = parseUtcDate(start)
  const endDate = parseUtcDate(end)

  if (!startDate) {
    return ''
  }

  if (!endDate) {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(startDate)
  }

  endDate.setUTCDate(endDate.getUTCDate() - 1)

  const sameYear = startDate.getUTCFullYear() === endDate.getUTCFullYear()
  const sameMonth = sameYear && startDate.getUTCMonth() === endDate.getUTCMonth()

  if (sameMonth) {
    const monthYear = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      year: 'numeric',
    }).format(endDate)

    return `${startDate.getUTCDate()}\u2013${endDate.getUTCDate()} ${monthYear}`
  }

  const startLabel = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(startDate)
  const endLabel = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(endDate)

  return `${startLabel} \u2013 ${endLabel}`
}

export function getAwardSeenStorageKey(awardId) {
  return `${AWARD_SEEN_KEY_PREFIX}${awardId}`
}

export function hasSeenAwardCelebration(awardId) {
  if (!awardId) {
    return false
  }

  try {
    return globalThis.localStorage?.getItem(getAwardSeenStorageKey(awardId)) === 'true'
  } catch {
    return false
  }
}

export function markAwardCelebrationSeen(awardId) {
  if (!awardId) {
    return
  }

  try {
    globalThis.localStorage?.setItem(getAwardSeenStorageKey(awardId), 'true')
  } catch {
    // Ignore restrictive storage environments.
  }
}

export function getAwardImagePath(award) {
  if (award.imagePath) {
    return award.imagePath
  }

  if (award.awardType === 'double_weekly_win' || award.awardType === 'double_monthly_win') {
    return AWARD_IMAGES.vault
  }

  if (award.activityType === 'km') {
    return AWARD_IMAGES.road
  }

  if (award.awardType === 'weekly_win' || award.awardType === 'monthly_win') {
    return AWARD_IMAGES.crown
  }

  return AWARD_IMAGES.vault
}

export function formatAwardValue(award) {
  if (award.valueSeconds != null) {
    return formatDurationFromSeconds(award.valueSeconds)
  }

  if (award.valueNumeric != null && (award.activityType === 'pressups' || award.activityType === 'km')) {
    return formatActivityValue(award.valueNumeric, award.activityType)
  }

  return ''
}

export function formatAwardMetricLine(award) {
  if (award.activityType === 'combined') {
    return 'Press Ups + KM'
  }

  if (award.activityType === 'km') {
    return formatAwardValue(award)
  }

  const rawValue = Number(award.valueNumeric ?? 0)
  return `${rawValue.toLocaleString('en-GB')} press-ups`
}

export function formatAwardPeriodRange(award) {
  if (award.periodType === 'monthly') {
    return formatMonthlyPeriod(award.periodStart)
  }

  if (award.periodType === 'weekly') {
    return formatWeeklyPeriod(award.periodStart, award.periodEnd)
  }

  const startDate = parseUtcDate(award.periodStart)

  if (!startDate) {
    return ''
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(startDate)
}

export function formatAwardSourceLabel(award) {
  const year = award.periodStart ? new Date(`${award.periodStart}T12:00:00.000Z`).getUTCFullYear() : 2026
  const source = String(award.sourceType || 'leaderboard').replace(/_/g, '-').toUpperCase()

  return `${source} ${String.fromCharCode(183)} ${year}`
}

export function buildAwardCelebrationToast(award) {
  if (award.awardType === 'double_monthly_win') {
    return {
      tone: 'success',
      variant: 'macho',
      eyebrow: 'MONTHLY DOUBLE CROWN',
      title: 'THE BOARD WAS YOURS.',
      message: 'Reps and distance. A full month owned.',
      imagePath: getAwardImagePath(award),
      durationMs: 7200,
    }
  }

  if (award.awardType === 'double_weekly_win') {
    return {
      tone: 'success',
      variant: 'macho',
      eyebrow: 'DOUBLE CROWN',
      title: 'YOU TOOK BOTH.',
      message: 'Reps and distance. Same week. No hiding.',
      imagePath: getAwardImagePath(award),
      durationMs: 7200,
    }
  }

  if (award.awardType === 'monthly_win' && award.activityType === 'km') {
    return {
      tone: 'success',
      variant: 'macho',
      eyebrow: 'MONTH WON',
      title: 'DISTANCE KING.',
      message: 'The month ended with your name on it.',
      imagePath: getAwardImagePath(award),
      durationMs: 6800,
    }
  }

  if (award.awardType === 'monthly_win') {
    return {
      tone: 'success',
      variant: 'macho',
      eyebrow: 'MONTH WON',
      title: 'MONTHLY DOMINANCE.',
      message: 'Reps ruled the month.',
      imagePath: getAwardImagePath(award),
      durationMs: 6800,
    }
  }

  if (award.activityType === 'km') {
    return {
      tone: 'success',
      variant: 'macho',
      eyebrow: 'WEEK WON',
      title: 'YOU OWNED THE ROAD.',
      message: 'Distance crowned. The Vault wrote it down.',
      imagePath: getAwardImagePath(award),
      durationMs: 6400,
    }
  }

  return {
    tone: 'success',
    variant: 'macho',
    eyebrow: 'WEEK WON',
    title: 'YOU WON THE WEEK.',
    message: 'Reps made visible. The Vault wrote it down.',
    imagePath: getAwardImagePath(award),
    durationMs: 6400,
  }
}

export function buildAwardSharePayload(award) {
  const awardUrl = `${LIVE_SHARE_ORIGIN}/award/${award.id}`
  const metricLine = formatAwardMetricLine(award)

  if (award.awardType === 'double_monthly_win') {
    return {
      title: 'Only Gains Award',
      text: 'MONTHLY DOUBLE CROWN on Only Gains.\n\nOwned reps and distance for the month.\nName in the Vault.\n\nView the award:',
      clipboardText: `MONTHLY DOUBLE CROWN on Only Gains.\n\nOwned reps and distance for the month.\nName in the Vault.\n\nView the award:\n${awardUrl}`,
      url: awardUrl,
    }
  }

  if (award.awardType === 'double_weekly_win') {
    return {
      title: 'Only Gains Award',
      text: 'DOUBLE CROWN on Only Gains.\n\nWon Press Ups and KM in the same week.\nName in the Vault.\n\nView the award:',
      clipboardText: `DOUBLE CROWN on Only Gains.\n\nWon Press Ups and KM in the same week.\nName in the Vault.\n\nView the award:\n${awardUrl}`,
      url: awardUrl,
    }
  }

  if (award.awardType === 'monthly_win' && award.activityType === 'km') {
    return {
      title: 'Only Gains Award',
      text: `I won the Only Gains monthly KM board.\n\n${metricLine}.\nDistance crowned.\n\nView the award:`,
      clipboardText: `I won the Only Gains monthly KM board.\n\n${metricLine}.\nDistance crowned.\n\nView the award:\n${awardUrl}`,
      url: awardUrl,
    }
  }

  if (award.awardType === 'monthly_win') {
    return {
      title: 'Only Gains Award',
      text: `I won the Only Gains monthly Press Ups board.\n\n${metricLine}.\nName in the Vault.\n\nView the award:`,
      clipboardText: `I won the Only Gains monthly Press Ups board.\n\n${metricLine}.\nName in the Vault.\n\nView the award:\n${awardUrl}`,
      url: awardUrl,
    }
  }

  if (award.activityType === 'km') {
    return {
      title: 'Only Gains Award',
      text: `I won the Only Gains weekly KM board.\n\n${metricLine}.\nDistance crowned.\n\nView the award:`,
      clipboardText: `I won the Only Gains weekly KM board.\n\n${metricLine}.\nDistance crowned.\n\nView the award:\n${awardUrl}`,
      url: awardUrl,
    }
  }

  return {
    title: 'Only Gains Award',
    text: `I won the Only Gains weekly Press Ups board.\n\n${metricLine}.\nName in the Vault.\n\nView the award:`,
    clipboardText: `I won the Only Gains weekly Press Ups board.\n\n${metricLine}.\nName in the Vault.\n\nView the award:\n${awardUrl}`,
    url: awardUrl,
  }
}

export async function shareAward(award) {
  const payload = buildAwardSharePayload(award)

  if (navigator.share) {
    try {
      await navigator.share(payload)
      return 'shared'
    } catch (error) {
      if (error?.name === 'AbortError') {
        return 'cancelled'
      }

      throw error
    }
  }

  await copyText(payload.clipboardText)
  return 'copied'
}
