function getSafeName(name) {
  return name || 'Someone'
}

export function getLeaderboardComment(row) {
  if (row.pending) {
    return 'Board updating...'
  }

  if (row.rank === 1) {
    return 'Holding the crown'
  }

  // Simpler, unit-agnostic commenting
  if (row.todayTotal >= 100) {
    return row.isCurrentUser ? 'War mode' : 'Bringing the heat'
  }

  if (row.todayTotal >= 50) {
    return 'Pressure rising'
  }

  if (row.todayTotal > 0) {
    return row.rank <= 3 ? 'Closing the gap' : 'On the board'
  }

  if (row.total > 0) {
    return 'Still quiet today'
  }

  return 'Board watching'
}

export function getRecentActivityCopy(row, currentUserId) {
  if (row.pending) {
    return row.activityType === 'km' ? `Saving ${row.value} km...` : `Saving ${row.value} press-ups...`
  }

  const actor = row.userId === currentUserId ? 'You' : getSafeName(row.actorName)

  if (row.activityType === 'km') {
    if (row.value >= 50) {
      return `${actor} logged ${row.value} km.`
    }

    return `${actor} logged ${Number(row.value).toFixed(1)} km.`
  }

  if (row.value >= 100) {
    return `${actor} brought heat with ${row.value} press-ups.`
  }

  if (row.value >= 50) {
    return `${actor} put ${row.value} press-ups on the board.`
  }

  if (row.value >= 20) {
    return `${actor} is no longer hiding — ${row.value} press-ups logged.`
  }

  return `${actor} added ${row.value} reps. Board saw it.`
}
