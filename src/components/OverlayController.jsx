import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'

// ONE controller for every full-screen overlay (conscription intro, PWA
// install, FIRST BLOOD / crown takeovers, milestone images, share prompts).
// Each overlay requests a slot with a priority; the controller renders exactly
// ONE at a time — the highest priority currently requested. This kills the
// whole class of stacking / transparency / trap bugs: no two overlays ever
// share the screen, and every overlay uses the solid OverlayShell backdrop.

const OverlayContext = createContext(null)

// Pure resolver (exported for tests): highest priority wins; ties break by id
// for determinism.
export function resolveActiveOverlay(requests) {
  let activeId = null
  let best = -Infinity

  for (const [id, priority] of Object.entries(requests)) {
    if (priority > best || (priority === best && (activeId === null || id < activeId))) {
      best = priority
      activeId = id
    }
  }

  return activeId
}

export function OverlayProvider({ children }) {
  const [requests, setRequests] = useState({})

  const request = useCallback((id, priority) => {
    setRequests((current) => (current[id] === priority ? current : { ...current, [id]: priority }))
  }, [])

  const release = useCallback((id) => {
    setRequests((current) => {
      if (!(id in current)) {
        return current
      }
      const next = { ...current }
      delete next[id]
      return next
    })
  }, [])

  const activeId = useMemo(() => resolveActiveOverlay(requests), [requests])

  const value = useMemo(() => ({ request, release, activeId }), [request, release, activeId])

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
}

// Returns true only when this overlay both wants to show AND is the current
// top of the stack. Registers/clears its request as `wants` changes.
export function useOverlaySlot(id, priority, wants) {
  const ctx = useContext(OverlayContext)

  useEffect(() => {
    if (!ctx) {
      return undefined
    }

    if (wants) {
      ctx.request(id, priority)
    } else {
      ctx.release(id)
    }

    return () => ctx.release(id)
  }, [ctx, id, priority, wants])

  if (!ctx) {
    // No provider (e.g. isolated render): fail open so an overlay still shows.
    return Boolean(wants)
  }

  return Boolean(wants) && ctx.activeId === id
}

// Standard priorities — higher wins. Centralised so collisions are obvious.
export const OVERLAY_PRIORITY = {
  takeover: 100, // FIRST BLOOD / crown / milestone coronations
  intro: 90, // conscription first-run sequence
  eventTakeover: 80, // timed-event announcement (Air Squat Assault, etc.)
  profileBuild: 40,
  weeklyShare: 30,
  addToHomeScreen: 20,
}

// Solid, opaque, full-screen backdrop with a guaranteed Escape exit. Every
// full-screen overlay renders its content inside this so nothing underneath
// can ever bleed through.
export function OverlayShell({ children, onDismiss, label, className = '', solid = true }) {
  useEscapeKey(onDismiss, typeof onDismiss === 'function')

  return (
    <div
      className={`overlay-shell ${solid ? 'overlay-shell--solid' : ''} ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {children}
    </div>
  )
}
