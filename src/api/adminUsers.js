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
    if (import.meta.env.DEV) {
      console.debug('[Only Gains Admin] is_current_user_admin failed', {
        code: error.code ?? null,
        message: error.message ?? null,
      })
    }

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
