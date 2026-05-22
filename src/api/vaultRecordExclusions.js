import { supabase } from '../lib/supabase'

function mapVaultRecordExclusion(row) {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    recordType: row.record_type,
    reason: row.reason,
    excludedBy: row.excluded_by,
    createdAt: row.created_at,
  }
}

export function getVaultRecordExclusionsQueryKey() {
  return ['vault', 'record-exclusions']
}

export async function fetchVaultRecordExclusions() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase
    .from('vault_record_exclusions')
    .select('id,source_type,source_id,record_type,reason,excluded_by,created_at')

  if (error) {
    const message = String(error.message || '').toLowerCase()
    const missingTable =
      error.code === 'PGRST205' ||
      message.includes('vault_record_exclusions') && message.includes('does not exist')

    if (missingTable) {
      return []
    }

    throw error
  }

  return (data ?? []).map(mapVaultRecordExclusion)
}
