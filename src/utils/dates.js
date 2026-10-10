const londonFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDateKey(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
}

function createUtcDateFromParts(parts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

export function getLondonDateParts(date = new Date()) {
  const [{ value: year }, , { value: month }, , { value: day }] = londonFormatter.formatToParts(date)

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  }
}

export function getLondonDateKey(date = new Date()) {
  return formatDateKey(getLondonDateParts(date))
}

export function getLondonActivityDateIso(date = new Date()) {
  const parts = getLondonDateParts(date)
  return `${formatDateKey(parts)}T12:00:00.000Z`
}

export function getLondonSubmissionParts(date = new Date()) {
  const parts = getLondonDateParts(date)

  return {
    activityDate: getLondonActivityDateIso(date),
    year: parts.year,
    month: parts.month,
  }
}

export function getLondonPeriodKeys(date = new Date()) {
  const parts = getLondonDateParts(date)
  const currentDate = createUtcDateFromParts(parts)
  const dayOfWeek = currentDate.getUTCDay()
  const daysFromMonday = (dayOfWeek + 6) % 7
  const weekStartDate = new Date(currentDate)
  weekStartDate.setUTCDate(currentDate.getUTCDate() - daysFromMonday)

  const weekStartParts = {
    year: weekStartDate.getUTCFullYear(),
    month: weekStartDate.getUTCMonth() + 1,
    day: weekStartDate.getUTCDate(),
  }

  return {
    todayKey: formatDateKey(parts),
    weekKey: formatDateKey(weekStartParts),
    monthKey: `${parts.year}-${pad2(parts.month)}`,
    yearKey: String(parts.year),
  }
}

// Every leaderboard, streak and record derivation keys each submission row by
// its London day/week/month — thousands of Intl calls per render on a busy
// board. activity_date strings repeat heavily (one per day), so memoise them.
const submissionPeriodKeyCache = new Map()
const SUBMISSION_PERIOD_KEY_CACHE_LIMIT = 5000

export function getSubmissionPeriodKeys(activityDate) {
  const cacheKey = typeof activityDate === 'string' ? activityDate : null

  if (cacheKey !== null) {
    const cached = submissionPeriodKeyCache.get(cacheKey)

    if (cached) {
      return cached
    }
  }

  const keys = computeSubmissionPeriodKeys(activityDate)

  if (cacheKey !== null) {
    if (submissionPeriodKeyCache.size >= SUBMISSION_PERIOD_KEY_CACHE_LIMIT) {
      submissionPeriodKeyCache.clear()
    }

    submissionPeriodKeyCache.set(cacheKey, keys)
  }

  return keys
}

function computeSubmissionPeriodKeys(activityDate) {
  const parts = getLondonDateParts(new Date(activityDate))
  const date = createUtcDateFromParts(parts)
  const dayOfWeek = date.getUTCDay()
  const daysFromMonday = (dayOfWeek + 6) % 7
  const weekStartDate = new Date(date)
  weekStartDate.setUTCDate(date.getUTCDate() - daysFromMonday)

  // Frozen: cached instances are shared across every caller.
  return Object.freeze({
    todayKey: formatDateKey(parts),
    weekKey: formatDateKey({
      year: weekStartDate.getUTCFullYear(),
      month: weekStartDate.getUTCMonth() + 1,
      day: weekStartDate.getUTCDate(),
    }),
    monthKey: `${parts.year}-${pad2(parts.month)}`,
    yearKey: String(parts.year),
  })
}
