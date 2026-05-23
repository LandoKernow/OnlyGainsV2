import { Card } from '../../components/Card'
import { useToast } from '../../components/ToastProvider'
import { AuthGate } from '../../features/auth/AuthGate'
import { getLondonPeriodKeys } from '../../utils/dates'

const BETA_CIRCLE_ID = 'c769af17-6d63-41aa-8293-a4fd74d586f8'

function buildWeeklySql() {
  return `select *
from public.admin_finalize_period_awards_all(
  '${BETA_CIRCLE_ID}'::uuid,
  'weekly',
  (date_trunc('week', timezone('Europe/London', now()))::date - 7)
);`
}

function buildMonthlySql() {
  return `select *
from public.admin_finalize_period_awards_all(
  '${BETA_CIRCLE_ID}'::uuid,
  'monthly',
  (date_trunc('month', timezone('Europe/London', now()))::date - interval '1 month')::date
);`
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  document.body.appendChild(textarea)
  textarea.select()

  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }

  return Promise.resolve()
}

export default function AdminAwardsScreen() {
  const { showToast } = useToast()
  const { weekKey, monthKey } = getLondonPeriodKeys(new Date())
  const lastCompletedWeek = new Date(`${weekKey}T12:00:00.000Z`)
  lastCompletedWeek.setUTCDate(lastCompletedWeek.getUTCDate() - 7)
  const lastCompletedWeekKey = lastCompletedWeek.toISOString().slice(0, 10)
  const lastCompletedMonth = new Date(`${monthKey}-01T12:00:00.000Z`)
  lastCompletedMonth.setUTCMonth(lastCompletedMonth.getUTCMonth() - 1)
  const lastCompletedMonthKey = lastCompletedMonth.toISOString().slice(0, 10)

  async function handleCopy(sql, label) {
    try {
      await copyText(sql)
      showToast({ tone: 'success', message: `${label} SQL copied.` })
    } catch {
      showToast({ tone: 'error', message: 'Could not copy SQL.' })
    }
  }

  const weeklySql = buildWeeklySql()
  const monthlySql = buildMonthlySql()

  return (
    <div className="screen">
      <AuthGate>
        <div className="stack-lg">
          <Card title="ADMIN AWARDS" body="Run this in Supabase SQL editor. Awards are final, not live crowns.">
            <div className="stack">
              <div className="profile-identity-grid">
                <div className="profile-identity-grid__row">
                  <span className="muted">Circle</span>
                  <strong>{BETA_CIRCLE_ID}</strong>
                </div>
                <div className="profile-identity-grid__row">
                  <span className="muted">Last completed week</span>
                  <strong>{lastCompletedWeekKey}</strong>
                </div>
                <div className="profile-identity-grid__row">
                  <span className="muted">Last completed month</span>
                  <strong>{lastCompletedMonthKey}</strong>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Finalise last week" body="Press Ups, KM, and Double Crown check.">
            <div className="stack">
              <pre className="admin-sql-block">{weeklySql}</pre>
              <button className="button" type="button" onClick={() => handleCopy(weeklySql, 'Weekly')}>
                Copy weekly SQL
              </button>
            </div>
          </Card>

          <Card title="Finalise last month" body="Press Ups, KM, and Double Crown check.">
            <div className="stack">
              <pre className="admin-sql-block">{monthlySql}</pre>
              <button className="button" type="button" onClick={() => handleCopy(monthlySql, 'Monthly')}>
                Copy monthly SQL
              </button>
            </div>
          </Card>
        </div>
      </AuthGate>
    </div>
  )
}
