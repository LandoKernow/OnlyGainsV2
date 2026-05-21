import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AuthGate } from '../../features/auth/AuthGate'
import { Card } from '../../components/Card'
import { useToast } from '../../components/ToastProvider'
import { useCurrentProfile } from '../../hooks/useCurrentProfile'
import { useProfileYearSetup } from '../../hooks/useProfileYearSetup'
import {
  buildDefaultMonthlyTotalsState,
  buildDefaultRecordState,
  formatDurationFromSeconds,
  normalizeProfileYearPayload,
  parseDurationToSeconds,
  PROFILE_YEAR_MONTH_LABELS,
  PROFILE_YEAR_RECORD_LABELS,
} from '../../utils/profileYear'

const SEX_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const MONTHLY_SECTIONS = [
  { activityType: 'pressups', title: 'Press-ups Jan-Dec', hint: 'Whole numbers only.' },
  { activityType: 'pullups', title: 'Pull-ups Jan-Dec', hint: 'Whole numbers only.' },
  { activityType: 'km', title: 'KM Jan-Dec', hint: 'Up to 2 decimal places.' },
]

function buildRecordFormState(entries) {
  const baseState = buildDefaultRecordState()

  entries.forEach((entry) => {
    baseState[entry.recordType] = {
      recordType: entry.recordType,
      valueNumeric: entry.valueNumeric === null ? '' : String(entry.valueNumeric),
      valueSeconds: entry.valueSeconds === null ? '' : formatDurationFromSeconds(entry.valueSeconds),
    }
  })

  return baseState
}

function buildMonthlyFormState(monthlyTotals) {
  const baseState = buildDefaultMonthlyTotalsState()

  monthlyTotals.forEach((entry) => {
    if (!baseState[entry.activityType]) {
      return
    }

    baseState[entry.activityType][entry.month] = entry.total === null ? '' : String(entry.total)
  })

  return baseState
}

function buildProfileYearFormState(profileYear, year) {
  return {
    year,
    age: profileYear?.age === null || profileYear?.age === undefined ? '' : String(profileYear.age),
    sex: profileYear?.sex ?? '',
    weight_kg: profileYear?.weightKg === null || profileYear?.weightKg === undefined ? '' : String(profileYear.weightKg),
    weight_is_public: Boolean(profileYear?.weightIsPublic),
  }
}

function countClaimedRecords(records) {
  return records.filter((record) => {
    const hasNumeric = record.valueNumeric !== null && record.valueNumeric !== ''
    const hasSeconds = record.valueSeconds !== null && record.valueSeconds !== ''
    return hasNumeric || hasSeconds
  }).length
}

function buildSavePayload(profileYearForm, recordsForm, monthlyTotalsForm, existingProfileYear) {
  const normalizedProfileYear = normalizeProfileYearPayload(profileYearForm)
  const recordEntries = Object.values(recordsForm).map((record) => ({
    recordType: record.recordType,
    valueNumeric: record.valueNumeric,
    valueSeconds: record.valueSeconds === '' ? null : parseDurationToSeconds(record.valueSeconds),
  }))
  const monthlyTotals = Object.entries(monthlyTotalsForm).flatMap(([activityType, months]) =>
    Object.entries(months).map(([month, total]) => ({
      activityType,
      month: Number(month),
      total,
    })),
  )
  const claimedCount = countClaimedRecords(recordEntries)
  const setupStatus = claimedCount > 0 ? 'claimed' : 'draft'

  return {
    profileYear: {
      age: normalizedProfileYear.age,
      sex: normalizedProfileYear.sex,
      weight_kg: normalizedProfileYear.weightKg,
      weight_is_public: normalizedProfileYear.weightIsPublic,
      setup_status: setupStatus,
      claimed_at: setupStatus === 'claimed' ? existingProfileYear?.claimedAt ?? new Date().toISOString() : null,
    },
    recordEntries,
    monthlyTotals,
  }
}

function YearSetupContent() {
  const { year: yearParam } = useParams()
  const year = Number(yearParam)
  const { showToast } = useToast()
  const profileQuery = useCurrentProfile()
  const profileYearSetup = useProfileYearSetup(year)
  const [profileYearForm, setProfileYearForm] = useState(() => buildProfileYearFormState(null, year))
  const [recordsForm, setRecordsForm] = useState(() => buildRecordFormState([]))
  const [monthlyTotalsForm, setMonthlyTotalsForm] = useState(() => buildMonthlyFormState([]))
  const [saveError, setSaveError] = useState('')

  const isSaving =
    profileYearSetup.saveProfileYear.isPending ||
    profileYearSetup.saveRecordEntries.isPending ||
    profileYearSetup.saveMonthlyTotals.isPending

  useEffect(() => {
    if (profileYearSetup.isLoading) {
      return
    }

    setProfileYearForm(buildProfileYearFormState(profileYearSetup.profileYear, year))
    setRecordsForm(buildRecordFormState(profileYearSetup.recordEntries))
    setMonthlyTotalsForm(buildMonthlyFormState(profileYearSetup.monthlyTotals))
  }, [
    year,
    profileYearSetup.isLoading,
    profileYearSetup.profileYear,
    profileYearSetup.recordEntries,
    profileYearSetup.monthlyTotals,
  ])

  const claimedCount = useMemo(() => countClaimedRecords(Object.values(recordsForm)), [recordsForm])
  const profileName = profileQuery.data?.name || 'Warrior'

  if (!Number.isInteger(year)) {
    return (
      <Card title="Year unavailable" body="That profile year could not be opened.">
        <Link className="button" to="/profile">
          Back to Profile
        </Link>
      </Card>
    )
  }

  function updateProfileYearField(field, value) {
    setSaveError('')
    setProfileYearForm((current) => ({ ...current, [field]: value }))
  }

  function updateRecordField(recordType, field, value) {
    setSaveError('')
    setRecordsForm((current) => ({
      ...current,
      [recordType]: {
        ...current[recordType],
        [field]: value,
      },
    }))
  }

  function updateMonthlyTotal(activityType, month, value) {
    setSaveError('')
    setMonthlyTotalsForm((current) => ({
      ...current,
      [activityType]: {
        ...current[activityType],
        [month]: value,
      },
    }))
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaveError('')

    try {
      const payload = buildSavePayload(profileYearForm, recordsForm, monthlyTotalsForm, profileYearSetup.profileYear)

      await profileYearSetup.saveProfileYear.mutateAsync(payload.profileYear)
      await profileYearSetup.saveRecordEntries.mutateAsync(payload.recordEntries)
      await profileYearSetup.saveMonthlyTotals.mutateAsync(payload.monthlyTotals)

      showToast({ tone: 'success', message: `${year} profile saved.` })
    } catch (error) {
      const message = error?.message || 'Couldn’t save profile.'
      setSaveError(message)
      showToast({ tone: 'error', message: 'Couldn’t save profile.' })
    }
  }

  return (
    <div className="screen profile-year-screen">
      <AuthGate>
        <form className="stack-lg" onSubmit={handleSave}>
          <Card title={`Build your ${year} profile`} body={`Claim your ${year} records. Add what you know now. Edit later.`}>
            <div className="stack">
              <div className="stat-strip">
                <strong>{profileName}</strong>
                <span>{claimedCount} records claimed</span>
              </div>
              <p className="muted">Leave a mark. The Board is earned live. The Profile remembers the year.</p>
              <div className="profile-year-actions">
                <Link className="button button--ghost" to="/profile">
                  Back to Profile
                </Link>
              </div>
            </div>
          </Card>

          {profileYearSetup.isLoading ? (
            <Card title="Loading" body="Pulling your 2026 profile together.">
              <p className="muted">One moment.</p>
            </Card>
          ) : null}

          {profileYearSetup.error ? (
            <Card title="Load issue" body="Could not load your saved year data.">
              <p className="muted">{profileYearSetup.error.message}</p>
            </Card>
          ) : null}

          {!profileYearSetup.isLoading && !profileYearSetup.error ? (
            <>
              <Card title="Basic info" body="Optional. Used for future divisions and comparisons.">
                <div className="stack">
                  <p className="muted">Weight stays private unless you choose otherwise.</p>
                  <div className="profile-year-grid">
                    <label className="stack">
                      <span>Age</span>
                      <input
                        className="input"
                        type="number"
                        min="13"
                        max="100"
                        step="1"
                        value={profileYearForm.age}
                        onChange={(event) => updateProfileYearField('age', event.target.value)}
                        placeholder="Optional"
                      />
                    </label>

                    <label className="stack">
                      <span>Sex</span>
                      <select
                        className="input"
                        value={profileYearForm.sex}
                        onChange={(event) => updateProfileYearField('sex', event.target.value)}
                      >
                        {SEX_OPTIONS.map((option) => (
                          <option key={option.value || 'blank'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="stack">
                      <span>Weight (kg)</span>
                      <input
                        className="input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        value={profileYearForm.weight_kg}
                        onChange={(event) => updateProfileYearField('weight_kg', event.target.value)}
                        placeholder="Optional"
                      />
                    </label>
                  </div>

                  <label className="profile-year-checkbox">
                    <input
                      type="checkbox"
                      checked={profileYearForm.weight_is_public}
                      onChange={(event) => updateProfileYearField('weight_is_public', event.target.checked)}
                    />
                    <span>Allow weight to be public on future profile comparisons.</span>
                  </label>
                </div>
              </Card>

              <Card title="Claim your 2026 records" body="Claimed records are self-reported until verified.">
                <div className="stack">
                  <p className="muted">Reps use whole numbers. KM uses up to 2 decimals. Running times use mm:ss or hh:mm:ss.</p>
                  <div className="profile-year-records">
                    {Object.entries(PROFILE_YEAR_RECORD_LABELS).map(([recordType, label]) => {
                      const currentRecord = recordsForm[recordType]
                      const isTimeRecord = recordType.startsWith('fastest_') || recordType === 'half_marathon' || recordType === 'marathon'
                      const isKmRecord = recordType.startsWith('km_') || recordType === 'longest_run'

                      return (
                        <label key={recordType} className="stack profile-year-record-field">
                          <span>{label}</span>
                          <input
                            className="input"
                            type={isTimeRecord ? 'text' : 'number'}
                            min={isTimeRecord ? undefined : isKmRecord ? '0.01' : '1'}
                            step={isTimeRecord ? undefined : isKmRecord ? '0.01' : '1'}
                            inputMode={isTimeRecord ? 'text' : 'decimal'}
                            value={isTimeRecord ? currentRecord.valueSeconds : currentRecord.valueNumeric}
                            onChange={(event) =>
                              updateRecordField(
                                recordType,
                                isTimeRecord ? 'valueSeconds' : 'valueNumeric',
                                event.target.value,
                              )
                            }
                            placeholder={isTimeRecord ? 'mm:ss or hh:mm:ss' : isKmRecord ? 'Optional KM' : 'Optional reps'}
                          />
                        </label>
                      )
                    })}
                  </div>
                </div>
              </Card>

              <Card title="Monthly totals" body="These do not change the live Board.">
                <div className="stack">
                  <p className="muted">The Board is earned live. The Profile remembers the year.</p>
                  {MONTHLY_SECTIONS.map((section) => (
                    <details key={section.activityType} className="profile-year-monthly-section" open={section.activityType === 'pressups'}>
                      <summary>
                        <strong>{section.title}</strong>
                        <span>{section.hint}</span>
                      </summary>
                      <div className="profile-year-monthly-grid">
                        {PROFILE_YEAR_MONTH_LABELS.map((monthLabel, index) => {
                          const month = index + 1

                          return (
                            <label key={`${section.activityType}-${month}`} className="stack profile-year-month-field">
                              <span>{monthLabel}</span>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step={section.activityType === 'km' ? '0.01' : '1'}
                                inputMode="decimal"
                                value={monthlyTotalsForm[section.activityType][month] ?? ''}
                                onChange={(event) => updateMonthlyTotal(section.activityType, month, event.target.value)}
                                placeholder="0"
                              />
                            </label>
                          )
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              </Card>

              <Card title={`Save ${year}`} body="Power identity now. Power the Vault later.">
                <div className="stack">
                  <p className="muted">Claim records. Add yearly totals. Edit later.</p>
                  {saveError ? <p className="text-danger">{saveError}</p> : null}
                  <button className="button profile-year-save" type="submit" disabled={isSaving}>
                    {isSaving ? `Saving ${year} profile...` : `Save ${year} profile`}
                  </button>
                </div>
              </Card>
            </>
          ) : null}
        </form>
      </AuthGate>
    </div>
  )
}

export default function ProfileYearSetupScreen() {
  return <YearSetupContent />
}
