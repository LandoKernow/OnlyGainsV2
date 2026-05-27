import { useBoard } from '../features/boards/BoardProvider'

export function useBoardMeta() {
  return useBoard()
}
