import { Link, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { useToast } from '../../components/ToastProvider'
import { useAuth } from '../../features/auth/AuthProvider'
import { useVaultAward } from '../../hooks/useVaultAwards'
import {
  formatAwardLandingCopy,
  formatAwardMetricLine,
  formatAwardPeriodRange,
  formatAwardSourceLabel,
  getAwardImagePath,
  shareAward,
} from '../../utils/awardShare'
import { IS_TELEGRAM_CONFIGURED, TELEGRAM_URL } from '../../utils/community'

function AwardShareContent() {
  const { awardId = '' } = useParams()
  const { showToast } = useToast()
  const { status } = useAuth()
  const awardQuery = useVaultAward(awardId)
  const award = awardQuery.award

  async function handleShare() {
    if (!award) {
      return
    }

    try {
      const result = await shareAward(award)
      if (result === 'cancelled') {
        return
      }

      showToast({
        tone: 'success',
        message: result === 'shared' ? 'Award shared.' : 'Share link copied.',
      })
    } catch {
      showToast({ tone: 'error', message: 'Could not share award.' })
    }
  }

  return (
    <div className="screen screen--award">
      {awardQuery.isLoading ? (
        <Card title="AWARD" body="Loading proof.">
          <p className="muted">The Vault is pulling your name forward.</p>
        </Card>
      ) : awardQuery.error ? (
        <Card title="AWARD OFFLINE" body="Could not load this award right now.">
          <p className="muted">This looks like a read or network problem, not a missing award.</p>
          <Link className="button button--ghost" to="/vault">
            View Vault
          </Link>
        </Card>
      ) : !award ? (
        <Card title="AWARD UNAVAILABLE" body="This mark could not be shown right now.">
          <p className="muted">
            {status === 'unauthenticated'
              ? 'The award may not be public yet, or the public read policy is blocking it.'
              : 'The Vault could not find that mark.'}
          </p>
          <div className="award-stage__actions award-stage__actions--stacked">
            <Link className="button award-stage__primary" to="/dashboard">
              Join the board
            </Link>
            <div className="award-stage__secondary">
              <Link className="button button--ghost award-stage__share" to="/vault">
                View Vault
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <div className="award-stage">
          <article className="award-share-card">
            <div className="award-share-card__image-shell">
              <img className="award-share-card__image" src={getAwardImagePath(award)} alt="" />
            </div>
            <div className="award-share-card__content">
              <p className="award-share-card__brand eyebrow">ONLY GAINS</p>
              <h2 className="award-share-card__title">{award.title}</h2>
              <p className="award-share-card__winner">{award.actorName || 'Unknown'}</p>
              <p className="award-share-card__summary">{formatAwardMetricLine(award)}</p>
              {formatAwardPeriodRange(award) ? <p className="award-share-card__period">{formatAwardPeriodRange(award)}</p> : null}
              <p className="award-share-card__quote">{formatAwardLandingCopy(award)}</p>
              <p className="award-share-card__source">{formatAwardSourceLabel(award)}</p>
              <div className="award-share-card__footer">
                <strong>JOIN THE BOARD</strong>
                <span>onlygains.club</span>
              </div>
            </div>
          </article>

          <div className="award-stage__actions award-stage__actions--stacked">
            <Link className="button award-stage__primary" to="/dashboard">
              Join the board
            </Link>
            <div className="award-stage__secondary">
              <button className="button button--ghost award-stage__share" type="button" onClick={handleShare}>
                Share
              </button>
              <Link className="button button--ghost award-stage__share" to="/vault">
                View Vault
              </Link>
            </div>
            {IS_TELEGRAM_CONFIGURED ? (
              <p className="muted award-stage__tertiary">
                <a className="subtle-link" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
                  Enter the Telegram.
                </a>{' '}
                The board talks there.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AwardShareScreen() {
  return <AwardShareContent />
}
