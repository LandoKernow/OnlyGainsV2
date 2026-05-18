import { Card } from './Card'

export function ScreenFallback({ title, body }) {
  return (
    <div className="screen">
      <Card title={title} body={body}>
        <p className="muted">Navigation stays live even if a screen hits trouble.</p>
      </Card>
    </div>
  )
}
