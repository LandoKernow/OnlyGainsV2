/**
 * Lightweight status/heat system using existing data only.
 * No new tables, no expensive calculations.
 */

export function getRowStatus(row, allRows = []) {
  if (row.pending) {
    return null
  }

  // Rank 1: crown holder
  if (row.rank === 1) {
    return row.todayTotal >= 50 ? 'CROWN' : 'HOLDING'
  }

  // Top 3: in the mix
  if (row.rank <= 3) {
    if (row.todayTotal >= 100) {
      return 'WAR'
    }
    if (row.todayTotal >= 50) {
      return 'TOP3'
    }
  }

  // High activity momentum
  if (row.todayTotal >= 100) {
    return 'HOT'
  }

  // Check if someone is hunting (gap behind is small)
  const rankBelow = allRows.find((r) => r.rank === row.rank + 1)
  if (rankBelow) {
    const gapBehind = (row.total || 0) - (rankBelow.total || 0)
    if (gapBehind > 0 && gapBehind <= 20) {
      return 'HUNTED'
    }
  }

  // Check if close to overtaking (gap ahead is small)
  const rankAbove = allRows.find((r) => r.rank === row.rank - 1)
  if (rankAbove) {
    const gapAhead = (rankAbove.total || 0) - (row.total || 0)
    if (gapAhead > 0 && gapAhead <= 20) {
      return 'DANGEROUS'
    }
  }

  // Recent activity today = active
  if (row.todayTotal > 0) {
    return 'ACTIVE'
  }

  // No activity = cold (but only show if we have useful data)
  return null
}

export function getStatusStyle(status) {
  if (!status) {
    return {}
  }

  const styles = {
    CROWN: { color: 'var(--color-orange)' },
    HOLDING: { color: 'var(--color-orange)' },
    WAR: { color: 'var(--color-red)' },
    HOT: { color: 'var(--color-green)' },
    TOP3: { color: 'var(--color-orange)' },
    HUNTED: { color: 'var(--color-red)' },
    DANGEROUS: { color: 'var(--color-orange)' },
    ACTIVE: { color: 'var(--color-green)' },
  }

  return styles[status] || {}
}

export function getPressureGap(row, allRows, relationType = null) {
  if (!relationType) {
    // Determine automatically based on position
    const rankAbove = allRows.find((r) => r.rank === row.rank - 1)
    const rankBelow = allRows.find((r) => r.rank === row.rank + 1)

    if (rankAbove && rankBelow) {
      const gapAhead = (rankAbove.total || 0) - (row.total || 0)
      const gapBehind = (row.total || 0) - (rankBelow.total || 0)
      return gapAhead <= gapBehind ? 'ahead' : 'behind'
    }

    return rankAbove ? 'ahead' : rankBelow ? 'behind' : null
  }

  if (relationType === 'ahead') {
    const rankAbove = allRows.find((r) => r.rank === row.rank - 1)
    if (!rankAbove) return null
    return (rankAbove.total || 0) - (row.total || 0)
  }

  if (relationType === 'behind') {
    const rankBelow = allRows.find((r) => r.rank === row.rank + 1)
    if (!rankBelow) return null
    return (row.total || 0) - (rankBelow.total || 0)
  }

  return null
}

/**
 * Simple "momentum" chip for a single row.
 * Returns null if no interesting momentum.
 */
export function getMomentumChip(row) {
  if (row.pending) {
    return 'PENDING'
  }

  if (row.rank === 1) {
    return 'CROWN'
  }

  if (row.todayTotal >= 100) {
    return 'HOT'
  }

  if (row.rank <= 3 && row.todayTotal >= 50) {
    return 'PRESSURE'
  }

  return null
}
