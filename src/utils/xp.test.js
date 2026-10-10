import { describe, expect, it } from 'vitest'
import { submission } from '../test/fixtures'
import { calculateWarriorXp, getWarriorLevel, getXpForLog } from './xp'

describe('warrior XP', () => {
  it('weights disciplines and skips pending rows and other warriors', () => {
    const xp = calculateWarriorXp(
      {
        pressups: [submission('me', 100, '2026-10-01'), submission('me', 50, '2026-10-02', { pending: true })],
        pullups: [submission('me', 10, '2026-10-01'), submission('you', 99, '2026-10-01')],
        km: [submission('me', 5.5, '2026-10-01')],
      },
      'me',
    )

    expect(xp).toBe(100 + 40 + 110)
    expect(getXpForLog('pullups', 10)).toBe(40)
  })

  it('places XP on the ladder with progress to the next rank', () => {
    expect(getWarriorLevel(0)).toMatchObject({ level: 1, name: 'RECRUIT', nextLevelName: 'FOOTSOLDIER', xpToNextLevel: 500 })
    expect(getWarriorLevel(1000)).toMatchObject({ level: 2, progress: 0.5 })
    expect(getWarriorLevel(150000)).toMatchObject({ name: 'GOD OF WAR', nextLevelName: null, progress: 1 })
  })
})
