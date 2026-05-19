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
