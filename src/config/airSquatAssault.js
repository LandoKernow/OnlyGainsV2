// ============================================================================
// AIR SQUAT ASSAULT — timed event, single tuning surface.
// A 7-day cumulative air-squat arena battle. This week is the TEASE phase:
// countdown + hype only, squats NOT loggable. Flip `phase` to 'LIVE' next week
// to open the arena — a CONFIG change only, no code deploy. 'ENDED' closes it.
//
// PHASE FLAG:
//   'TEASE' -> countdown takeover + banner + reveal + opt-in. No logging, no arena.
//   'LIVE'  -> arena card (leaderboard + collective counter), countdown to END.
//   'ENDED' -> results/afterglow banner, arena frozen.
//
// NOTE for the TEASE->LIVE flip: this flag switches the UI. Actual squat
// LOGGING additionally needs 'squats' enabled as an activity type (the one-time
// DB whitelist migration, same as pull-ups had) — that is a DB step, still not
// a code deploy. The event UI/logic all ships now behind this flag.
// ============================================================================

export const AIR_SQUAT_ASSAULT_CONFIG = {
  // TEASE | LIVE | ENDED
  phase: 'LIVE',

  name: 'AIR SQUAT ASSAULT',
  activityType: 'squats',

  // Stable key for this event's opt-in list + launch-broadcast dedupe.
  eventKey: 'air_squat_assault',

  // The moment the arena opens: Monday 6 July 2026, 00:00 London (BST = UTC+1),
  // so 23:00Z the night before. The countdown is computed from this vs now.
  launchAt: '2026-07-05T23:00:00Z',

  // Event runs for this many days once LIVE (arena closes launchAt + duration).
  durationDays: 7,

  // Collective arena goal — the whole board vs this number of cumulative
  // squats. Trivially adjustable MID-EVENT: change this number, redeploy the
  // one-line config, and every counter/threshold recomputes live.
  collectiveTarget: 10_000,

  // Min squats a warrior must log to earn the participation badge if the
  // collective target falls (drives the strong to recruit the weak).
  participationThreshold: 1,

  // Personal CUMULATIVE squat milestones — each fires an escalating macho
  // takeover (reuses the milestone-image rotation). Squats accrue fast, so the
  // ladder climbs quick; the top tier is legendary.
  personalMilestones: [
    { at: 100, line: 'FIRST HUNDRED. THE LEGS WAKE UP.' },
    { at: 500, line: '500 SQUATS. THE BURN IS THE POINT.' },
    { at: 1000, line: '1,000 DEEP. THEY CAN SEE IT IN YOUR WALK.' },
    { at: 2500, line: '2,500. LEGS OF WAR.' },
    { at: 5000, line: '5,000 SQUATS. LEGENDARY. THE ARENA BOWS.' },
  ],

  // TAKEOVER behaviour (tease). Shown once per user on app open, then demoted
  // to the persistent dashboard banner. Routed through the overlay controller.
  takeover: {
    enabled: true,
    // Reserved max-intensity image for the reveal (from the macho manifest).
    imageSrc: '/images/macho/goggins-stare.webp',
  },

  // Early opt-in ("ANSWER THE CALL") — arms push so the warrior is on the
  // launch-day push list, and captures intent. Rides the existing push system.
  optIn: {
    enabled: true,
  },
}

// --- Derived helpers ---------------------------------------------------------

export function isTease() {
  return AIR_SQUAT_ASSAULT_CONFIG.phase === 'TEASE'
}

export function isLive() {
  return AIR_SQUAT_ASSAULT_CONFIG.phase === 'LIVE'
}

export function isEnded() {
  return AIR_SQUAT_ASSAULT_CONFIG.phase === 'ENDED'
}

export function getLaunchTime() {
  return new Date(AIR_SQUAT_ASSAULT_CONFIG.launchAt).getTime()
}

export function getEndTime() {
  return getLaunchTime() + AIR_SQUAT_ASSAULT_CONFIG.durationDays * 86_400_000
}

// The personal squat milestone THIS log just crossed (cumulative), or null.
export function getSquatMilestone(previousTotal, newTotal) {
  const prev = Number(previousTotal) || 0
  const next = Number(newTotal) || 0
  for (const milestone of AIR_SQUAT_ASSAULT_CONFIG.personalMilestones) {
    if (next >= milestone.at && prev < milestone.at) {
      return milestone
    }
  }
  return null
}

// Days / hours / minutes remaining until a target time (never negative).
export function getCountdown(targetMs, now = Date.now()) {
  const remaining = Math.max(targetMs - now, 0)
  const days = Math.floor(remaining / 86_400_000)
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000)
  const minutes = Math.floor((remaining % 3_600_000) / 60_000)
  return { remaining, days, hours, minutes, isZero: remaining === 0 }
}
