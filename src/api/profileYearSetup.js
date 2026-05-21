import { supabase } from '../lib/supabase'
import {
  normalizeProfileMonthlyTotals,
  normalizeProfileRecordEntries,
  normalizeProfileYearPayload,
  validateTimeSeconds,
} from '../utils/profileYear'

function mapProfileYear(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    userId: row.user_id,
    year: row.year,
    age: row.age,
    sex: row.sex,
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    weightIsPublic: Boolean(row.weight_is_public),
    setupStatus: row.setup_status,
    claimedAt: row.claimed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapProfileRecordEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    year: row.year,
    recordType: row.record_type,
    unit: row.unit,
    valueNumeric: row.value_numeric === null ? null : Number(row.value_numeric),
    valueSeconds: row.value_seconds === null ? null : Number(row.value_seconds),
    sourceLabel: row.source_label,
    visibility: row.visibility,
    claimedAt: row.claimed_at,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapProfileMonthlyTotal(row) {
  return {
    id: row.id,
    userId: row.user_id,
    year: row.year,
    month: row.month,
    activityType: row.activity_type,
    total: Number(row.total),
    sourceLabel: row.source_label,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPublicProfileRecordEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    year: row.year,
    recordType: row.record_type,
    unit: row.unit,
    valueNumeric: row.value_numeric === null ? null : Number(row.value_numeric),
    valueSeconds: row.value_seconds === null ? null : validateTimeSeconds(row.value_seconds),
    comparableValue: row.comparable_value === null ? null : Number(row.comparable_value),
    sourceLabel: row.source_label,
    claimedAt: row.claimed_at,
    actorName: row.actor_name || '',
    avatar: row.avatar || '',
    accentColor: row.accent_color || '',
  }
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }
}

export function getProfileYearQueryKey(userId, year) {
  return ['profile-year', userId, year]
}

export function getProfileRecordEntriesQueryKey(userId, year) {
  return ['profile-year-records', userId, year]
}

export function getProfileMonthlyTotalsQueryKey(userId, year) {
  return ['profile-year-monthly-totals', userId, year]
}

export function getPublicProfileRecordEntriesQueryKey(year) {
  return ['public-profile-records', year]
}

export async function fetchProfileYear(userId, year) {
  ensureSupabase()

  const { data, error } = await supabase
    .from('profile_years')
    .select('id,user_id,year,age,sex,weight_kg,weight_is_public,setup_status,claimed_at,created_at,updated_at')
    .eq('user_id', userId)
    .eq('year', year)
    .maybeSingle()

  if (error) {
    throw error
  }

  return mapProfileYear(data)
}

export async function upsertProfileYear(userId, year, payload = {}) {
  ensureSupabase()

  const normalized = normalizeProfileYearPayload({ ...payload, year })
  const shouldClaim = normalized.setupStatus === 'claimed'

  const upsertPayload = {
    user_id: userId,
    year,
    age: normalized.age,
    sex: normalized.sex,
    weight_kg: normalized.weightKg,
    weight_is_public: normalized.weightIsPublic,
    setup_status: normalized.setupStatus,
    claimed_at: shouldClaim ? normalized.claimedAt ?? new Date().toISOString() : null,
  }

  const { data, error } = await supabase
    .from('profile_years')
    .upsert(upsertPayload, { onConflict: 'user_id,year' })
    .select('id,user_id,year,age,sex,weight_kg,weight_is_public,setup_status,claimed_at,created_at,updated_at')
    .single()

  if (error) {
    throw error
  }

  return mapProfileYear(data)
}

export async function fetchProfileRecordEntries(userId, year) {
  ensureSupabase()

  const { data, error } = await supabase
    .from('profile_record_entries')
    .select('id,user_id,year,record_type,unit,value_numeric,value_seconds,source_label,visibility,claimed_at,verified_at,verified_by,notes,created_at,updated_at')
    .eq('user_id', userId)
    .eq('year', year)
    .order('record_type', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map(mapProfileRecordEntry)
}

export async function upsertProfileRecordEntries(userId, year, records = []) {
  ensureSupabase()

  const normalizedRecords = normalizeProfileRecordEntries(records)
  const recordTypesToKeep = new Set(normalizedRecords.map((record) => record.recordType))
  const existingEntries = await fetchProfileRecordEntries(userId, year)
  const entriesToDelete = existingEntries.filter((entry) => !recordTypesToKeep.has(entry.recordType))

  if (entriesToDelete.length > 0) {
    const idsToDelete = entriesToDelete.map((entry) => entry.id)
    const { error: deleteError } = await supabase
      .from('profile_record_entries')
      .delete()
      .in('id', idsToDelete)

    if (deleteError) {
      throw deleteError
    }
  }

  if (normalizedRecords.length === 0) {
    return []
  }

  const payload = normalizedRecords.map((record) => ({
    user_id: userId,
    year,
    record_type: record.recordType,
    unit: record.unit,
    value_numeric: record.valueNumeric,
    value_seconds: record.valueSeconds,
    source_label: 'self_reported',
    visibility: 'public',
    verified_at: null,
    verified_by: null,
  }))

  const { data, error } = await supabase
    .from('profile_record_entries')
    .upsert(payload, { onConflict: 'user_id,year,record_type' })
    .select('id,user_id,year,record_type,unit,value_numeric,value_seconds,source_label,visibility,claimed_at,verified_at,verified_by,notes,created_at,updated_at')

  if (error) {
    throw error
  }

  return (data ?? []).map(mapProfileRecordEntry)
}

export async function fetchProfileMonthlyTotals(userId, year) {
  ensureSupabase()

  const { data, error } = await supabase
    .from('profile_monthly_totals')
    .select('id,user_id,year,month,activity_type,total,source_label,visibility,created_at,updated_at')
    .eq('user_id', userId)
    .eq('year', year)
    .order('month', { ascending: true })
    .order('activity_type', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map(mapProfileMonthlyTotal)
}

export async function upsertProfileMonthlyTotals(userId, year, totals = []) {
  ensureSupabase()

  const normalizedTotals = normalizeProfileMonthlyTotals(totals)
  const totalsToKeep = normalizedTotals.map((total) => ({
    month: total.month,
    activityType: total.activityType,
  }))

  const existingTotals = await fetchProfileMonthlyTotals(userId, year)
  const totalsToDelete = existingTotals.filter(
    (existingTotal) =>
      !totalsToKeep.some(
        (total) => total.month === existingTotal.month && total.activityType === existingTotal.activityType,
      ),
  )

  if (totalsToDelete.length > 0) {
    const idsToDelete = totalsToDelete.map((total) => total.id)
    const { error: deleteError } = await supabase
      .from('profile_monthly_totals')
      .delete()
      .in('id', idsToDelete)

    if (deleteError) {
      throw deleteError
    }
  }

  if (normalizedTotals.length === 0) {
    return []
  }

  const payload = normalizedTotals.map((total) => ({
    user_id: userId,
    year,
    month: total.month,
    activity_type: total.activityType,
    total: total.total,
    source_label: 'self_reported',
    visibility: 'private',
  }))

  const { data, error } = await supabase
    .from('profile_monthly_totals')
    .upsert(payload, { onConflict: 'user_id,year,month,activity_type' })
    .select('id,user_id,year,month,activity_type,total,source_label,visibility,created_at,updated_at')

  if (error) {
    throw error
  }

  return (data ?? []).map(mapProfileMonthlyTotal)
}

export async function fetchPublicProfileRecordEntries(year) {
  ensureSupabase()

  const { data, error } = await supabase
    .from('public_profile_record_entries')
    .select('id,user_id,year,record_type,unit,value_numeric,value_seconds,comparable_value,source_label,claimed_at,actor_name,avatar,accent_color')
    .eq('year', year)
    .order('record_type', { ascending: true })
    .order('comparable_value', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []).map(mapPublicProfileRecordEntry)
}
