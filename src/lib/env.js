function readOptional(key) {
  const value = import.meta.env[key]

  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function normalizeSupabaseUrl(url) {
  return url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/g, '')
}

const rawSupabaseUrl = readOptional('VITE_SUPABASE_URL')
const rawSupabaseAnonKey = readOptional('VITE_SUPABASE_ANON_KEY')

export const appEnv = {
  supabaseUrl: rawSupabaseUrl ? normalizeSupabaseUrl(rawSupabaseUrl) : '',
  supabaseAnonKey: rawSupabaseAnonKey,
  defaultCircleId: readOptional('VITE_DEFAULT_CIRCLE_ID'),
  appName: readOptional('VITE_APP_NAME') || 'Only Gains 2.0',
  appEnv: readOptional('VITE_APP_ENV') || 'development',
  telegramUrl: readOptional('VITE_TELEGRAM_URL'),
}

export const envIssues = [
  !appEnv.supabaseUrl ? 'Missing VITE_SUPABASE_URL' : null,
  !appEnv.supabaseAnonKey ? 'Missing VITE_SUPABASE_ANON_KEY' : null,
]
  .filter(Boolean)
  .join('. ')
