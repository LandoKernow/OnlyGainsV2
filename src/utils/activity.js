export function formatKm(value) {
  const number = Number(value)
  if (Number.isNaN(number)) {
    return ''
  }

  const normalized = Number(number.toFixed(2))
  const formatted = Number.isInteger(normalized)
    ? `${normalized}`
    : normalized.toFixed(2).replace(/\.?(0+)$/, '')

  return `${formatted} km`
}

export function formatActivityGap(value, activityType) {
  if (activityType === 'km') {
    return formatKm(value)
  }

  const normalized = Math.round(Number(value) || 0)
  return normalized === 1 ? '1 rep' : `${normalized} reps`
}

export function formatActivityValue(value, activityType) {
  if (activityType === 'km') {
    return formatKm(value)
  }

  return `${Math.round(Number(value) || 0)} reps`
}

export function parseKmValue(rawValue) {
  const trimmed = rawValue.trim()

  if (trimmed === '') {
    return { error: 'Enter KM first.' }
  }

  const normalized = trimmed.replace(',', '.')

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { error: 'Use up to 2 decimal places, e.g. 9.75.' }
  }

  const parsed = Number(normalized)

  if (Number.isNaN(parsed)) {
    return { error: 'Use a valid KM number, e.g. 9.75.' }
  }

  if (parsed <= 0) {
    return { error: 'KM must be greater than 0.' }
  }

  return { value: parsed }
}

export function formatRelativeTime(isoTimestamp) {
  const now = new Date()
  const past = new Date(isoTimestamp)
  const diffMs = now - past
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 30) {
    return 'just now'
  }
  if (diffMin < 1) {
    return 'just now'
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`
  }
  if (diffHour < 24) {
    return `${diffHour}h ago`
  }
  if (diffDay < 7) {
    return `${diffDay}d ago`
  }

  // Fallback: formatted date
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
  }).format(past)
}
