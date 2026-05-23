import { Link, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { useToast } from '../../components/ToastProvider'
import { AuthGate } from '../../features/auth/AuthGate'
import { useVaultAward } from '../../hooks/useVaultAwards'
import {
  formatAwardPeriodRange,
  formatAwardSourceLabel,
  formatAwardSummaryLine,
  getAwardImagePath,
  shareAward,
} from '../../utils/awardShare'

function AwardShareContent() {
  const { awardId = '' } = useParams()
  const { showToast } = useToast()
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
      <AuthGate>
        {awardQuery.isLoading ? (
          <Card title="AWARD" body="Loading proof.">
            <p className="muted">The Vault is pulling your name forward.</p>
          </Card>
        ) : awardQuery.error ? (
          <Card title="AWARD OFFLINE" body="Could not load this award.">
            <p className="muted">Try the Vault again in a moment.</p>
          </Card>
        ) : !award ? (
          <Card title="AWARD MISSING" body="Nothing written here yet.">
            <p className="muted">The Vault could not find that mark.</p>
            <Link className="button button--ghost" to="/vault">
              Back to Vault
            </Link>
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
                <p className="award-share-card__summary">{formatAwardSummaryLine(award)}</p>
                {award.quote ? <p className="award-share-card__quote">{award.quote}</p> : null}
                {formatAwardPeriodRange(award) ? <p className="award-share-card__period">{formatAwardPeriodRange(award)}</p> : null}
                <p className="award-share-card__source">{formatAwardSourceLabel(award)}</p>
                <div className="award-share-card__footer">
                  <strong>JOIN THE BOARD</strong>
                  <span>onlygains.club</span>
                </div>
              </div>
            </article>

            <div className="award-stage__actions">
              <button className="button" type="button" onClick={handleShare}>
                Share
              </button>
              <Link className="button button--ghost" to="/vault">
                Back to Vault
              </Link>
            </div>
          </div>
        )}
      </AuthGate>
    </div>
  )
}

export default function AwardShareScreen() {
  return <AwardShareContent />
}
