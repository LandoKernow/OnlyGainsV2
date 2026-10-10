import { describe, expect, it } from 'vitest'
import { calculateMonthlyStandard, crossesStandard, getStandardCalendar, getStandardMilestone } from './standard'

// Sat 10 Oct 2026, 13:00 London. October has 31 days.
const NOW = new Date('2026-10-10T12:00:00.000Z')

describe('getStandardCalendar', () => {
  it('lays out the month and both pace lines', () => {
    expect(getStandardCalendar(NOW, 2000)).toMatchObject({
      monthKey: '2026-10',
      monthName: 'OCTOBER',
      day: 10,
      daysInMonth: 31,
      daysLeft: 22,
      paceThroughYesterday: 581, // 2000 * 9 / 31, rounded up
      paceThroughToday: 646, // 2000 * 10 / 31, rounded up
    })
  })

  it('handles the last day and leap Februaries', () => {
    expect(getStandardCalendar(new Date('2026-10-31T12:00:00.000Z'), 2000)).toMatchObject({ daysLeft: 1, paceThroughToday: 2000 })
    expect(getStandardCalendar(new Date('2028-02-10T12:00:00.000Z')).daysInMonth).toBe(29)
  })
})

describe('calculateMonthlyStandard', () => {
  const monthlyRows = [
    { userId: 'tank', actorName: 'TANK', total: 2140 },
    { userId: 'me', actorName: 'ME', total: 600 },
    { userId: 'slow', actorName: 'SLOW', total: 300 },
  ]

  it('builds a roll call with statuses, per-day asks and silent members', () => {
    const standard = calculateMonthlyStandard({
      monthlyRows,
      rosterRows: [{ userId: 'ghost', actorName: 'GHOST' }, { userId: 'tank', actorName: 'TANK' }],
      userId: 'me',
      now: NOW,
      target: 2000,
    })

    expect(standard.rollCall.map((entry) => [entry.userId, entry.status, entry.position])).toEqual([
      ['tank', 'MET', 1],
      ['me', 'ON PACE', 2],
      ['slow', 'BEHIND', 3],
      ['ghost', 'SILENT', 4],
    ])
    expect(standard.counts).toEqual({ MET: 1, 'ON PACE': 1, BEHIND: 1, SILENT: 1 })
    expect(standard.me).toMatchObject({ remaining: 1400, perDay: 64, todayToPace: 46, isCurrentUser: true })
    expect(standard.rollCall[0]).toMatchObject({ progress: 1, surplus: 140, perDay: 0 })
  })

  it('lets a fresher optimistic total move your bar instantly', () => {
    const standard = calculateMonthlyStandard({ monthlyRows, userId: 'me', ownTotal: 700, now: NOW, target: 2000 })

    expect(standard.me.total).toBe(700)
    expect(standard.me.todayToPace).toBe(0)
  })

  it('puts a warrior with nothing logged on the roll call as SILENT', () => {
    const standard = calculateMonthlyStandard({ monthlyRows: [], userId: 'new', now: NOW, target: 2000 })

    expect(standard.me).toMatchObject({ total: 0, status: 'SILENT', remaining: 2000, perDay: 91 })
  })
})

describe('milestones', () => {
  it('fires on the log that crosses a mark, highest mark first', () => {
    expect(getStandardMilestone(1990, 2010)).toMatch(/STANDARD IS MET/)
    expect(getStandardMilestone(900, 2100)).toMatch(/STANDARD IS MET/)
    expect(getStandardMilestone(1480, 1510)).toMatch(/1,500/)
    expect(getStandardMilestone(980, 1000)).toMatch(/HALFWAY/)
    expect(getStandardMilestone(2010, 2040)).toBe('')
  })

  it('detects crossing the standard exactly once', () => {
    expect(crossesStandard(1980, 2000)).toBe(true)
    expect(crossesStandard(2000, 2030)).toBe(false)
    expect(crossesStandard(100, 130)).toBe(false)
  })
})
