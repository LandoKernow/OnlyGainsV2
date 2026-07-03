import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'
import { INACTIVITY_CONFIG } from '../config/inactivity'

const EMPTY_SET = new Set()

// The set of FALLEN warriors, for board-DISPLAY filtering only. Their data is
// untouched (stage 1 is reversible); they simply don't render on boards until
// a qualifying log raises them. Entirely dormant while the inactivity system
// is disabled: the query never fires and every consumer sees an empty set.
async function fetchFallenIds() {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('inactivity_state')
    .select('user_id')
    .eq('status', 'fallen')

  if (error) {
    // Table not live / transient error -> filter nothing (fail open: showing
    // a fallen user is recoverable; hiding an active one is not acceptable).
    return []
  }

  return (data ?? []).map((row) => row.user_id)
}

export function useFallenUserIds() {
  const { status } = useAuth()

  const query = useQuery({
    queryKey: ['inactivity', 'fallen-ids'],
    queryFn: fetchFallenIds,
    enabled: INACTIVITY_CONFIG.enabled && status === 'authenticated',
    staleTime: 60_000,
  })

  if (!INACTIVITY_CONFIG.enabled || !query.data || query.data.length === 0) {
    return EMPTY_SET
  }

  return new Set(query.data)
}
