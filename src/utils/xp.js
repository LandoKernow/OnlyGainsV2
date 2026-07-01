// Warrior XP and prestige levels — the career ladder. Weekly tiers reset and
// show current form; LEVELS never reset inside a season. Pure derivation from
// the current-year submission rows the app already loads: no schema, no
// storage, recomputable from scratch every render.

// XP per unit, weighted so an hour of honest work lands roughly equal:
// 1 press-up = 1 XP, 1 pull-up = 4 XP, 1 km = 20 XP.
export const XP_WEIGHTS = {
  pressups: 1,
  pullups: 4,
  km: 20,
  // Air squats accumulate fast — low XP each so a squat sprint doesn't outrank
  // a season of the harder lifts.
  squats: 0.5,
}

// The season ladder. Climb is brutal by design — GOD OF WAR is a year of
// relentless volume, not a fortnight of enthusiasm.
export const WARRIOR_LEVELS = [
  { level: 1, name: 'RECRUIT', xp: 0 },
  { level: 2, name: 'FOOTSOLDIER', xp: 500 },
  { level: 3, name: 'SKIRMISHER', xp: 1500 },
  { level: 4, name: 'SOLDIER', xp: 3000 },
  { level: 5, name: 'VANGUARD', xp: 5000 },
  { level: 6, name: 'ENFORCER', xp: 8000 },
  { level: 7, name: 'BERSERKER', xp: 12000 },
  { level: 8, name: 'CENTURION', xp: 17000 },
  { level: 9, name: 'GLADIATOR', xp: 23000 },
  { level: 10, name: 'WARBRINGER', xp: 30000 },
  { level: 11, name: 'WARLORD', xp: 40000 },
  { level: 12, name: 'TITANSLAYER', xp: 55000 },
  { level: 13, name: 'IMMORTAL', xp: 75000 },
  { level: 14, name: 'DEMIGOD', xp: 100000 },
  { level: 15, name: 'GOD OF WAR', xp: 150000 },
]

export function getXpForLog(activityType, value) {
  const weight = XP_WEIGHTS[activityType] ?? XP_WEIGHTS.pressups
  return Math.round((Number(value) || 0) * weight)
}

// rowsByActivity: { pressups: rows[], pullups: rows[], km: rows[] } — raw
// submission rows; only the given user's rows are counted.
export function calculateWarriorXp(rowsByActivity, userId) {
  let xp = 0

  for (const [activityType, rows] of Object.entries(rowsByActivity ?? {})) {
    const weight = XP_WEIGHTS[activityType] ?? 0

    for (const row of rows ?? []) {
      if (row.userId === userId && !row.pending) {
        xp += (Number(row.value) || 0) * weight
      }
    }
  }

  return Math.round(xp)
}

export function getWarriorLevel(xp) {
  const total = Math.max(0, Number(xp) || 0)
  let current = WARRIOR_LEVELS[0]

  for (const entry of WARRIOR_LEVELS) {
    if (total >= entry.xp) {
      current = entry
    }
  }

  const next = WARRIOR_LEVELS.find((entry) => entry.xp > current.xp) ?? null
  const span = next ? next.xp - current.xp : 1
  const into = next ? total - current.xp : 1

  return {
    level: current.level,
    name: current.name,
    xp: total,
    nextLevelName: next?.name ?? null,
    nextLevelXp: next?.xp ?? null,
    xpToNextLevel: next ? next.xp - total : 0,
    // 0..1 progress through the current level band (1 at max level).
    progress: next ? Math.min(Math.max(into / span, 0), 1) : 1,
  }
}
