import { supabase } from '../lib/supabase'

function isMissingRpc(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    message.includes('finalize_period_awards_all_admin') && message.includes('could not find') ||
    message.includes('function') && message.includes('does not exist')
  )
}

export function isAdminOnlyError(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    error?.code === '42501' ||
    message.includes('admin only') ||
    message.includes('permission denied')
  )
}

export async function finalizePeriodAwardsAllAdmin({ circleId, periodType, periodStart }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase.rpc('finalize_period_awards_all_admin', {
    p_circle_id: circleId,
    p_period_type: periodType,
    p_period_start: periodStart,
  })

  if (error) {
    if (isMissingRpc(error)) {
      const rpcError = new Error('Admin RPC not ready.')
      rpcError.code = 'RPC_NOT_READY'
      throw rpcError
    }

    throw error
  }

  return Array.isArray(data) ? data : data ? [data] : []
}
