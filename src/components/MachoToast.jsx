export function MachoToast({ toast, onDismiss }) {
  async function handleAction(action) {
    if (typeof action !== 'function') {
      return
    }

    try {
      await action()
    } finally {
      onDismiss(toast.id)
    }
  }

  return (
    <div className="macho-toast" role="status">
      {toast.imagePath ? (
        <div className="macho-toast__image-shell">
          <img className="macho-toast__image" src={toast.imagePath} alt="" aria-hidden="true" />
        </div>
      ) : null}
      <div className="macho-toast__content">
        {toast.eyebrow ? <p className="macho-toast__eyebrow">{toast.eyebrow}</p> : null}
        {toast.title ? <strong className="macho-toast__title">{toast.title}</strong> : null}
        {toast.message ? <p className="macho-toast__message">{toast.message}</p> : null}
        {toast.primaryActionLabel || toast.secondaryActionLabel ? (
          <div className="macho-toast__actions">
            {toast.primaryActionLabel ? (
              <button className="button macho-toast__action" type="button" onClick={() => handleAction(toast.onPrimaryAction)}>
                {toast.primaryActionLabel}
              </button>
            ) : null}
            {toast.secondaryActionLabel ? (
              <button
                className="button button--ghost macho-toast__action macho-toast__action--ghost"
                type="button"
                onClick={() => handleAction(toast.onSecondaryAction)}
              >
                {toast.secondaryActionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <button
        className="macho-toast__dismiss"
        type="button"
        aria-label="Dismiss achievement toast"
        onClick={() => onDismiss(toast.id)}
      >
        x
      </button>
    </div>
  )
}
