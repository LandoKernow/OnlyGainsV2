// ============================================================================
// NOTIFICATION ENGINE — single tuning surface.
// Shared by the Cloudflare Worker (event detection, anti-spam, push gating)
// and the client (categories, badge behaviour). Tune here, nowhere else.
// ============================================================================

export const NOTIFICATIONS_CONFIG = {
  // --------------------------------------------------------------------------
  // EVENT TYPES — priority decides push behaviour; category maps to the
  // user-facing toggles in settings.
  //   high   -> in-app + push, always (unless muted/toggled off)
  //   medium -> in-app + push
  //   low    -> in-app only by default (pushLowPriority flips this)
  // --------------------------------------------------------------------------
  events: {
    OVERTAKEN: { priority: 'high', category: 'board', cooldownMinutes: 30 },
    OVERTOOK: { priority: 'medium', category: 'board', cooldownMinutes: 30 },
    CHASE_CLOSING: { priority: 'high', category: 'chase', cooldownMinutes: 120 },
    CHASE_WON: { priority: 'medium', category: 'chase', cooldownMinutes: 60 },
    CHASE_LOST: { priority: 'high', category: 'chase', cooldownMinutes: 60 },
    STREAK_AT_RISK: { priority: 'high', category: 'streak', cooldownMinutes: 720 },
    MILESTONE: { priority: 'medium', category: 'milestone', cooldownMinutes: 60 },
    BOARD_ACTIVITY: { priority: 'low', category: 'board', cooldownMinutes: 0 },
    // Crowns: period-rollover honors. Cooldown 0 — deduped per period instead.
    CROWN: { priority: 'medium', category: 'milestone', cooldownMinutes: 0 },
    DOUBLE_CROWN: { priority: 'high', category: 'milestone', cooldownMinutes: 0 },
    TREBLE: { priority: 'high', category: 'milestone', cooldownMinutes: 0 },
    // Board-wide announcement when someone lands a double or treble.
    CROWN_REPORT: { priority: 'medium', category: 'board', cooldownMinutes: 0 },
  },

  // CHASE_CLOSING fires when the rival behind you closes within EITHER bound.
  chaseClosing: {
    withinPercent: 10, // gap shrank to <= 10% of your weekly total
    withinAbsolute: {
      pressups: 25,
      pullups: 8,
      km: 2,
    },
  },

  // A boardmate's single log must be at least this big to rate BOARD_ACTIVITY.
  boardActivityThresholds: {
    pressups: 100,
    pullups: 25,
    km: 8,
  },

  // MILESTONE: round-number lifetime (year) totals worth shouting about.
  lifetimeMilestones: {
    pressups: [1000, 5000, 10000, 25000, 50000, 100000],
    pullups: [250, 1000, 2500, 5000, 10000],
    km: [50, 100, 250, 500, 1000],
  },

  // --------------------------------------------------------------------------
  // ANTI-SPAM
  // --------------------------------------------------------------------------
  // BOARD_ACTIVITY collapses: logs within this window merge into ONE digest.
  collapseWindowMinutes: 60,

  // Push only fires for these priorities (low stays in-app unless enabled).
  pushPriorities: ['high', 'medium'],
  pushLowPriority: false,

  // STREAK_AT_RISK evening sweep hours (UTC) — cron in wrangler.jsonc must
  // match. 17:00 & 20:00 UTC = 18:00 & 21:00 London in summer.
  streakSweepHoursUtc: [17, 20],

  // --------------------------------------------------------------------------
  // CLIENT
  // --------------------------------------------------------------------------
  // Unread badge poll interval (ms).
  unreadPollMs: 60_000,

  // Default user prefs (notification_prefs.categories keys).
  defaultCategories: {
    chase: true,
    board: true,
    streak: true,
    milestone: true,
  },

  // Permission funnel backoff: after declining our pre-prompt, stay quiet for
  // this many days before offering again.
  prePromptBackoffDays: 7,

  // VAPID public key (safe to ship; the private key lives ONLY in the
  // Cloudflare dashboard as a secret — see .vapid-keys.env locally).
  vapidPublicKey: 'BO0pvjtgZsXzlG9C3u8YvVSdtT1wnxiUftXV5CIciEPUXHi_xaYA5tKDNd6hhCPDD2p6nxJwr98NtbIDngz6UT0',
}

export function getEventConfig(type) {
  return NOTIFICATIONS_CONFIG.events[type] ?? { priority: 'low', category: 'board', cooldownMinutes: 60 }
}
