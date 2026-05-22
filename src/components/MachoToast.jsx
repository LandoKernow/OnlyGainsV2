export function MachoToast({ toast, onDismiss }) {
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
