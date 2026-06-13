// ============================================================================
// REFERRAL / RECRUITER LOOP — single tuning surface.
// Recruit warriors, earn escalating RECRUITER honors, and a recruit's first
// rival is the recruiter who dragged them in. Tune here; nowhere else.
// ============================================================================

export const REFERRALS_CONFIG = {
  enabled: true,

  // A recruited warrior's first chase target is their recruiter (overrides the
  // generic cold-start pick). Off -> recruits get the normal beatable rival.
  autoRivalry: true,

  // RECRUITER honor tiers by live recruit count. Titles are war-voice and
  // distinct from the XP ladder level names. Highest reached tier wins.
  tiers: [
    { min: 1, title: 'RECRUITER' },
    { min: 5, title: 'KINGMAKER' },
    { min: 10, title: 'WARMONGER' },
  ],
}

// Highest tier whose threshold the recruit count has reached, or null.
export function getRecruiterTier(recruitCount) {
  const count = Number(recruitCount) || 0
  let tier = null

  for (const entry of REFERRALS_CONFIG.tiers) {
    if (count >= entry.min) {
      tier = entry
    }
  }

  return tier
}
