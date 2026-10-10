import { describe, expect, it } from 'vitest'
import { getLondonPeriodKeys, getSubmissionPeriodKeys } from './dates'

describe('getSubmissionPeriodKeys', () => {
  it('keys a stored activity date to its London day, Monday week, month and year', () => {
    expect(getSubmissionPeriodKeys('2026-10-07T12:00:00.000Z')).toEqual({
      todayKey: '2026-10-07',
      weekKey: '2026-10-05',
      monthKey: '2026-10',
      yearKey: '2026',
    })
  })

  it('treats Sunday as the last day of the Monday-start week', () => {
    expect(getSubmissionPeriodKeys('2026-10-11T12:00:00.000Z').weekKey).toBe('2026-10-05')
    expect(getSubmissionPeriodKeys('2026-10-12T12:00:00.000Z').weekKey).toBe('2026-10-12')
  })

  it('resolves a late-evening UTC timestamp to the next London day in BST', () => {
    // 23:30Z on 7 Oct is 00:30 on 8 Oct in London.
    expect(getSubmissionPeriodKeys('2026-10-07T23:30:00.000Z').todayKey).toBe('2026-10-08')
  })

  it('returns the same memoised, frozen keys for a repeated date string', () => {
    const first = getSubmissionPeriodKeys('2026-03-01T12:00:00.000Z')
    const second = getSubmissionPeriodKeys('2026-03-01T12:00:00.000Z')

    expect(second).toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
  })

  it('agrees with getLondonPeriodKeys for the same instant', () => {
    const instant = '2026-01-01T00:30:00.000Z'
    expect(getSubmissionPeriodKeys(instant)).toEqual(getLondonPeriodKeys(new Date(instant)))
  })
})
