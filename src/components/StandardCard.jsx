import { useMemo, useState } from 'react'
import { STANDARD_CONFIG } from '../config/standard'
import { ProfilePreviewModal } from './ProfilePreviewModal'
import { EffortMark } from './Brand'

// THE STANDARD: 2,000 press-ups, every warrior, every month. Leads the
// dashboard — your own progress against today's pace line, then the whole
// board's roll call as one bar chart. Every bar shares the same pace line, so
// it reads as a single vertical cut through the board: ahead of it or not.

const STATUS_CLASS = {
  MET: 'met',
  'ON PACE': 'pace',
  BEHIND: 'behind',
  SILENT: 'silent',
}

function formatReps(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-GB')
}

function StandardBar({ progress, paceRatio, status, size = 'row' }) {
  return (
    <div
      className={`standard-bar standard-bar--${size} standard-bar--${STATUS_CLASS[status]}`}
      role="presentation"
    >
      <div className="standard-bar__fill" style={{ '--fill': progress }} />
      {paceRatio > 0 && paceRatio < 1 ? (
        <span className="standard-bar__pace" style={{ left: `${paceRatio * 100}%` }} aria-hidden="true" />
      ) : null}
    </div>
  )
}

function getVerdict(me) {
  if (!me) {
    return { tone: 'silent', line: 'NOTHING BANKED THIS MONTH. THE LINE IS MOVING WITHOUT YOU.' }
  }

  switch (me.status) {
    case 'MET':
      return { tone: 'met', line: STANDARD_CONFIG.takeover.tagline }
    case 'SILENT':
      return { tone: 'silent', line: 'NOTHING BANKED THIS MONTH. THE LINE IS MOVING WITHOUT YOU.' }
    case 'BEHIND':
      return { tone: 'behind', line: `BEHIND THE LINE. ${formatReps(me.perDay)} A DAY FROM HERE — OR YOU FALL SHORT.` }
    default:
      return me.todayToPace > 0
        ? { tone: 'pace', line: `${formatReps(me.todayToPace)} MORE TODAY TO HOLD THE LINE.` }
        : { tone: 'pace', line: 'AHEAD OF THE LINE. MAKE THEM CATCH YOU.' }
  }
}

function MyStandard({ me, target, paceRatio, counts }) {
  const total = me?.total ?? 0
  const status = me?.status ?? 'SILENT'
  const verdict = getVerdict(me)
  const isMet = status === 'MET'

  const stats = isMet
    ? [
        { value: `+${formatReps(me.surplus)}`, label: 'SURPLUS' },
        { value: `#${me.position}`, label: 'ON THE BOARD' },
        { value: formatReps(counts.MET), label: counts.MET === 1 ? 'HAS MET IT' : 'HAVE MET IT' },
      ]
    : [
        { value: formatReps(me?.remaining ?? target), label: 'TO GO' },
        { value: formatReps(me?.perDay ?? 0), label: 'A DAY' },
        {
          value: me && me.todayToPace === 0 ? '✓' : formatReps(me?.todayToPace ?? 0),
          label: me && me.todayToPace === 0 ? "TODAY'S LINE" : 'TODAY',
        },
      ]

  return (
    <div className={`standard-me standard-me--${STATUS_CLASS[status]}`}>
      <div className="standard-me__count">
        <strong>{formatReps(total)}</strong>
        <span>/ {formatReps(target)}</span>
        <em className={`standard-tag standard-tag--${STATUS_CLASS[status]}`}>{isMet ? 'MET ✓' : status}</em>
      </div>
      <StandardBar progress={me?.progress ?? 0} paceRatio={paceRatio} status={status} size="hero" />
      <p className={`standard-me__verdict standard-me__verdict--${verdict.tone}`}>{verdict.line}</p>
      <div className="standard-me__stats">
        {stats.map((stat) => (
          <div key={stat.label} className="standard-stat">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StandardCard({ standard }) {
  const [showAll, setShowAll] = useState(false)
  const [preview, setPreview] = useState(null)
  const { target, calendar, rollCall, counts, me, isLoading } = standard
  const paceRatio = Math.min(calendar.paceThroughToday / target, 1)
  const previewCount = STANDARD_CONFIG.rollCallPreview

  const visibleRows = useMemo(() => {
    if (showAll || rollCall.length <= previewCount + 1) {
      return rollCall
    }

    const top = rollCall.slice(0, previewCount)
    return me && !top.some((entry) => entry.isCurrentUser) ? [...top, me] : top
  }, [me, previewCount, rollCall, showAll])

  return (
    <section className="card standard" aria-labelledby="standard-title">
      <header className="standard__head">
        <div>
          <p className="standard__kicker">
            <EffortMark className="standard__mark" />
            THE STANDARD · {calendar.monthName}
          </p>
          <h2 id="standard-title" className="standard__title">
            {formatReps(target)} PRESS-UPS.
            <span className="standard__sub">EVERY MONTH. NO EXCEPTIONS.</span>
          </h2>
        </div>
        <div className="standard__clock">
          <strong>{calendar.daysLeft}</strong>
          <span>{calendar.daysLeft === 1 ? 'FINAL DAY' : 'DAYS LEFT'}</span>
        </div>
      </header>

      {isLoading ? (
        <p className="muted">Counting the month...</p>
      ) : (
        <>
          <MyStandard me={me} target={target} paceRatio={paceRatio} counts={counts} />

          <div className="standard-roll">
            <div className="standard-roll__head">
              <span className="standard-roll__title">THE ROLL CALL</span>
              <span className="standard-roll__counts">
                <b>{counts.MET}</b> MET · <b>{counts['ON PACE']}</b> ON PACE · <b>{counts.BEHIND}</b> BEHIND
                {counts.SILENT > 0 ? (
                  <>
                    {' '}· <b>{counts.SILENT}</b> SILENT
                  </>
                ) : null}
              </span>
            </div>

            <ol className="standard-roll__list">
              {visibleRows.map((entry) => (
                <li key={entry.userId}>
                  <button
                    type="button"
                    className={[
                      'standard-row',
                      `standard-row--${STATUS_CLASS[entry.status]}`,
                      entry.isCurrentUser ? 'standard-row--me' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setPreview(entry)}
                    aria-label={`${entry.actorName}: ${formatReps(entry.total)} of ${formatReps(target)}, ${entry.status}`}
                  >
                    <span className="standard-row__pos">{entry.position}</span>
                    <span className="standard-row__who">
                      <span className="standard-row__name">{entry.isCurrentUser ? 'YOU' : entry.actorName}</span>
                      <span className={`standard-row__status standard-row__status--${STATUS_CLASS[entry.status]}`}>
                        {entry.status === 'MET' ? 'MET ✓' : entry.status}
                      </span>
                    </span>
                    <StandardBar progress={entry.progress} paceRatio={paceRatio} status={entry.status} />
                    <span className="standard-row__total">{formatReps(entry.total)}</span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="standard-roll__foot">
              <span className="standard-roll__legend">
                <i aria-hidden="true" /> TODAY&apos;S PACE LINE · {formatReps(calendar.paceThroughToday)}
              </span>
              {rollCall.length > visibleRows.length || showAll ? (
                <button className="standard-roll__toggle" type="button" onClick={() => setShowAll((current) => !current)}>
                  {showAll ? 'SHOW LESS' : `SEE ALL ${rollCall.length}`}
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}

      {preview ? (
        <ProfilePreviewModal
          userId={preview.userId}
          initialName={preview.actorName}
          initialActivityType={STANDARD_CONFIG.activityType}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </section>
  )
}
