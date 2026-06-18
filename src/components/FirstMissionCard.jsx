import { Card } from './Card'
import { formatActivityValue } from '../utils/activity'
import { pickFirstTarget } from '../utils/onboarding'
import { ONBOARDING_CONFIG } from '../config/onboarding'

// First-session card: hands a brand-new warrior one named, beatable rival to
// chase from minute one — computed from real Global board data. Shown only
// until they draw FIRST BLOOD, then the standard chase/pressure cards take
// over. Never a dead end: an empty board flips to "be the one they chase."
export function FirstMissionCard({ rows, currentUserRow, recruiter = null }) {
  const activityType = ONBOARDING_CONFIG.firstTargetActivity
  const target = pickFirstTarget(rows, currentUserRow, activityType, recruiter)

  if (target.framing === 'recruiter') {
    return (
      <Card title="🩸 FIRST MISSION" body="Log your first set. Draw FIRST BLOOD.">
        <div className="first-mission">
          <span className="first-mission__eyebrow">YOUR FIRST TARGET</span>
          <strong className="first-mission__target">{target.rival.actorName}</strong>
          <span className="first-mission__gap">THE ONE WHO DRAGGED YOU IN</span>
          <p className="first-mission__copy">
            They recruited you. Now make them regret it — take their spot.
          </p>
        </div>
      </Card>
    )
  }

  if (target.framing === 'be-hunted' || !target.rival) {
    return (
      <Card title="🩸 FIRST MISSION" body="The board is yours to mark.">
        <div className="first-mission">
          <strong className="first-mission__headline">NO ONE ABOVE YOU YET.</strong>
          <p className="first-mission__copy">
            Log your first set and set the mark. Make them chase <em>you</em>.
          </p>
        </div>
      </Card>
    )
  }

  const gapLabel = formatActivityValue(target.gap ?? target.rival.total, activityType)

  return (
    <Card title="🩸 FIRST MISSION" body="Log your first set. Draw FIRST BLOOD.">
      <div className="first-mission">
        <span className="first-mission__eyebrow">YOUR FIRST TARGET</span>
        <strong className="first-mission__target">{target.rival.actorName || 'A WARRIOR'}</strong>
        <span className="first-mission__gap">{gapLabel} to overtake · HUNT THEM DOWN</span>
        <p className="first-mission__copy">
          {target.beatable
            ? 'Catchable this week. Close the gap and take the spot.'
            : 'The board is stacked. Start the climb — every rep counts.'}
        </p>
      </div>
    </Card>
  )
}
