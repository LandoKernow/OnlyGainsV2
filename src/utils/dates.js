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

export function getSubmissionPeriodKeys(activityDate) {
  const parts = getLondonDateParts(new Date(activityDate))
  const date = createUtcDateFromParts(parts)
  const dayOfWeek = date.getUTCDay()
  const daysFromMonday = (dayOfWeek + 6) % 7
  const weekStartDate = new Date(date)
  weekStartDate.setUTCDate(date.getUTCDate() - daysFromMonday)

  return {
    todayKey: formatDateKey(parts),
    weekKey: formatDateKey({
      year: weekStartDate.getUTCFullYear(),
      month: weekStartDate.getUTCMonth() + 1,
      day: weekStartDate.getUTCDate(),
    }),
    monthKey: `${parts.year}-${pad2(parts.month)}`,
    yearKey: String(parts.year),
  }
}
