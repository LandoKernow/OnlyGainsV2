import { calculateChase } from '../logic/leaderboard/calculateChase'

export function useChase(rows, currentUserId) {
  return calculateChase(rows, currentUserId)
}
