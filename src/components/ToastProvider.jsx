import { createContext, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

function buildToast(toast) {
  return {
    id: crypto.randomUUID(),
    tone: toast.tone ?? 'success',
    message: toast.message,
  }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  function dismissToast(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  function showToast(toast) {
    const nextToast = buildToast(toast)
    setToasts((current) => [...current, nextToast])
    window.setTimeout(() => dismissToast(nextToast.id), 2400)
  }

  const value = useMemo(
    () => ({
      showToast,
      dismissToast,
    }),
    [],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
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
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)

  if (!value) {
    throw new Error('useToast must be used inside ToastProvider')
  }

  return value
}
