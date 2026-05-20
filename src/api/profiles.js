import { supabase } from '../lib/supabase'

function profileLog(step, details) {
  if (!import.meta.env.DEV) {
    return
  }

  if (details === undefined || details === null || details === '') {
    console.log(`[Only Gains Profile] ${step}`)
    return
  }

  console.log(`[Only Gains Profile] ${step} ${JSON.stringify(details)}`)
}

function deriveProfileName(user) {
  return (
    user?.user_metadata?.display_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'New warrior'
  )
}

export async function getMyProfile(userId) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  profileLog('profile fetch started', { userId })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar, accent_color, board_status, last_active_at, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    profileLog('profile fetch failed', { userId, error: error.message })
    throw error
  }

  profileLog('profile fetch complete', {
    userId,
    found: Boolean(data),
  })

  return data
}

export async function createMinimalProfile(user) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const payload = {
    id: user.id,
    name: deriveProfileName(user),
  }

  profileLog('profile create started', {
    userId: user.id,
    name: payload.name,
  })

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('id, name, avatar, accent_color, board_status, last_active_at, created_at')
    .single()

  if (error) {
    profileLog('profile create failed', { userId: user.id, error: error.message })
    throw error
  }

  profileLog('profile create complete', {
    userId: data.id,
    name: data.name,
  })

  return data
}

export async function ensureMyProfile(user) {
  const existingProfile = await getMyProfile(user.id)

  if (existingProfile) {
    return existingProfile
  }

  return createMinimalProfile(user)
}

export async function upsertMyProfile(profile) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  profileLog('profile update started', { userId: profile.id })

  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select('id, name, avatar, accent_color, board_status, last_active_at, created_at')
    .single()

  if (error) {
    profileLog('profile update failed', { userId: profile.id, error: error.message })
    throw error
  }

  profileLog('profile update complete', { userId: data.id, name: data.name })

  return data
}
