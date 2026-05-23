const BACKFILL_SOURCE_PATTERNS = ['backfill', 'import', 'migration', 'v1']
const LIVE_SOURCE_PATTERNS = ['app', 'app_v2', 'live', 'manual', 'user']

function normalizeSource(source) {
  return String(source || '').trim().toLowerCase()
}

function isFirstDayOfMonth(activityDate) {
  if (!activityDate) {
    return false
  }

  const datePart = String(activityDate).split('T')[0]
  const segments = datePart.split('-')

  if (segments.length !== 3) {
    return false
  }

  return segments[2] === '01'
}

function isClearlyBackfillSource(source) {
  return BACKFILL_SOURCE_PATTERNS.some((pattern) => source.includes(pattern))
}

function isClearlyLiveSource(source) {
  return LIVE_SOURCE_PATTERNS.some((pattern) => source.includes(pattern))
}

export function isVaultEligibleSubmission(submission) {
  if (!submission) {
    return false
  }

  const source = normalizeSource(submission.source)
  const value = Number(submission.value) || 0
  const isClearlyLive = source === '' || isClearlyLiveSource(source)

  if (source && isClearlyBackfillSource(source)) {
    return false
  }

  if (
    submission.activityType === 'pressups' &&
    value > 1000 &&
    !isClearlyLive
  ) {
    return false
  }

  if (
    submission.activityType === 'pressups' &&
    isFirstDayOfMonth(submission.activityDate) &&
    value >= 1000 &&
    !isClearlyLive
  ) {
    return false
  }

  return true
}
