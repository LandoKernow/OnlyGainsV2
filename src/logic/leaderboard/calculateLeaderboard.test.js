import { describe, expect, it } from 'vitest'
import { NOW, submission } from '../../test/fixtures'
import { calculateLeaderboard } from './calculateLeaderboard'

describe('calculateLeaderboard', () => {
  const rows = [
    submission('ana', 50, '2026-10-05'),
    submission('ana', 30, '2026-10-07'),
    submission('ben', 100, '2026-10-06'),
    submission('cal', 500, '2026-09-30'), // last week: monthly/yearly only
    submission('dee', 20, '2025-12-31'), // last year: never counts
  ]

  it('ranks weekly totals and keeps today separate', () => {
    const { rows: ranked, currentUserRow } = calculateLeaderboard(rows, { period: 'weekly', currentUserId: 'ana', now: NOW })

    expect(ranked.map((row) => [row.userId, row.total, row.rank])).toEqual([
      ['ben', 100, 1],
      ['ana', 80, 2],
    ])
    expect(currentUserRow).toMatchObject({ userId: 'ana', total: 80, todayTotal: 30, isCurrentUser: true })
  })

  it('widens to the month and the year', () => {
    const monthly = calculateLeaderboard(rows, { period: 'monthly', currentUserId: 'ana', now: NOW })
    const yearly = calculateLeaderboard(rows, { period: 'yearly', currentUserId: 'ana', now: NOW })

    expect(monthly.rows.map((row) => row.userId)).toEqual(['ben', 'ana'])
    expect(yearly.rows.map((row) => row.userId)).toEqual(['cal', 'ben', 'ana'])
  })

  it('breaks total ties by today, then by most recent log', () => {
    const tied = [
      submission('early', 40, '2026-10-06', { createdAt: '2026-10-06T08:00:00.000Z' }),
      submission('late', 40, '2026-10-06', { createdAt: '2026-10-06T18:00:00.000Z' }),
      submission('today', 40, '2026-10-07'),
    ]

    const { rows: ranked } = calculateLeaderboard(tied, { period: 'weekly', currentUserId: null, now: NOW })
    expect(ranked.map((row) => row.userId)).toEqual(['today', 'late', 'early'])
  })

  it('flags a user with an in-flight optimistic log as pending', () => {
    const { currentUserRow } = calculateLeaderboard(
      [...rows, submission('ana', 10, '2026-10-07', { pending: true })],
      { period: 'weekly', currentUserId: 'ana', now: NOW },
    )

    expect(currentUserRow).toMatchObject({ total: 90, pending: true })
  })
})
