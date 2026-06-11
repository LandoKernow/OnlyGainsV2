import { supabase } from '../lib/supabase'
import { fetchPublicProfileRecordEntries } from './profileYearSetup'
import { fetchLeaderboardSubmissions } from './submissions'
import { fetchVaultAwards } from './vaultAwards'
import { calculateLeaderboard } from '../logic/leaderboard/calculateLeaderboard'

const LOWER_IS_BETTER_RECORD_TYPES = new Set(['fastest_5k', 'fastest_10k', 'half_marathon', 'marathon'])

function mapPublicProfile(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name || 'Board member',
    avatar: row.avatar || '',
    accentColor: row.accent_color || '',
    boardStatus: row.board_status || '',
    createdAt: row.created_at || null,
  }
}

function comparePublicRecords(a, b) {
  const lowerIsBetter = LOWER_IS_BETTER_RECORD_TYPES.has(a.recordType)
  const aValue = lowerIsBetter ? Number(a.valueSeconds ?? 0) : Number(a.comparableValue ?? a.valueNumeric ?? 0)
  const bValue = lowerIsBetter ? Number(b.valueSeconds ?? 0) : Number(b.comparableValue ?? b.valueNumeric ?? 0)

  if (aValue !== bValue) {
    return lowerIsBetter ? aValue - bValue : bValue - aValue
  }

  return new Date(b.claimedAt ?? 0).getTime() - new Date(a.claimedAt ?? 0).getTime()
}

async function fetchPublicProfileBasics(userId) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,avatar,accent_color,board_status,created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return mapPublicProfile(data)
}

function buildFallbackName({ userId, awards, records, pressupsRow, kmRow }) {
  return (
    awards[0]?.actorName ||
    records[0]?.actorName ||
    pressupsRow?.actorName ||
    kmRow?.actorName ||
    (userId ? `Member ${String(userId).slice(0, 6)}` : 'Board member')
  )
}

export async function fetchPublicProfileSummary({ userId, circleId, year = 2026 }) {
  const [profileResult, awardsResult, recordEntriesResult, pressupsResult, pullupsResult, kmResult] = await Promise.allSettled([
    fetchPublicProfileBasics(userId),
    fetchVaultAwards(circleId, { userId, limit: 12 }),
    fetchPublicProfileRecordEntries(year),
    fetchLeaderboardSubmissions({ circleId, year, activityType: 'pressups' }),
    fetchLeaderboardSubmissions({ circleId, year, activityType: 'pullups' }),
    fetchLeaderboardSubmissions({ circleId, year, activityType: 'km' }),
  ])

  const awards = awardsResult.status === 'fulfilled' ? awardsResult.value : []
  const allPublicRecords = recordEntriesResult.status === 'fulfilled' ? recordEntriesResult.value : []
  const publicRecords = allPublicRecords
    .filter((row) => row.userId === userId)
    .sort(comparePublicRecords)
  const pressupsRows = pressupsResult.status === 'fulfilled' ? pressupsResult.value : []
  const pullupsRows = pullupsResult.status === 'fulfilled' ? pullupsResult.value : []
  const kmRows = kmResult.status === 'fulfilled' ? kmResult.value : []
  const pressupsBoard = calculateLeaderboard(pressupsRows, {
    period: 'weekly',
    currentUserId: userId,
  })
  const pullupsBoard = calculateLeaderboard(pullupsRows, {
    period: 'weekly',
    currentUserId: userId,
  })
  const kmBoard = calculateLeaderboard(kmRows, {
    period: 'weekly',
    currentUserId: userId,
  })

  const fallbackName = buildFallbackName({
    userId,
    awards,
    records: publicRecords,
    pressupsRow: pressupsBoard.currentUserRow,
    kmRow: kmBoard.currentUserRow,
  })

  const profile =
    profileResult.status === 'fulfilled' && profileResult.value
      ? profileResult.value
      : {
          id: userId,
          name: fallbackName,
          avatar: '',
          accentColor: '',
          boardStatus: '',
          createdAt: null,
        }

  return {
    profile,
    awards,
    publicRecords,
    topPublicRecords: publicRecords.slice(0, 3),
    awardsCount: awards.length,
    vaultClaimsCount: publicRecords.length,
    leaderboard: {
      pressups: pressupsBoard.currentUserRow,
      pullups: pullupsBoard.currentUserRow,
      km: kmBoard.currentUserRow,
    },
    canReadProfileBasics: profileResult.status === 'fulfilled' && Boolean(profileResult.value),
  }
}
