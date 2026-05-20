import { formatKm } from '../../utils/activity'

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

  if (row.activityType === 'km') {
    return `${actor} logged ${formatKm(row.value)}.`
  }

  if (row.value >= 100) {
    return `${actor} brought heat: ${row.value} reps.`
  }

  if (row.value >= 50) {
    return `${actor} logged ${row.value} reps.`
  }

  if (row.value >= 20) {
    return `${actor} logged ${row.value} reps.`
  }

  return `${actor} added ${row.value} reps.`
}

export function getChaseCopy(chase) {
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
        ? `${getSafeName(chase.rowBelow.actorName)} is ${chase.gapToDefend} behind.`
        : 'Protect your lead.',
      action: 'Keep the pressure on.',
    }
  }

  if (chase.rowAbove && chase.rowBelow) {
    const gapMsg = chase.gapToCatch ? `${chase.gapToCatch} ahead.` : ''
    return {
      title: 'HUNTING',
      primary: `${getSafeName(chase.rowAbove.actorName)} is slipping.`,
      secondary: gapMsg,
      action: chase.gapToCatch ? `${chase.gapToCatch} takes the spot.` : 'Close the gap.',
    }
  }

  if (chase.rowAbove) {
    return {
      title: 'CHASING',
      primary: `${getSafeName(chase.rowAbove.actorName)} is ahead.`,
      secondary: chase.gapToCatch ? `${chase.gapToCatch} to catch.` : '',
      action: 'Make your move.',
    }
  }

  if (chase.rowBelow) {
    return {
      title: 'HUNTED',
      primary: `${getSafeName(chase.rowBelow.actorName)} is hunting you.`,
      secondary: chase.gapToDefend ? `${chase.gapToDefend} behind.` : '',
      action: 'Defend the gap.',
    }
  }

  return {
    title: 'LEADING',
    primary: 'You stand alone.',
    secondary: 'Keep moving. Make someone chase.',
    action: null,
  }
}
