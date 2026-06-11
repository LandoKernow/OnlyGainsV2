import { useEffect } from 'react'

// Closes modals on Escape. Pass enabled=false while an action is in flight
// (e.g. a delete) to stop the user dismissing mid-operation.
export function useEscapeKey(onEscape, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof onEscape !== 'function') {
      return
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onEscape()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, onEscape])
}
