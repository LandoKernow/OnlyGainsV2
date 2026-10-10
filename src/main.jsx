import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App'
import { ToastProvider } from './components/ToastProvider'
import { AuthProvider } from './features/auth/AuthProvider'
import { BoardProvider } from './features/boards/BoardProvider'
import { OverlayProvider } from './components/OverlayController'
import { queryClient } from './lib/queryClient'
import './styles/globals.css'

// After a deploy, a tab that stayed open still points at the previous build's
// chunk names, which no longer exist — the next lazy screen would fail to
// load. Reload once onto the new build instead (guarded against loops).
const CHUNK_RELOAD_KEY = 'only_gains_chunk_reload_at'

window.addEventListener('vite:preloadError', (event) => {
  try {
    const lastReloadAt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0

    if (Date.now() - lastReloadAt < 10_000) {
      return
    }

    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  } catch {
    return
  }

  event.preventDefault()
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <BoardProvider>
              <OverlayProvider>
                <App />
              </OverlayProvider>
            </BoardProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
