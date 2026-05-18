function getOvertakeGap(currentUserRow, rowAbove) {
  return Math.max((rowAbove?.total ?? 0) - (currentUserRow?.total ?? 0) + 1, 1)
}

function getDefendGap(currentUserRow, rowBelow) {
  return Math.max((currentUserRow?.total ?? 0) - (rowBelow?.total ?? 0), 0)
}

function getSuggestedActionCopy(gapToCatch) {
  if (gapToCatch <= 10) {
    return '10 reps takes the spot.'
  }

  if (gapToCatch <= 20) {
    return '20 reps puts you ahead.'
  }

  if (gapToCatch <= 50) {
    return 'One set of 50 takes the spot.'
  }

  return `${Math.ceil(gapToCatch / 50)} more sets of 50 takes the spot.`
}

export function calculateChase(rows, currentUserId) {
  if (!rows.length) {
    return {
      state: 'off-board',
      currentUserRow: null,
      rowAbove: null,
      rowBelow: null,
      gapToCatch: null,
      gapToDefend: null,
      suggestedAction: null,
    }
  }

  const currentIndex = rows.findIndex((row) => row.userId === currentUserId)

  if (currentIndex === -1) {
    return {
      state: 'off-board',
      currentUserRow: null,
      rowAbove: null,
      rowBelow: null,
      gapToCatch: null,
      gapToDefend: null,
      suggestedAction: null,
    }
  }

  const currentUserRow = rows[currentIndex]
  const rowAbove = currentIndex > 0 ? rows[currentIndex - 1] : null
  const rowBelow = currentIndex < rows.length - 1 ? rows[currentIndex + 1] : null
  const gapToCatch = rowAbove ? getOvertakeGap(currentUserRow, rowAbove) : null
  const gapToDefend = rowBelow ? getDefendGap(currentUserRow, rowBelow) : null

  return {
    state: currentUserRow.rank === 1 ? 'crown' : 'active',
    currentUserRow,
    rowAbove,
    rowBelow,
    gapToCatch,
    gapToDefend,
    suggestedAction: gapToCatch ? getSuggestedActionCopy(gapToCatch) : null,
  }
}
