import { supabase } from '../lib/supabase'

function mapVaultAward(row, profilesByUserId = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    circleId: row.circle_id,
    awardType: row.award_type,
    activityType: row.activity_type,
    periodType: row.period_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    recordType: row.record_type,
    valueNumeric: row.value_numeric === null ? null : Number(row.value_numeric),
    valueSeconds: row.value_seconds === null ? null : Number(row.value_seconds),
    unit: row.unit,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    quote: row.quote,
    imagePath: row.image_path,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    actorName: profilesByUserId[row.user_id]?.name ?? 'Unknown',
  }
}

export function getVaultAwardsQueryKey(circleId) {
  return ['vault', 'awards', circleId]
}

export async function fetchVaultAwards(circleId) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase
    .from('vault_awards')
    .select('id,user_id,circle_id,award_type,activity_type,period_type,period_start,period_end,record_type,value_numeric,value_seconds,unit,source_type,source_id,title,quote,image_path,metadata,created_at')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false })
    .limit(6)

  if (error) {
    const message = String(error.message || '').toLowerCase()
    const missingTable =
      error.code === 'PGRST205' ||
      message.includes('vault_awards') && message.includes('does not exist')

    if (missingTable) {
      return []
    }

    throw error
  }

  const userIds = [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean))]
  let profilesByUserId = {}

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id,name')
      .in('id', userIds)

    if (profilesError) {
      throw profilesError
    }

    profilesByUserId = Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]))
  }

  return (data ?? []).map((row) => mapVaultAward(row, profilesByUserId))
}
