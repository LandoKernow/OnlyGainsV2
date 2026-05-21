export const PROFILE_YEAR_RECORD_TYPES = [
  'pressups_day',
  'pressups_week',
  'pressups_set',
  'pullups_day',
  'pullups_week',
  'pullups_set',
  'km_day',
  'km_week',
  'fastest_5k',
  'fastest_10k',
  'half_marathon',
  'marathon',
  'longest_run',
]

export const PROFILE_YEAR_MONTHLY_ACTIVITY_TYPES = ['pressups', 'pullups', 'km']

const REP_RECORD_TYPES = new Set([
  'pressups_day',
  'pressups_week',
  'pressups_set',
  'pullups_day',
  'pullups_week',
  'pullups_set',
])

const KM_RECORD_TYPES = new Set(['km_day', 'km_week', 'longest_run'])
const TIME_RECORD_TYPES = new Set(['fastest_5k', 'fastest_10k', 'half_marathon', 'marathon'])

export function isSupportedRecordType(recordType) {
  return PROFILE_YEAR_RECORD_TYPES.includes(recordType)
}

export function isSupportedMonthlyActivityType(activityType) {
  return PROFILE_YEAR_MONTHLY_ACTIVITY_TYPES.includes(activityType)
}

export function isTimeRecordType(recordType) {
  return TIME_RECORD_TYPES.has(recordType)
}

export function buildDefaultRecordState() {
  return Object.fromEntries(
    PROFILE_YEAR_RECORD_TYPES.map((recordType) => [
      recordType,
      {
        recordType,
        valueNumeric: null,
        valueSeconds: null,
      },
    ]),
  )
}

export function buildDefaultMonthlyTotalsState() {
  return Object.fromEntries(
    PROFILE_YEAR_MONTHLY_ACTIVITY_TYPES.map((activityType) => [
      activityType,
      Object.fromEntries(Array.from({ length: 12 }, (_, index) => [index + 1, null])),
    ]),
  )
}

export function normalizeOptionalInteger(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const number = Number(value)

  if (!Number.isInteger(number)) {
    throw new Error('Value must be a whole number.')
  }

  return number
}

export function normalizeOptionalBoolean(value, fallback = false) {
  if (value === null || value === undefined) {
    return fallback
  }

  return Boolean(value)
}

export function validateRepsValue(value) {
  const normalized = normalizeOptionalInteger(value)

  if (normalized === null) {
    return null
  }

  if (normalized <= 0) {
    throw new Error('Reps must be greater than 0.')
  }

  return normalized
}

export function validateKmValue(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const number = Number(value)

  if (Number.isNaN(number) || number <= 0) {
    throw new Error('KM must be greater than 0.')
  }

  const normalized = Number(number.toFixed(2))

  if (Math.abs(number - normalized) > 0.0000001) {
    throw new Error('KM must use up to 2 decimal places.')
  }

  return normalized
}

export function validateNonNegativeKmValue(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const number = Number(value)

  if (Number.isNaN(number) || number < 0) {
    throw new Error('KM cannot be negative.')
  }

  const normalized = Number(number.toFixed(2))

  if (Math.abs(number - normalized) > 0.0000001) {
    throw new Error('KM must use up to 2 decimal places.')
  }

  return normalized
}

export function validateTimeSeconds(value) {
  const normalized = normalizeOptionalInteger(value)

  if (normalized === null) {
    return null
  }

  if (normalized <= 0) {
    throw new Error('Time must be greater than 0 seconds.')
  }

  return normalized
}

export function formatDurationFromSeconds(totalSeconds) {
  const seconds = validateTimeSeconds(totalSeconds)

  if (seconds === null) {
    return ''
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
  }

  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export function parseDurationToSeconds(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return validateTimeSeconds(value)
  }

  const trimmed = String(value).trim()

  if (!trimmed) {
    return null
  }

  if (/^\d+$/.test(trimmed)) {
    return validateTimeSeconds(Number(trimmed))
  }

  const parts = trimmed.split(':').map((part) => part.trim())

  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error('Use mm:ss or hh:mm:ss.')
  }

  const numbers = parts.map((part) => Number(part))
  const seconds = parts.length === 3
    ? numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
    : numbers[0] * 60 + numbers[1]

  return validateTimeSeconds(seconds)
}

export function normalizeProfileYearPayload(payload = {}) {
  const normalized = {
    year: normalizeOptionalInteger(payload.year),
    age: normalizeOptionalInteger(payload.age),
    sex: payload.sex ? String(payload.sex) : null,
    weightKg: validateKmValue(payload.weight_kg),
    weightIsPublic: normalizeOptionalBoolean(payload.weight_is_public, false),
    setupStatus: payload.setup_status ? String(payload.setup_status) : 'draft',
    claimedAt: payload.claimed_at ?? null,
  }

  if (normalized.age !== null && (normalized.age < 13 || normalized.age > 100)) {
    throw new Error('Age must be between 13 and 100.')
  }

  if (normalized.weightKg !== null && normalized.weightKg > 500) {
    throw new Error('Weight must be 500 kg or less.')
  }

  if (!['draft', 'claimed'].includes(normalized.setupStatus)) {
    throw new Error('Setup status must be draft or claimed.')
  }

  if (normalized.sex && !['male', 'female', 'other', 'prefer_not_to_say'].includes(normalized.sex)) {
    throw new Error('Sex value is not supported.')
  }

  return normalized
}

export function normalizeProfileRecordEntry(record = {}) {
  const recordType = String(record.recordType ?? record.record_type ?? '').trim()

  if (!isSupportedRecordType(recordType)) {
    throw new Error(`Unsupported record type: ${recordType || 'unknown'}.`)
  }

  if (REP_RECORD_TYPES.has(recordType)) {
    const valueNumeric = validateRepsValue(record.valueNumeric ?? record.value_numeric)

    if (valueNumeric === null) {
      return null
    }

    return {
      recordType,
      unit: 'reps',
      valueNumeric,
      valueSeconds: null,
    }
  }

  if (KM_RECORD_TYPES.has(recordType)) {
    const valueNumeric = validateKmValue(record.valueNumeric ?? record.value_numeric)

    if (valueNumeric === null) {
      return null
    }

    return {
      recordType,
      unit: 'km',
      valueNumeric,
      valueSeconds: null,
    }
  }

  const valueSeconds = validateTimeSeconds(record.valueSeconds ?? record.value_seconds)

  if (valueSeconds === null) {
    return null
  }

  return {
    recordType,
    unit: 'seconds',
    valueNumeric: null,
    valueSeconds,
  }
}

export function normalizeProfileRecordEntries(records = []) {
  return records
    .map((record) => normalizeProfileRecordEntry(record))
    .filter(Boolean)
}

export function normalizeProfileMonthlyTotal(total = {}) {
  const month = normalizeOptionalInteger(total.month)
  const activityType = String(total.activityType ?? total.activity_type ?? '').trim()

  if (month === null || month < 1 || month > 12) {
    throw new Error(`Month must be between 1 and 12. Received: ${total.month}.`)
  }

  if (!isSupportedMonthlyActivityType(activityType)) {
    throw new Error(`Unsupported monthly activity type: ${activityType || 'unknown'}.`)
  }

  const normalizedTotal = activityType === 'km'
    ? validateNonNegativeKmValue(total.total)
    : normalizeOptionalInteger(total.total)

  if (normalizedTotal === null) {
    return null
  }

  if (normalizedTotal < 0) {
    throw new Error('Monthly total cannot be negative.')
  }

  return {
    month,
    activityType,
    total: normalizedTotal,
  }
}

export function normalizeProfileMonthlyTotals(totals = []) {
  return totals
    .map((total) => normalizeProfileMonthlyTotal(total))
    .filter(Boolean)
}
