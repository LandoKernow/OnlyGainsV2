import { describe, expect, it } from 'vitest'
import { OVERLAY_PRIORITY, resolveActiveOverlay } from './OverlayController'

describe('resolveActiveOverlay', () => {
  it('shows exactly one overlay: the highest priority', () => {
    expect(
      resolveActiveOverlay({
        addToHomeScreen: OVERLAY_PRIORITY.addToHomeScreen,
        takeover: OVERLAY_PRIORITY.takeover,
        intro: OVERLAY_PRIORITY.intro,
      }),
    ).toBe('takeover')
  })

  it('is deterministic on ties and empty when nothing is requested', () => {
    expect(resolveActiveOverlay({ b: 5, a: 5 })).toBe('a')
    expect(resolveActiveOverlay({})).toBeNull()
  })
})
