export function Card({ title, body, aside, children }) {
  return (
    <section className="card">
      {(title || aside) && (
        <header className="card__header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {body ? <p>{body}</p> : null}
          </div>
          {aside ? <div>{aside}</div> : null}
        </header>
      )}
      {children}
    </section>
  )
}
