// Central activity-type registry. Every screen, hook, and copy branch keys off
// this instead of ad-hoc `=== 'km'` binaries, so adding an activity means
// adding an entry here and per-type copy where it matters — not hunting
// ternaries across the app.
//
// DB contract: `submissions.activity_type` stores these exact ids as text.
// Rep-based activities share unit 'reps'; km stores 'km'.

export const ACTIVITY_TYPES = ['pressups', 'pullups', 'km']

export const ACTIVITY_META = {
  pressups: {
    id: 'pressups',
    label: 'Press Ups',
    unit: 'reps',
    quickValues: [10, 20, 50],
    inputLabel: 'Reps',
    inputPlaceholder: 'e.g. 25',
    emptyError: 'Enter a press-up count.',
    wholeNumberError: 'Press-ups must be a whole number.',
    positiveError: 'Press-ups must be greater than 0.',
  },
  pullups: {
    id: 'pullups',
    label: 'Pull Ups',
    unit: 'reps',
    // Pull-ups run at roughly a quarter of press-up volume — quick chips sized to match.
    quickValues: [5, 10, 15],
    inputLabel: 'Reps',
    inputPlaceholder: 'e.g. 12',
    emptyError: 'Enter a pull-up count.',
    wholeNumberError: 'Pull-ups must be a whole number.',
    positiveError: 'Pull-ups must be greater than 0.',
  },
  km: {
    id: 'km',
    label: 'KM Ran',
    unit: 'km',
    quickValues: [],
    inputLabel: 'KM',
    inputPlaceholder: 'e.g. 5.2',
  },
}

// Unknown or legacy values collapse to press-ups — same behaviour the old
// binary ternaries had, so nothing that exists today changes shape.
export function normalizeActivityType(activityType) {
  return ACTIVITY_TYPES.includes(activityType) ? activityType : 'pressups'
}

export function isRepActivity(activityType) {
  return normalizeActivityType(activityType) !== 'km'
}

export function getActivityUnit(activityType) {
  return ACTIVITY_META[normalizeActivityType(activityType)].unit
}

export function getActivityLabel(activityType) {
  return ACTIVITY_META[normalizeActivityType(activityType)].label
}

export function getActivityQuickValues(activityType) {
  return ACTIVITY_META[normalizeActivityType(activityType)].quickValues
}
