import { Card } from '../../components/Card'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useVaultRecords } from '../../hooks/useVaultRecords'
import { formatActivityValue } from '../../utils/activity'

function VaultRecordCard({ title, record, holder, year, hasRecord }) {
  return (
    <article className="vault-card vault-record-card">
      <strong>{title}</strong>
      <div className="vault-card__value">{record}</div>
      {hasRecord ? (
        <>
          <div className="vault-card__holder">{holder}</div>
          <div className="vault-card__status">CURRENT HOLDER · {year}</div>
        </>
      ) : (
        <div className="vault-card__empty">No holder yet. Log enough to leave a mark.</div>
      )}
    </article>
  )
}

function VaultFutureSection() {
  const futureTitles = ['Fastest 5K', 'Fastest 10K', 'Half marathon', 'Marathon']

  return (
    <Card title="COMING NEXT" body="Profile PBs will power these soon.">
      <div className="vault-future">
        {futureTitles.map((title) => (
          <span key={title} className="vault-future-chip">
            {title}
          </span>
        ))}
      </div>
    </Card>
  )
}

export default function VaultScreen() {
  const { circleId } = useBoardMeta()
  const { records, isLoading, error, currentYear } = useVaultRecords({ circleId })

  const pressupsDay = records.pressupsDay
  const pressupsWeek = records.pressupsWeek
  const kmDay = records.kmDay
  const kmWeek = records.kmWeek

  return (
    <div className="screen screen--vault">
      <div className="stack-lg">
        <Card title="THE VAULT" body="Records are remembered.">
          <div className="stack">
            <p className="muted">Take the board. Keep the record.</p>
          </div>
        </Card>

        <div className="vault-intro">
          <p className="vault-intro__eyebrow">{currentYear} RECORDS</p>
          <p className="vault-intro__copy">Current year Vault.</p>
        </div>

        {!isLoading && !error ? (
          <div className="vault-records">
            <VaultRecordCard
              title="Most press-ups / day"
              record={pressupsDay ? formatActivityValue(pressupsDay.value, 'pressups') : 'No record yet'}
              holder={pressupsDay ? pressupsDay.actorName : ''}
              year={currentYear}
              hasRecord={Boolean(pressupsDay)}
            />
            <VaultRecordCard
              title="Most press-ups / week"
              record={pressupsWeek ? formatActivityValue(pressupsWeek.value, 'pressups') : 'No record yet'}
              holder={pressupsWeek ? pressupsWeek.actorName : ''}
              year={currentYear}
              hasRecord={Boolean(pressupsWeek)}
            />
            <VaultRecordCard
              title="Most KM / day"
              record={kmDay ? formatActivityValue(kmDay.value, 'km') : 'No record yet'}
              holder={kmDay ? kmDay.actorName : ''}
              year={currentYear}
              hasRecord={Boolean(kmDay)}
            />
            <VaultRecordCard
              title="Most KM / week"
              record={kmWeek ? formatActivityValue(kmWeek.value, 'km') : 'No record yet'}
              holder={kmWeek ? kmWeek.actorName : ''}
              year={currentYear}
              hasRecord={Boolean(kmWeek)}
            />
          </div>
        ) : null}

        {isLoading ? <p className="muted">Loading legacy totals…</p> : null}
        {error ? <p className="muted">Unable to load Vault records.</p> : null}

        <VaultFutureSection />
      </div>
    </div>
  )
}
