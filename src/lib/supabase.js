import { createClient } from '@supabase/supabase-js'
import { appEnv, envIssues } from './env'

export const supabaseSetupError = envIssues || ''

export const supabase =
  supabaseSetupError === ''
    ? createClient(appEnv.supabaseUrl, appEnv.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null
