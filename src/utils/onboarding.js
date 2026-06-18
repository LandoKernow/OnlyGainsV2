// Pure first-target selection — computed from real board data, never random.
import { ONBOARDING_CONFIG } from '../config/onboarding'

// Picks the newcomer's first chase target from the live leaderboard rows.
//   rows           — ranked leaderboard rows (desc by total), as the board has
//   currentUserRow — the newcomer's row, or null if they haven't logged yet
//   activityType   — discipline the target is framed around
// Returns { rival, gap, beatable, framing } or { framing: 'be-hunted' } when
// the board is too small to offer a real target.
// Reps/distance needed to OVERTAKE a rival from your current total — the same
// "+1 to pass" semantics the chase uses (calculateChase.getOvertakeGap), so
// the First Mission number and the chase number mean the same thing.
function overtakeGap(rivalTotal, myTotal, activityType) {
  const precision = activityType === 'km' ? 0.1 : 1
  const raw = Math.max((rivalTotal ?? 0) - (myTotal ?? 0) + precision, precision)
  return activityType === 'km' ? Math.round(raw * 10) / 10 : Math.ceil(raw)
}

export function pickFirstTarget(rows, currentUserRow, activityType = ONBOARDING_CONFIG.firstTargetActivity, recruiter = null) {
  const maxGap = ONBOARDING_CONFIG.beatableGap[activityType] ?? ONBOARDING_CONFIG.beatableGap.pressups
  const userId = currentUserRow?.userId
  const myTotal = currentUserRow?.total ?? 0

  // Auto-rivalry: a recruited warrior's first target is the recruiter who
  // dragged them in — overrides the generic pick. Falls through to the normal
  // selection when there's no recruiter.
  if (recruiter?.recruiterId && recruiter.recruiterId !== userId) {
    const recruiterRow = (rows ?? []).find((row) => row.userId === recruiter.recruiterId)
    const gap = recruiterRow ? overtakeGap(recruiterRow.total, myTotal, activityType) : null

    return {
      rival: { userId: recruiter.recruiterId, actorName: recruiter.recruiterName || recruiterRow?.actorName || 'YOUR RECRUITER', total: recruiterRow?.total ?? 0 },
      gap,
      beatable: gap == null || gap <= maxGap,
      framing: 'recruiter',
    }
  }

  const others = (rows ?? []).filter((row) => !row.pending && row.userId !== userId && (row.total ?? 0) > 0)

  if (others.length === 0) {
    // Empty / one-warrior board: nobody to hunt yet.
    return { rival: null, gap: null, beatable: false, framing: 'be-hunted' }
  }

  // Ranked newcomer: the warrior directly above them.
  if (currentUserRow && Number.isFinite(currentUserRow.rank)) {
    const above = rows
      .filter((row) => !row.pending && row.userId !== userId && (row.total ?? 0) > (currentUserRow.total ?? 0))
      .sort((a, b) => a.total - b.total)[0]

    if (above) {
      const gap = overtakeGap(above.total, myTotal, activityType)
      return { rival: above, gap, beatable: gap <= maxGap, framing: 'chase' }
    }

    // Already top of the board.
    return { rival: null, gap: null, beatable: false, framing: 'be-hunted' }
  }

  // Unranked newcomer (no logs yet): hand them the most catchable warrior —
  // the smallest real total on the board.
  const easiest = [...others].sort((a, b) => a.total - b.total)[0]
  const gap = overtakeGap(easiest.total, myTotal, activityType)
  return { rival: easiest, gap, beatable: gap <= maxGap, framing: 'chase' }
}
