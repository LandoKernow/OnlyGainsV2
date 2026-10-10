import { describe, expect, it } from 'vitest'
import { NOW, submission } from '../test/fixtures'
import { calculateCombo, calculateHybridStreak, calculateStreak, getMilestone, getWarTier } from './war'

describe('calculateStreak', () => {
  it('counts consecutive London days ending today', () => {
    const rows = ['2026-10-05', '2026-10-06', '2026-10-07'].map((day) => submission('me', 10, day))

    expect(calculateStreak(rows, 'me', NOW)).toEqual({ streakDays: 3, activeToday: true, atRisk: false })
  })

  it('keeps a streak that ended yesterday alive but at risk until midnight', () => {
    const rows = ['2026-10-04', '2026-10-05', '2026-10-06'].map((day) => submission('me', 10, day))

    expect(calculateStreak(rows, 'me', NOW)).toEqual({ streakDays: 3, activeToday: false, atRisk: true })
  })

  it('breaks on a missed day and ignores other warriors', () => {
    const rows = [
      submission('me', 10, '2026-10-04'),
      submission('me', 10, '2026-10-06'),
      submission('you', 10, '2026-10-05'),
    ]

    expect(calculateStreak(rows, 'me', NOW).streakDays).toBe(1)
  })
})

describe('calculateHybridStreak', () => {
  it('counts a day trained in ANY discipline: run Monday, lift Tuesday, bar today', () => {
    const streak = calculateHybridStreak(
      {
        km: [submission('me', 5, '2026-10-05', { activityType: 'km' })],
        pressups: [submission('me', 50, '2026-10-06')],
        pullups: [submission('me', 10, '2026-10-07', { activityType: 'pullups' })],
      },
      'me',
      { now: NOW },
    )

    expect(streak).toEqual({ streakDays: 3, activeToday: true, atRisk: false })
  })

  it('folds in training days logged on other boards', () => {
    const streak = calculateHybridStreak(
      { pressups: [submission('me', 50, '2026-10-06')] },
      'me',
      { extraDayKeys: ['2026-10-04', '2026-10-05'], now: NOW },
    )

    expect(streak).toEqual({ streakDays: 3, activeToday: false, atRisk: true })
  })
})

describe('calculateCombo', () => {
  it('counts consecutive heavy days for one discipline', () => {
    const rows = [
      submission('me', 60, '2026-10-05'),
      submission('me', 60, '2026-10-05'),
      submission('me', 100, '2026-10-06'),
      submission('me', 99, '2026-10-07'),
    ]

    // Today (99) is under the press-up threshold, so the run counts back from yesterday.
    expect(calculateCombo(rows, 'me', 'pressups', NOW)).toBe(2)
  })
})

describe('tiers and milestones', () => {
  it('ladders weekly volume per discipline', () => {
    expect(getWarTier(0)).toBe('RECRUIT')
    expect(getWarTier(250)).toBe('VETERAN')
    expect(getWarTier(60, 'pullups')).toBe('VETERAN')
    expect(getWarTier(0.5, 'km')).toBe('SOLDIER')
  })

  it('only fires a milestone on the log that crosses it', () => {
    expect(getMilestone({ previousWeeklyTotal: 90, weeklyTotal: 110, streakDays: 1 })).toMatch(/FIRST 100/)
    expect(getMilestone({ previousWeeklyTotal: 110, weeklyTotal: 130, streakDays: 1 })).toBe('')
    expect(getMilestone({ previousWeeklyTotal: 0, weeklyTotal: 1, streakDays: 7 })).toMatch(/7 DAY STREAK/)
  })
})
