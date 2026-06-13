// ============================================================================
// CROWN SYSTEM — single tuning surface.
// Single / Double / Treble crowns across the three disciplines, per board,
// per period. Detection runs in the Cloudflare Worker on period close and
// powers the live standings view client-side. Tune here; nowhere else.
// ============================================================================

export const CROWNS_CONFIG = {
  // Which periods mint crowns. Crons in wrangler.jsonc must match.
  periods: ['weekly', 'monthly'],

  // The three thrones. Order is the display order on the standings card.
  // Ranking direction + tiebreak are NOT configurable — they are inherited
  // verbatim from the canonical leaderboard (src/logic/leaderboard/
  // calculateLeaderboard.js): highest summed total wins, ties broken by
  // todayTotal desc then most-recent-log desc. Distance ranks by total KM,
  // same as reps (pace/time live only in claimed Vault records, never here).
  disciplines: [
    { key: 'pressups', label: 'Press-ups', short: 'PUSH' },
    { key: 'pullups', label: 'Pull-ups', short: 'PULL' },
    { key: 'km', label: 'KM', short: 'DIST' },
  ],

  // A crown is only "real" if the discipline had at least this many warriors
  // with a positive total that period. Stops a 1-person board minting hollow
  // trebles. Set to 1 to crown even uncontested boards.
  minWarriorsPerDiscipline: 2,

  // TREBLE badge decay. The title persists into the next period (you wear it
  // while defending), then re-evaluates at each period close:
  //   enabled:false      -> lifetime: once a treble, always shown as treble
  //   enabled:true        -> active title = your tier in the most recent
  //                          period you held any crown, allowing `gracePeriods`
  //                          undefended periods before it drops to what you
  //                          still hold (or nothing).
  decay: {
    enabled: true,
    gracePeriods: 0,
  },

  // Macho image intensity per tier. Trebles reserve the most epic stock —
  // pulled from the rotation deck but biased to this curated max-intensity set
  // (filenames from public/images/macho/manifest.json). Falls back to the
  // normal shuffle-bag if none are available.
  imageIntensity: {
    CROWN: 'standard',
    DOUBLE_CROWN: 'high',
    TREBLE: 'max',
  },
  trebleImages: [
    '/images/macho/goggins-stare.webp',
    '/images/macho/the-rock.webp',
    '/images/macho/arnold-heavy-muscle.webp',
    '/images/macho/haka-chicago.webp',
  ],

  // Which tiers fire the full-screen takeover on next open (vs in-app only).
  takeoverTiers: ['DOUBLE_CROWN', 'TREBLE'],
}

export const CROWN_DISCIPLINE_KEYS = CROWNS_CONFIG.disciplines.map((d) => d.key)

export function getDisciplineLabel(key) {
  return CROWNS_CONFIG.disciplines.find((d) => d.key === key)?.label ?? key
}

// Tier name from a count of thrones held this period.
export function crownTierFromCount(count) {
  if (count >= 3) return 'TREBLE'
  if (count === 2) return 'DOUBLE_CROWN'
  if (count === 1) return 'CROWN'
  return null
}
