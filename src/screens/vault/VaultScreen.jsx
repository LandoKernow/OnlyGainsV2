import { Card } from '../../components/Card'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useVaultRecords } from '../../hooks/useVaultRecords'
import { formatActivityValue } from '../../utils/activity'

function VaultRecordCard({ title, record, holder, year, unitHint }) {
  return (
    <article className="vault-card">
      <div className="vault-card__heading">
        <strong>{title}</strong>
      </div>
      <div className="vault-card__value">{record}</div>
      <div className="vault-card__meta">
        <span>{holder}</span>
        <span>{year}</span>
      </div>
      {unitHint ? <p className="muted vault-card__hint">{unitHint}</p> : null}
    </article>
  )
}

function VaultLockedCard({ title }) {
  return (
    <article className="vault-card vault-card--locked">
      <div className="vault-card__heading">
        <strong>{title}</strong>
        <span className="vault-card__badge">Locked</span>
      </div>
      <div className="vault-card__value">Unlock with profile PBs</div>
      <p className="muted vault-card__hint">Profile PBs will power these soon.</p>
    </article>
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
    <div className="screen">
      <div className="stack-lg">
        <Card title="THE VAULT" body="Records are remembered.">
          <div className="stack">
            <p className="muted">Take the board. Keep the record.</p>
          </div>
        </Card>

        <Card title={`Vault ${currentYear}`} body="Current year Vault.">
          {isLoading ? <p className="muted">Loading legacy totals…</p> : null}
          {error ? <p className="muted">Unable to load Vault records.</p> : null}
          {!isLoading && !error ? (
            <div className="vault-grid">
              <VaultRecordCard
                title="Most press-ups / day"
                record={pressupsDay ? formatActivityValue(pressupsDay.value, 'pressups') : 'No record yet'}
                holder={pressupsDay ? pressupsDay.actorName : 'No holder yet'}
                year={pressupsDay ? currentYear : '—'}
                unitHint="Highest single-day total this year."
              />
              <VaultRecordCard
                title="Most press-ups / week"
                record={pressupsWeek ? formatActivityValue(pressupsWeek.value, 'pressups') : 'No record yet'}
                holder={pressupsWeek ? pressupsWeek.actorName : 'No holder yet'}
                year={pressupsWeek ? currentYear : '—'}
                unitHint="Highest single-week total this year."
              />
              <VaultRecordCard
                title="Most KM / day"
                record={kmDay ? formatActivityValue(kmDay.value, 'km') : 'No record yet'}
                holder={kmDay ? kmDay.actorName : 'No holder yet'}
                year={kmDay ? currentYear : '—'}
                unitHint="Highest single-day KM total this year."
              />
              <VaultRecordCard
                title="Most KM / week"
                record={kmWeek ? formatActivityValue(kmWeek.value, 'km') : 'No record yet'}
                holder={kmWeek ? kmWeek.actorName : 'No holder yet'}
                year={kmWeek ? currentYear : '—'}
                unitHint="Highest single-week KM total this year."
              />
              <VaultLockedCard title="Fastest 5K" />
              <VaultLockedCard title="Fastest 10K" />
              <VaultLockedCard title="Half marathon" />
              <VaultLockedCard title="Marathon" />
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
