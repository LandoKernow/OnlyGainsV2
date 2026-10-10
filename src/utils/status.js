/**
 * Lightweight status/heat system using existing leaderboard data only.
 * No new tables, no persistence, no extra fetching.
 */

// Per-activity heat thresholds: [war-mode today, rising today, danger gap].
// Pull-ups scale at roughly a quarter of press-up volume.
const STATUS_THRESHOLDS = {
  pressups: { war: 100, rising: 30, danger: 20 },
  pullups: { war: 25, rising: 8, danger: 5 },
  km: { war: 8, rising: 3, danger: 0.5 },
}

function getThresholds(activityType) {
  return STATUS_THRESHOLDS[activityType] ?? STATUS_THRESHOLDS.pressups
}

function getWarThreshold(activityType) {
  return getThresholds(activityType).war
}

function getRisingThreshold(activityType) {
  return getThresholds(activityType).rising
}

function getDangerThreshold(activityType) {
  return getThresholds(activityType).danger
}

function getGapAhead(row, allRows = []) {
  const rankAbove = allRows.find((candidate) => candidate.rank === row.rank - 1)

  if (!rankAbove) {
    return null
  }

  return Math.max((rankAbove.total || 0) - (row.total || 0), 0)
}

function getGapBehind(row, allRows = []) {
  const rankBelow = allRows.find((candidate) => candidate.rank === row.rank + 1)

  if (!rankBelow) {
    return null
  }

  return Math.max((row.total || 0) - (rankBelow.total || 0), 0)
}

export function getRowStatus(row, allRows = [], activityType = 'pressups') {
  if (!row || row.pending) {
    return null
  }

  const warThreshold = getWarThreshold(activityType)
  const risingThreshold = getRisingThreshold(activityType)
  const dangerThreshold = getDangerThreshold(activityType)
  const gapAhead = getGapAhead(row, allRows)
  const gapBehind = getGapBehind(row, allRows)

  if (row.rank === 1) {
    return 'CROWN'
  }

  if (row.rank <= 3 && row.todayTotal === 0 && gapBehind !== null && gapBehind <= dangerThreshold) {
    return 'SLIPPING'
  }

  if (row.todayTotal >= warThreshold) {
    return 'WAR MODE'
  }

  if (gapBehind !== null && gapBehind <= dangerThreshold) {
    return 'HUNTED'
  }

  if (gapAhead !== null && gapAhead <= dangerThreshold) {
    return 'DANGEROUS'
  }

  if (row.rank <= 5 && row.todayTotal >= risingThreshold) {
    return 'RISING'
  }

  if (row.todayTotal >= risingThreshold && gapAhead !== null && gapAhead > dangerThreshold) {
    return 'SURVIVOR'
  }

  if (row.todayTotal > 0) {
    return 'ACTIVE'
  }

  if (row.rank <= 5) {
    return 'QUIET'
  }

  return 'COLD'
}

export function getStatusTone(status) {
  switch (status) {
    case 'CROWN':
      return 'crown'
    case 'WAR MODE':
      return 'danger'
    case 'HUNTED':
      return 'danger'
    case 'DANGEROUS':
      return 'warning'
    case 'RISING':
      return 'warning'
    case 'SURVIVOR':
      return 'success'
    case 'ACTIVE':
      return 'success'
    case 'SLIPPING':
      return 'muted'
    case 'QUIET':
      return 'muted'
    case 'COLD':
      return 'muted'
    default:
      return 'default'
  }
}

export function getPressureGap(row, allRows, relationType = null) {
  if (!relationType) {
    const gapAhead = getGapAhead(row, allRows)
    const gapBehind = getGapBehind(row, allRows)

    if (gapAhead !== null && gapBehind !== null) {
      return gapAhead <= gapBehind ? 'ahead' : 'behind'
    }

    return gapAhead !== null ? 'ahead' : gapBehind !== null ? 'behind' : null
  }

  if (relationType === 'ahead') {
    return getGapAhead(row, allRows)
  }

  if (relationType === 'behind') {
    return getGapBehind(row, allRows)
  }

  return null
}

export function getMomentumChip(row, allRows = [], activityType = 'pressups') {
  return getRowStatus(row, allRows, activityType)
}
