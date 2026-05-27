import { supabase } from '../lib/supabase'

export async function fetchAdminStatus() {
  if (!supabase) {
    return {
      isAdmin: false,
      rpcValue: null,
      errorCode: null,
      errorMessage: 'Supabase client is not configured.',
    }
  }

  const { data, error } = await supabase.rpc('is_current_user_admin')

  if (error) {
    return {
      isAdmin: false,
      rpcValue: null,
      errorCode: error.code ?? null,
      errorMessage: error.message ?? null,
    }
  }

  return {
    isAdmin: data === true,
    rpcValue: data ?? null,
    errorCode: null,
    errorMessage: null,
  }
}

export async function fetchIsAdmin() {
  const status = await fetchAdminStatus()
  return status.isAdmin === true
}
