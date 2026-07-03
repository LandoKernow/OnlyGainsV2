// ============================================================================
// COLD-START / FIRST SESSION — single tuning surface.
// The first run must put a new warrior on a populated board, hand them a
// guaranteed FIRST BLOOD win on their first log, and a beatable rival to
// chase — comparison from minute one. Tune here; nowhere else.
// ============================================================================

import { GLOBAL_BOARD_ID } from '../utils/boards'

// The minimum value a log must hit to qualify as a FIRST BLOOD-worthy first
// mark, for the given discipline.
export function getFirstBloodFloor(activityType) {
  const floors = ONBOARDING_CONFIG.firstBlood.minValue
  return floors[activityType] ?? floors.default ?? 1
}

export const ONBOARDING_CONFIG = {
  enabled: true,

  // The board every new warrior is conscripted onto. Joined via the existing
  // 'GLOBAL' invite path, idempotently, once per user.
  dropBoardInviteCode: 'GLOBAL',
  dropBoardId: GLOBAL_BOARD_ID,

  // FIRST BLOOD: the one-time first-log coronation. Fires exactly once per
  // user ever (durable guard = the FIRST_BLOOD event in notification_events).
  firstBlood: {
    enabled: true,
    stat: 'FIRST BLOOD',
    tagline: 'THE BOARD KNOWS YOUR NAME NOW.',
    // A log only DRAWS first blood if it meets this floor for its discipline.
    // Blank / 0 / fat-finger entries below the floor never write the durable
    // event, so a junk first entry (even if deleted) can't burn the once-ever
    // coronation — it waits for the first real set. Defaults to "any positive
    // log"; raise per discipline to demand a meatier first mark.
    minValue: {
      pressups: 1,
      pullups: 1,
      km: 0.5,
      squats: 1,
      default: 1,
    },
  },

  // A rival is "beatable" as a first target if they're ahead but within this
  // gap (absolute, per discipline) — catchable inside one week. The first
  // target is chosen from REAL board data, never random.
  beatableGap: {
    pressups: 200,
    pullups: 50,
    km: 12,
  },

  // The discipline the first target is framed around (the app's primary lift).
  firstTargetActivity: 'pressups',

  // The 2-3 screen conscription intro. Skippable. War-voice, not a tutorial.
  intro: {
    enabled: true,
    screens: [
      {
        eyebrow: 'YOU HAVE BEEN CONSCRIPTED',
        title: 'THIS IS NOT A FITNESS APP. THIS IS A WAR.',
        body: 'Every rep is logged. Every rep is seen. The board never forgets who showed up and who hid.',
      },
      {
        eyebrow: 'THREE DISCIPLINES',
        title: 'PUSH. PULL. DISTANCE.',
        body: 'Press-ups. Pull-ups. Kilometres. Top a board and the crown is yours. Take all three and they will tell stories about you.',
      },
      {
        eyebrow: 'FIRST MISSION',
        title: 'LOG YOUR FIRST SET. DRAW FIRST BLOOD.',
        body: 'You are already on the Global Board with every other warrior. Make your first mark. The number does not matter yet — showing up does.',
        cta: 'ENTER THE WAR',
      },
    ],
  },
}
