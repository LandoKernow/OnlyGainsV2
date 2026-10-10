import { beforeEach, describe, expect, it, vi } from 'vitest'

// A tiny PostgREST stand-in: a submissions table served in oldest-first order
// with a server-side row cap, plus a profiles table — enough to exercise the
// paging contract without a network.
const state = vi.hoisted(() => ({ submissions: [], profiles: [], serverCap: 1000, rangeCalls: [], profileCalls: 0 }))

vi.mock('../lib/supabase', () => {
  function submissionsQuery(withCount) {
    const builder = {
      eq: () => builder,
      order: () => builder,
      range(from, to) {
        state.rangeCalls.push([from, to])
        const end = Math.min(to, from + state.serverCap - 1)
        return Promise.resolve({
          data: state.submissions.slice(from, end + 1),
          error: null,
          count: withCount ? state.submissions.length : null,
        })
      },
    }
    return builder
  }

  return {
    supabase: {
      from(table) {
        if (table === 'profiles') {
          return {
            select: () => ({
              in(_column, ids) {
                state.profileCalls += 1
                return Promise.resolve({ data: state.profiles.filter((profile) => ids.includes(profile.id)), error: null })
              },
            }),
          }
        }

        return { select: (_columns, options) => submissionsQuery(Boolean(options?.count)) }
      },
    },
  }
})

const { fetchLeaderboardSubmissions, fetchOwnTrainingDayKeys } = await import('./submissions')

function seed(count, { users = 3 } = {}) {
  state.submissions = Array.from({ length: count }, (_, index) => ({
    id: `s${String(index).padStart(5, '0')}`,
    user_id: `u${index % users}`,
    value: 10,
    source: 'app_v2',
    activity_date: `2026-${String(1 + Math.floor(index / 300) % 12).padStart(2, '0')}-15T12:00:00.000Z`,
    created_at: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
  }))
  state.profiles = Array.from({ length: users }, (_, index) => ({ id: `u${index}`, name: `Warrior ${index}` }))
}

beforeEach(() => {
  state.serverCap = 1000
  state.rangeCalls = []
  state.profileCalls = 0
})

describe('fetchLeaderboardSubmissions', () => {
  it('reads past the 1000-row cap so season totals are complete', async () => {
    seed(2501)

    const rows = await fetchLeaderboardSubmissions({ circleId: 'board', year: 2026, activityType: 'pullups' })

    expect(rows).toHaveLength(2501)
    expect(state.rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('steps by what the server actually returns when its cap is lower than the page', async () => {
    seed(1200)
    state.serverCap = 500

    const rows = await fetchLeaderboardSubmissions({ circleId: 'board', year: 2026, activityType: 'pressups' })

    expect(rows).toHaveLength(1200)
    expect(new Set(rows.map((row) => row.id)).size).toBe(1200)
  })

  it('keeps the row shape and newest-first order every consumer relies on', async () => {
    seed(3)

    const rows = await fetchLeaderboardSubmissions({ circleId: 'board', year: 2026, activityType: 'km' })

    expect(rows.map((row) => row.id)).toEqual(['s00002', 's00001', 's00000'])
    expect(rows[0]).toEqual({
      id: 's00002',
      circleId: 'board',
      userId: 'u2',
      activityType: 'km',
      value: 10,
      unit: 'km',
      source: 'app_v2',
      activityDate: '2026-01-15T12:00:00.000Z',
      createdAt: rows[0].createdAt,
      note: '',
      actorName: 'Warrior 2',
      pending: false,
    })
  })

  it('batches the name lookup for big boards', async () => {
    seed(250, { users: 250 })

    const rows = await fetchLeaderboardSubmissions({ circleId: 'board', year: 2026, activityType: 'pressups' })

    expect(state.profileCalls).toBe(3)
    expect(rows.every((row) => row.actorName.startsWith('Warrior'))).toBe(true)
  })
})

describe('fetchOwnTrainingDayKeys', () => {
  it('returns each London training day once', async () => {
    seed(900)

    const days = await fetchOwnTrainingDayKeys({ userId: 'u0', year: 2026 })

    expect(days).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
  })
})
