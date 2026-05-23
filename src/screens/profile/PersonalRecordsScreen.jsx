import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthGate } from '../../features/auth/AuthGate'
import { Card } from '../../components/Card'
import { usePersonalRecords } from '../../hooks/usePersonalRecords'
import { formatActivityValue } from '../../utils/activity'
import {
  formatDurationFromSeconds,
  PROFILE_YEAR_RECORD_LABELS,
} from '../../utils/profileYear'

const RECORD_CATEGORIES = [
  { key: 'pressups_day', tab: 'Press-ups Day', title: 'MOST PRESS-UPS / DAY', activityType: 'pressups' },
  { key: 'pressups_week', tab: 'Press-ups Week', title: 'MOST PRESS-UPS / WEEK', activityType: 'pressups' },
  { key: 'pressups_set', tab: 'Press-ups Set', title: 'MAX PRESS-UPS / SET', activityType: 'pressups' },
  { key: 'pullups_day', tab: 'Pull-ups Day', title: 'MOST PULL-UPS / DAY', activityType: 'pressups' },
  { key: 'pullups_week', tab: 'Pull-ups Week', title: 'MOST PULL-UPS / WEEK', activityType: 'pressups' },
  { key: 'pullups_set', tab: 'Pull-ups Set', title: 'MAX PULL-UPS / SET', activityType: 'pressups' },
  { key: 'km_day', tab: 'KM Day', title: 'MOST KM / DAY', activityType: 'km' },
  { key: 'km_week', tab: 'KM Week', title: 'MOST KM / WEEK', activityType: 'km' },
  { key: 'fastest_5k', tab: '5K', title: '5K RECORD', activityType: 'seconds' },
  { key: 'fastest_10k', tab: '10K', title: '10K RECORD', activityType: 'seconds' },
  { key: 'half_marathon', tab: 'Half', title: 'HALF MARATHON', activityType: 'seconds' },
  { key: 'marathon', tab: 'Marathon', title: 'MARATHON', activityType: 'seconds' },
  { key: 'longest_run', tab: 'Longest Run', title: 'LONGEST RUN', activityType: 'km' },
]

const WALL_GROUPS = [
  {
    key: 'pressups',
    title: 'PRESS UPS',
    recordTypes: ['pressups_day', 'pressups_week', 'pressups_set'],
  },
  {
    key: 'pullups',
    title: 'PULL UPS',
    recordTypes: ['pullups_day', 'pullups_week', 'pullups_set'],
  },
  {
    key: 'running',
    title: 'KM / RUNNING',
    recordTypes: ['km_day', 'km_week', 'longest_run', 'fastest_5k', 'fastest_10k', 'half_marathon', 'marathon'],
  },
]

function formatSourceLabel(sourceLabel, year) {
  return `${String(sourceLabel || '').replace(/_/g, '-').toUpperCase()} ${String.fromCharCode(183)} ${year ?? 2026}`
}

function getGroupPriority(recordType) {
  const priorityMap = {
    pressups_set: 3,
    pressups_day: 2,
    pressups_week: 1,
    pullups_set: 3,
    pullups_day: 2,
    pullups_week: 1,
    longest_run: 6,
    km_week: 5,
    half_marathon: 4,
    marathon: 3,
    fastest_10k: 2,
    fastest_5k: 1,
    km_day: 0,
  }

  return priorityMap[recordType] ?? 0
}

function formatRecordValue(record, category) {
  if (!record) {
    return 'NO RECORD YET'
  }

  if (record.unit === 'seconds' || category.activityType === 'seconds') {
    return formatDurationFromSeconds(record.valueSeconds)
  }

  if (record.unit === 'km' || category.activityType === 'km') {
    return formatActivityValue(record.valueNumeric, 'km')
  }

  return formatActivityValue(record.valueNumeric, 'pressups')
}

function getHeroCopy(record, category, hasAppTrackedSupport) {
  if (!record) {
    return {
      body: 'Nothing claimed. Put a number on the wall.',
      actionLabel: 'Build 2026 profile',
      actionTo: '/profile/year/2026',
    }
  }

  if (record.sourceLabel === 'app_tracked') {
    return {
      body: 'Earned live. The board saw it.',
      actionLabel: 'Log now',
      actionTo: '/dashboard',
    }
  }

  if (category.activityType === 'seconds') {
    return {
      body: 'Claimed for now. Verified later. The clock is watching.',
      actionLabel: 'Update in 2026 profile',
      actionTo: '/profile/year/2026',
    }
  }

  return {
    body: hasAppTrackedSupport
      ? 'Claimed from your 2026 profile. The number to beat.'
      : 'Claimed for now. Verified later. The number to beat.',
    actionLabel: 'Update in 2026 profile',
    actionTo: '/profile/year/2026',
  }
}

function PersonalRecordsContent() {
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(RECORD_CATEGORIES[0].key)
  const { recordsByType, isLoading, error, hasAppTrackedSupport } = usePersonalRecords(2026)

  const selectedCategory = RECORD_CATEGORIES.find((category) => category.key === selectedCategoryKey) ?? RECORD_CATEGORIES[0]
  const selectedRecords = recordsByType[selectedCategory.key] ?? []
  const heroRecord = selectedRecords[0] ?? null
  const heroCopy = getHeroCopy(heroRecord, selectedCategory, hasAppTrackedSupport(selectedCategory.key))

  const wallGroups = useMemo(
    () =>
      WALL_GROUPS.map((group) => {
        const rows = group.recordTypes
          .map((recordType) => {
            const bestRecord = recordsByType[recordType]?.[0] ?? null

            if (!bestRecord) {
              return null
            }

            return {
              ...bestRecord,
              recordType,
              category: RECORD_CATEGORIES.find((category) => category.key === recordType) ?? null,
            }
          })
          .filter(Boolean)
          .sort((a, b) => getGroupPriority(b.recordType) - getGroupPriority(a.recordType))
          .slice(0, 3)
          .map((record, index) => ({
            ...record,
            place: index + 1,
          }))

        return {
          ...group,
          rows,
        }
      }),
    [recordsByType],
  )
  const hasWallRows = wallGroups.some((group) => group.rows.length > 0)

  return (
    <div className="screen">
      <AuthGate>
        <div className="stack-lg">
          <Card title="PERSONAL RECORDS" body="Your best work is on record.">
            <p className="muted">The year is being written.</p>
          </Card>

          <div className="record-tabs" role="tablist" aria-label="Personal record categories">
            {RECORD_CATEGORIES.map((category) => (
              <button
                key={category.key}
                className={category.key === selectedCategoryKey ? 'record-tab record-tab--active' : 'record-tab'}
                type="button"
                role="tab"
                aria-selected={category.key === selectedCategoryKey}
                onClick={() => setSelectedCategoryKey(category.key)}
              >
                {category.tab}
              </button>
            ))}
          </div>

          <Card title={selectedCategory.title} body={PROFILE_YEAR_RECORD_LABELS[selectedCategory.key]}>
            {isLoading ? (
              <p className="muted">Loading your marks...</p>
            ) : error ? (
              <p className="muted">Could not load your records yet.</p>
            ) : (
              <div className="stack">
                <div className="records-hero">
                  <strong className="records-hero__value">{formatRecordValue(heroRecord, selectedCategory)}</strong>
                  {heroRecord ? (
                    <span className="records-hero__status">{formatSourceLabel(heroRecord.sourceLabel, heroRecord.year)}</span>
                  ) : (
                    <span className="records-hero__status">Nothing claimed.</span>
                  )}
                </div>
                <p className="muted">{heroCopy.body}</p>
                <Link className="button" to={heroCopy.actionTo}>
                  {heroCopy.actionLabel}
                </Link>
              </div>
            )}
          </Card>

          <Card title="ON THE WALL" body="Your strongest marks stay here.">
            {isLoading ? (
              <p className="muted">Loading wall history...</p>
            ) : error ? (
              <p className="muted">Could not load the wall yet.</p>
            ) : hasWallRows ? (
              <div className="stack">
                {wallGroups.map((group) =>
                  group.rows.length > 0 ? (
                    <section key={group.key} className="records-wall-group">
                      <strong className="records-wall-group__title">{group.title}</strong>
                      <div className="stack">
                        {group.rows.map((row) => (
                          <div key={`${group.key}-${row.recordType}-${row.sourceType}-${row.sourceId}`} className="records-wall-row">
                            <strong>#{row.place}</strong>
                            <span>{formatRecordValue(row, row.category ?? selectedCategory)}</span>
                            <span className="muted">{formatSourceLabel(row.sourceLabel, row.year)}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null,
                )}
              </div>
            ) : (
              <div className="stack">
                <strong>No marks yet.</strong>
                <p className="muted">Build your 2026 profile or log live work.</p>
                <Link className="button button--ghost" to="/profile/year/2026">
                  Build 2026 profile
                </Link>
              </div>
            )}
          </Card>
        </div>
      </AuthGate>
    </div>
  )
}

export default function PersonalRecordsScreen() {
  return <PersonalRecordsContent />
}
