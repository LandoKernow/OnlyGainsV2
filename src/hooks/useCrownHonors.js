import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'

// The honors ledger IS the events table: crown events are persisted with
// recipient = winner, so a user's crowns are just their own CROWN /
// DOUBLE_CROWN / TREBLE rows (RLS-scoped). No extra tables.
async function fetchCrownEvents() {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('notification_events')
    .select('id, type, payload, created_at, read_at')
    .in('type', ['CROWN', 'DOUBLE_CROWN', 'TREBLE'])
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    throw error
  }

  return data ?? []
}

export function useCrownHonors() {
  const { status } = useAuth()

  const query = useQuery({
    queryKey: ['notifications', 'crowns'],
    queryFn: fetchCrownEvents,
    enabled: status === 'authenticated',
    staleTime: 60_000,
  })

  const events = query.data ?? []
  const trebleCount = events.filter((event) => event.type === 'TREBLE').length
  const doubleCount = events.filter((event) => event.type === 'DOUBLE_CROWN').length
  const crownCount = events.filter((event) => event.type === 'CROWN').length
  // Total crowns won, counting doubles as 2 and trebles as 3.
  const totalCrowns = crownCount + doubleCount * 2 + trebleCount * 3
  const latest = events[0] ?? null

  return {
    isLoading: query.isLoading,
    events,
    crownCount,
    doubleCount,
    trebleCount,
    totalCrowns,
    latest,
    // The latest unconsumed TREBLE drives the next-open takeover.
    latestTreble: events.find((event) => event.type === 'TREBLE') ?? null,
  }
}
