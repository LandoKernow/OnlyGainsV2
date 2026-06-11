import { formatActivityGap, formatKm } from '../../utils/activity'

function getSafeName(name) {
  return name || 'Someone'
}

export function getLeaderboardComment(row) {
  if (row.pending) {
    return 'Board updating...'
  }

  if (row.rank === 1) {
    return row.todayTotal >= 50 ? 'Untouchable' : 'Holding'
  }

  // Sparse, competitive commentary. Reserve for top 3 and high activity only.
  if (row.todayTotal >= 100) {
    return 'War mode'
  }

  if (row.todayTotal >= 50 && row.rank <= 3) {
    return 'Pressure'
  }

  // Compress: no comment for lower activity unless top 3
  return ''
}

export function getRecentActivityCopy(row, currentUserId) {
  if (row.pending) {
    if (row.activityType === 'km') {
      return `Saving ${formatKm(row.value)}...`
    }
    return row.activityType === 'pullups' ? `Saving ${row.value} pull-ups...` : `Saving ${row.value} press-ups...`
  }

  const actor = row.userId === currentUserId ? 'You' : getSafeName(row.actorName)

  if (row.activityType === 'km') {
    if (row.value >= 10) {
      return `${actor} banked distance: ${formatKm(row.value)}.`
    }
    if (row.value >= 5) {
      return `${actor} moved the board: ${formatKm(row.value)}.`
    }
    return `${actor} broke silence with ${formatKm(row.value)}.`
  }

  // Pull-ups: same energy, thresholds scaled to bar work.
  if (row.activityType === 'pullups') {
    if (row.value >= 30) {
      return `${actor} brought heat on the bar: ${row.value} pull-ups.`
    }

    if (row.value >= 20) {
      return `${actor} took ground: ${row.value} pull-ups.`
    }

    if (row.value >= 12) {
      return `${actor} added pressure: ${row.value} pull-ups.`
    }

    if (row.value >= 6) {
      return `${actor} moved the board: ${row.value} pull-ups.`
    }

    return `${actor} broke silence: ${row.value} pull-ups.`
  }

  // Press-ups: varied language
  if (row.value >= 100) {
    return `${actor} brought heat: ${row.value} reps.`
  }

  if (row.value >= 75) {
    return `${actor} took ground: ${row.value} reps.`
  }

  if (row.value >= 50) {
    return `${actor} added pressure: ${row.value} reps.`
  }

  if (row.value >= 30) {
    return `${actor} moved the board: ${row.value} reps.`
  }

  if (row.value >= 20) {
    return `${actor} defended position: ${row.value} reps.`
  }

  return `${actor} broke silence: ${row.value} reps.`
}

export function getChaseCopy(chase, activityType = 'pressups') {
  if (chase.state === 'off-board') {
    return {
      title: 'Join the board',
      primary: "You're not ranked yet.",
      secondary: 'Log first. Make them chase.',
      action: null,
    }
  }

  if (chase.currentUserRow?.rank === 1) {
    return {
      title: 'DEFENDING',
      primary: 'You hold the crown.',
      secondary: chase.rowBelow
        ? `${getSafeName(chase.rowBelow.actorName)} is ${formatActivityGap(chase.gapToDefend, activityType)} behind.`
        : 'You stand alone.',
      action: chase.rowBelow ? "Don't go quiet." : 'Keep the board under you.',
    }
  }

  if (chase.rowAbove && chase.rowBelow) {
    const gapMsg = chase.gapToCatch ? `${formatActivityGap(chase.gapToCatch, activityType)} to break through.` : ''
    return {
      title: 'HUNTING',
      primary: `${getSafeName(chase.rowAbove.actorName)} can feel you.`,
      secondary: gapMsg,
      action: chase.gapToCatch
        ? activityType === 'km'
          ? 'One good log changes this.'
          : `One more set breaks them.`
        : 'Close the gap.',
    }
  }

  if (chase.rowAbove) {
    const gapMsg = chase.gapToCatch ? `${formatActivityGap(chase.gapToCatch, activityType)} to take the spot.` : ''
    return {
      title: 'CHASING',
      primary: `${getSafeName(chase.rowAbove.actorName)} is exposed.`,
      secondary: gapMsg,
      action: 'Take the spot.',
    }
  }

  if (chase.rowBelow) {
    return {
      title: 'HUNTED',
      primary: "You're exposed.",
      secondary: chase.gapToDefend
        ? `${getSafeName(chase.rowBelow.actorName)} only needs ${formatActivityGap(chase.gapToDefend, activityType)}.`
        : 'Hold the line.',
      action: 'One log changes this.',
    }
  }

  return {
    title: 'LEADING',
    primary: 'You stand alone.',
    secondary: 'Log work. Find a rival.',
    action: null,
  }
}
