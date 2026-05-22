import { getSubmissionPeriodKeys } from './dates'

const ACHIEVEMENT_KEY_PREFIX = 'only_gains_achievement_toast_seen_v1'

const MACHO_IMAGES = {
  crown: '/images/macho-toasts/crown-arnold.webp',
  vault: '/images/macho-toasts/vault-rocky.webp',
  road: '/images/macho-toasts/road-mo-farah.webp',
}

function readStorage(key) {
  try {
    return globalThis.localStorage?.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // Ignore storage issues in restrictive mobile webviews.
  }
}

export function findTopVaultGroup(rows, periodKey) {
  const groups = {}

  rows.forEach((row) => {
    const period = getSubmissionPeriodKeys(row.activityDate)[periodKey]

    if (!period) {
      return
    }

    const key = `${row.userId}:${period}`
    const value = Number(row.value) || 0

    if (!groups[key]) {
      groups[key] = {
        userId: row.userId,
        actorName: row.actorName || 'Unknown',
        period,
        value: 0,
      }
    }

    groups[key].value += value
  })

  return Object.values(groups).sort((a, b) => b.value - a.value)[0] || null
}

export function getAchievementToastStorageKey(userId, eventKey) {
  return `${ACHIEVEMENT_KEY_PREFIX}_${userId}_${eventKey}`
}

export function hasSeenAchievementToast(userId, eventKey) {
  if (!userId || !eventKey) {
    return false
  }

  return readStorage(getAchievementToastStorageKey(userId, eventKey)) === 'true'
}

export function markAchievementToastSeen(userId, eventKey) {
  if (!userId || !eventKey) {
    return
  }

  writeStorage(getAchievementToastStorageKey(userId, eventKey), 'true')
}

export function buildCrownTakenToast({ activityType }) {
  if (activityType === 'km') {
    return {
      tone: 'success',
      variant: 'macho',
      eyebrow: 'CROWN TAKEN',
      title: 'YOU TOOK THE ROAD.',
      message: 'Distance crowned.',
      imagePath: MACHO_IMAGES.road,
      durationMs: 4200,
    }
  }

  return {
    tone: 'success',
    variant: 'macho',
    eyebrow: 'CROWN TAKEN',
    title: 'YOU TOOK THE CROWN.',
    message: 'The board has a new problem.',
    imagePath: MACHO_IMAGES.crown,
    durationMs: 4200,
  }
}

export function buildVaultRecordToast({ activityType, periodType }) {
  if (activityType === 'km') {
    return {
      tone: 'success',
      variant: 'macho',
      eyebrow: 'VAULT RECORD',
      title: periodType === 'week' ? 'ROAD RECORD TAKEN.' : 'DISTANCE CLAIMED.',
      message: 'The Vault saw it.',
      imagePath: MACHO_IMAGES.road,
      durationMs: 4200,
    }
  }

  return {
    tone: 'success',
    variant: 'macho',
    eyebrow: 'VAULT RECORD',
    title: periodType === 'week' ? 'THE TABLE CHANGED.' : 'RECORD TAKEN.',
    message: 'Discipline made visible.',
    imagePath: MACHO_IMAGES.vault,
    durationMs: 4200,
  }
}
