import { supabase } from '../lib/supabase'

export async function fetchIsAdmin() {
  if (!supabase) {
    return false
  }

  const { data, error } = await supabase.rpc('is_current_user_admin')

  if (error) {
    if (import.meta.env.DEV) {
      console.debug('[Only Gains Admin] is_current_user_admin failed', {
        code: error.code ?? null,
        message: error.message ?? null,
      })
    }

    return false
  }

  return data === true
}
