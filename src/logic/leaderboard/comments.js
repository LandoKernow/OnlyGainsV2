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
    return row.activityType === 'km' ? `Saving ${formatKm(row.value)}...` : `Saving ${row.value} press-ups...`
  }

  const actor = row.userId === currentUserId ? 'You' : getSafeName(row.actorName)
  const isPressup = row.activityType !== 'km'

  if (row.activityType === 'km') {
    if (row.value >= 10) {
      return `${actor} banked ${formatKm(row.value)}.`
    }
    if (row.value >= 5) {
      return `${actor} put road work in: ${formatKm(row.value)}.`
    }
    return `${actor} logged ${formatKm(row.value)}.`
  }

  // Press-ups: varied language
  if (row.value >= 100) {
    return `${actor} brought heat: ${row.value} reps.`
  }

  if (row.value >= 75) {
    return `${actor} dropped ${row.value}.`
  }

  if (row.value >= 50) {
    return `${actor} added ${row.value} to the board.`
  }

  if (row.value >= 30) {
    return `${actor} moved the board: ${row.value} reps.`
  }

  if (row.value >= 20) {
    return `${actor} logged ${row.value} reps.`
  }

  return `${actor} added ${row.value} reps.`
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
      action: chase.rowBelow ? "Don't go quiet." : 'Keep the pressure on.',
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
          ? `${formatActivityGap(chase.gapToCatch, activityType)} closes it.`
          : `One set of ${Math.min(chase.gapToCatch, 50)} closes it.`
        : 'Close the gap.',
    }
  }

  if (chase.rowAbove) {
    const gapMsg = chase.gapToCatch ? `${formatActivityGap(chase.gapToCatch, activityType)} to take the spot.` : ''
    return {
      title: 'CHASING',
      primary: `${getSafeName(chase.rowAbove.actorName)} is exposed.`,
      secondary: gapMsg,
      action: 'Make your move.',
    }
  }

  if (chase.rowBelow) {
    return {
      title: 'HUNTED',
      primary: `${getSafeName(chase.rowBelow.actorName)} is hunting you.`,
      secondary: chase.gapToDefend ? `Only ${formatActivityGap(chase.gapToDefend, activityType)} keeps them off you.` : 'Hold the line.',
      action: 'One log keeps them back.',
    }
  }

  return {
    title: 'LEADING',
    primary: 'You stand alone.',
    secondary: 'Log work. Find a rival.',
    action: null,
  }
}
