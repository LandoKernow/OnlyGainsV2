import { describe, expect, it } from 'vitest'
import { calculateChase } from './calculateChase'

const board = [
  { userId: 'a', total: 120, rank: 1 },
  { userId: 'b', total: 100, rank: 2 },
  { userId: 'c', total: 95, rank: 3 },
]

describe('calculateChase', () => {
  it('needs one more than the gap to overtake, and reports the cushion below', () => {
    const chase = calculateChase(board, 'b')

    expect(chase.rowAbove.userId).toBe('a')
    expect(chase.gapToCatch).toBe(21)
    expect(chase.rowBelow.userId).toBe('c')
    expect(chase.gapToDefend).toBe(5)
  })

  it('works in hundredths for km', () => {
    const km = [
      { userId: 'a', total: 10.5, rank: 1 },
      { userId: 'b', total: 7.25, rank: 2 },
    ]

    expect(calculateChase(km, 'b', 'km').gapToCatch).toBe(3.26)
  })

  it('marks the leader as holding the crown, and off-board users as such', () => {
    expect(calculateChase(board, 'a').state).toBe('crown')
    expect(calculateChase(board, 'zed').state).toBe('off-board')
    expect(calculateChase([], 'a').state).toBe('off-board')
  })
})
