import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createClientId } from '../utils/uuid'
import { MachoToast } from './MachoToast'

// Two contexts on purpose: the actions never change identity, so the many
// screens that only FIRE toasts (the whole dashboard among them) don't
// re-render every time one appears or expires. Only the prompts that wait for
// a quiet screen subscribe to the live counts.
const ToastActionsContext = createContext(null)
const ToastCountsContext = createContext(null)

function buildToast(toast) {
  return {
    id: createClientId(),
    tone: toast.tone ?? 'success',
    message: toast.message ?? '',
    title: toast.title ?? '',
    eyebrow: toast.eyebrow ?? '',
    imagePath: toast.imagePath ?? '',
    variant: toast.variant ?? 'default',
    durationMs: toast.durationMs ?? (toast.variant === 'macho' ? 4200 : 2400),
    primaryActionLabel: toast.primaryActionLabel ?? '',
    secondaryActionLabel: toast.secondaryActionLabel ?? '',
    onPrimaryAction: toast.onPrimaryAction ?? null,
    onSecondaryAction: toast.onSecondaryAction ?? null,
  }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id)

    if (timer) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }

    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (toast) => {
      const nextToast = buildToast(toast)
      setToasts((current) => [...current, nextToast])
      timersRef.current.set(
        nextToast.id,
        window.setTimeout(() => dismissToast(nextToast.id), nextToast.durationMs),
      )
    },
    [dismissToast],
  )

  useEffect(() => {
    const timers = timersRef.current

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const actions = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast])

  const counts = useMemo(
    () => ({
      activeToastCount: toasts.length,
      activeMachoToastCount: toasts.filter((toast) => toast.variant === 'macho').length,
    }),
    [toasts],
  )

  return (
    <ToastActionsContext.Provider value={actions}>
      <ToastCountsContext.Provider value={counts}>
        {children}
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => (
            toast.variant === 'macho' ? (
              <MachoToast key={toast.id} toast={toast} onDismiss={dismissToast} />
            ) : (
              <div
                key={toast.id}
                className={toast.tone === 'error' ? 'toast toast--error' : 'toast toast--success'}
                role="status"
              >
                <span>{toast.message}</span>
                <button
                  className="toast__dismiss"
                  type="button"
                  aria-label="Dismiss toast"
                  onClick={() => dismissToast(toast.id)}
                >
                  x
                </button>
              </div>
            )
          ))}
        </div>
      </ToastCountsContext.Provider>
    </ToastActionsContext.Provider>
  )
}

// { showToast, dismissToast } — stable identities.
export function useToast() {
  const value = useContext(ToastActionsContext)

  if (!value) {
    throw new Error('useToast must be used inside ToastProvider')
  }

  return value
}

// { activeToastCount, activeMachoToastCount } — re-renders on every toast.
export function useToastCounts() {
  const value = useContext(ToastCountsContext)

  if (!value) {
    throw new Error('useToastCounts must be used inside ToastProvider')
  }

  return value
}
