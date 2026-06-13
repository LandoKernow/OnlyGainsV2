import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'
import { CROWNS_CONFIG } from '../config/crowns'

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

const TIER_RANK = { CROWN: 1, DOUBLE_CROWN: 2, TREBLE: 3 }
const TIER_LABEL = { CROWN: 'CROWN', DOUBLE_CROWN: 'DOUBLE CROWN', TREBLE: 'TREBLE WARRIOR' }

// Active (decaying) title. The most recent period in which the user held any
// crown sets the live badge; older periods decay out per config. With decay
// disabled, the badge is the user's best lifetime tier (never drops).
function deriveActiveTitle(events) {
  if (events.length === 0) {
    return null
  }

  if (!CROWNS_CONFIG.decay.enabled) {
    const best = events.reduce((max, event) => Math.max(max, TIER_RANK[event.type] ?? 0), 0)
    const tier = Object.keys(TIER_RANK).find((key) => TIER_RANK[key] === best)
    return tier ? { tier, label: TIER_LABEL[tier], defended: true } : null
  }

  // Group by period (periodKey + period), newest first by created_at.
  const periods = []
  const seen = new Set()

  for (const event of events) {
    const key = `${event.payload?.period ?? 'weekly'}:${event.payload?.periodKey ?? event.id}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    periods.push(event)
  }

  // The grace window: the active title is the best tier within the most recent
  // (1 + gracePeriods) crowned periods. Beyond that it has decayed away.
  const window = periods.slice(0, 1 + CROWNS_CONFIG.decay.gracePeriods)
  const bestRank = window.reduce((max, event) => Math.max(max, TIER_RANK[event.type] ?? 0), 0)
  const tier = Object.keys(TIER_RANK).find((key) => TIER_RANK[key] === bestRank)

  if (!tier) {
    return null
  }

  // "Defended" = held at the most recent crowned period (didn't just coast on
  // an older treble through the grace window).
  const defended = TIER_RANK[periods[0].type] >= bestRank

  return { tier, label: TIER_LABEL[tier], defended }
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

  return {
    isLoading: query.isLoading,
    events,
    crownCount,
    doubleCount,
    trebleCount,
    totalCrowns,
    latest: events[0] ?? null,
    activeTitle: deriveActiveTitle(events),
    // Most recent double/treble drives the next-open takeover.
    latestTakeover: events.find((event) => CROWNS_CONFIG.takeoverTiers.includes(event.type)) ?? null,
    // Kept for any existing callers.
    latestTreble: events.find((event) => event.type === 'TREBLE') ?? null,
  }
}
