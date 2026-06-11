// ============================================================================
// MACHO TAKEOVER — single tuning surface.
// Every threshold, cooldown, and behaviour rule for the milestone takeover
// lives here. Tune numbers; never hunt through components.
// ============================================================================

export const MACHO_TAKEOVER_CONFIG = {
  // Where the rotation deck loads its images from. Drop a new image into
  // public/images/macho/ and it auto-registers on next dev/build run.
  manifestUrl: '/images/macho/manifest.json',

  // --------------------------------------------------------------------------
  // TRIGGERS — earned moments only. Priority order: when one log satisfies
  // several, the highest-priority trigger claims the takeover.
  // --------------------------------------------------------------------------
  triggers: {
    // New app-tracked personal best (your best day-total for that activity).
    personalRecord: {
      enabled: true,
      priority: 1,
      tagline: 'NEW PERSONAL RECORD. HISTORY REWRITTEN.',
    },

    // Career level-up on the warrior XP ladder (see src/utils/xp.js).
    levelUp: {
      enabled: true,
      priority: 2,
      tagline: 'PROMOTED ON THE FIELD. CARRY THE RANK.',
    },

    // Streak milestone days — fires the day the streak HITS the number.
    streak: {
      enabled: true,
      priority: 3,
      days: [7, 30, 100],
      tagline: 'UNBROKEN. THE WEAK QUIT BY NOW.',
    },

    // Rank improvement on the weekly board (taking a spot, not just moving).
    rankUp: {
      enabled: true,
      priority: 4,
      // Only fire when the new rank is at or above this (top N feels earned).
      minRank: 5,
      tagline: 'SPOT TAKEN. NO REFUNDS.',
    },

    // One single log this big = a statement, not a session.
    bigSession: {
      enabled: true,
      priority: 5,
      thresholds: {
        pressups: 150,
        pullups: 40,
        km: 10,
      },
      tagline: 'THAT WAS A WARNING SHOT.',
    },
  },

  // --------------------------------------------------------------------------
  // COOLDOWNS — no spam. The takeover is an event, not wallpaper.
  // --------------------------------------------------------------------------
  cooldowns: {
    // Minimum gap between full-screen takeovers (minutes).
    takeoverMinutes: 120,
    // Minimum gap between the smaller repeat-toasts (minutes).
    toastMinutes: 20,
  },

  // --------------------------------------------------------------------------
  // FIRST-TIME vs REPEAT — first time a trigger type fires for a user:
  // full-screen takeover. Every later firing of the SAME trigger type:
  // compact macho toast (unless cooldown blocks it entirely).
  // --------------------------------------------------------------------------
  firstTimeFullScreen: true,

  // Haptics pattern for the slam (ms vibrate/pause/vibrate). Ignored where
  // navigator.vibrate is unsupported (iOS Safari).
  hapticsPattern: [40, 60, 90],

  // How long the takeover holds before the dismiss button fades in (ms).
  // Long enough to land, short enough to never feel like a trap.
  dismissDelayMs: 900,
}
