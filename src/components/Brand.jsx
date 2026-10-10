// ONLYGAINS brand primitives. The wordmark is a custom typeface — only ever
// rendered from the official artwork, never re-typeset in a web font.

export function EffortMark({ className = '', title = '' }) {
  return (
    <svg
      className={`effort-mark ${className}`.trim()}
      viewBox="0 0 120 64"
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d="M44 0h18L18 64H0zM73 0h18L47 64H29zM102 0h18L76 64H58z" />
    </svg>
  )
}

export function Wordmark({ className = '' }) {
  return (
    <img
      className={`brand-wordmark ${className}`.trim()}
      src="/brand/wordmark.png"
      alt="ONLYGAINS"
      width="998"
      height="110"
      decoding="async"
    />
  )
}

export function BrandLockup({ className = '' }) {
  return (
    <img
      className={`brand-lockup ${className}`.trim()}
      src="/brand/lockup.png"
      alt="ONLYGAINS — Hybrid Training Club"
      width="998"
      height="302"
      decoding="async"
    />
  )
}
