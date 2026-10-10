import { formatKm } from '../../utils/activity'

function getSafeName(name) {
  return name || 'Someone'
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
