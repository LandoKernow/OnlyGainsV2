// Shared builders for logic tests. Activity dates use the app's storage
// convention: London calendar day at 12:00Z.
export const NOW = new Date('2026-10-07T10:00:00.000Z') // Wed 7 Oct 2026, 11:00 London (BST)

let sequence = 0

export function submission(userId, value, day, extra = {}) {
  sequence += 1

  return {
    id: `${userId}-${day}-${sequence}`,
    userId,
    actorName: userId.toUpperCase(),
    activityType: 'pressups',
    value,
    activityDate: `${day}T12:00:00.000Z`,
    createdAt: `${day}T09:00:00.000Z`,
    pending: false,
    ...extra,
  }
}
