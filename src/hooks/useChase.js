import { calculateChase } from '../logic/leaderboard/calculateChase'

export function useChase(rows, currentUserId, activityType = 'pressups') {
  return calculateChase(rows, currentUserId, activityType)
}
