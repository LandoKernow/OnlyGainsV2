import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseSetupError } from '../../lib/supabase'

const AuthContext = createContext(null)

function authLog(step, details) {
  if (!import.meta.env.DEV) {
    return
  }

  if (details === undefined || details === null || details === '') {
    console.log(`[Only Gains Auth] ${step}`)
    return
  }

  console.log(`[Only Gains Auth] ${step} ${JSON.stringify(details)}`)
}

function clearAuthUrlArtifacts() {
  const url = new URL(window.location.href)
  const hadSearch = ['code', 'token_hash', 'type', 'error', 'error_code', 'error_description'].some(
    (key) => url.searchParams.has(key),
  )
  const hadHash = url.hash.length > 0

  if (!hadSearch && !hadHash) {
    return
  }

  url.search = ''
  url.hash = ''
  window.history.replaceState({}, document.title, url.toString())
}

async function resolveAuthCallback() {
  if (!supabase) {
    return { handled: false, session: null, error: null }
  }

  try {
    const url = new URL(window.location.href)
    const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : '')

    authLog('callback inspect', {
      path: `${url.pathname}${url.search}${url.hash}`,
      hasCode: url.searchParams.has('code'),
      hasTokenHash: url.searchParams.has('token_hash'),
      hasAccessToken: hashParams.has('access_token'),
    })

    if (url.searchParams.has('code')) {
      const code = url.searchParams.get('code')
      authLog('callback exchange start', { type: 'code' })
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      authLog('callback exchange result', {
        type: 'code',
        userId: data.session?.user?.id ?? null,
        sessionDetected: Boolean(data.session),
        error: error?.message ?? null,
      })

      if (!error) {
        clearAuthUrlArtifacts()
      }

      return { handled: true, session: data.session ?? null, error }
    }

    if (url.searchParams.has('token_hash') && url.searchParams.has('type')) {
      const token_hash = url.searchParams.get('token_hash')
      const type = url.searchParams.get('type')
      authLog('callback exchange start', { type })
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type,
      })
      authLog('callback exchange result', {
        type,
        userId: data.session?.user?.id ?? null,
        sessionDetected: Boolean(data.session),
        error: error?.message ?? null,
      })

      if (!error) {
        clearAuthUrlArtifacts()
      }

      return { handled: true, session: data.session ?? null, error }
    }

    if (hashParams.has('access_token') || hashParams.has('refresh_token')) {
      authLog('callback hash detected', {
        hasAccessToken: hashParams.has('access_token'),
        hasRefreshToken: hashParams.has('refresh_token'),
      })
    }

    authLog('callback inspect complete', { handled: false })
    return { handled: false, session: null, error: null }
  } catch (error) {
    authLog('callback inspect failed', { error: error.message })
    return { handled: false, session: null, error }
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState('loading')
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!supabase) {
      authLog('boot setup error', { error: supabaseSetupError })
      setAuthError(supabaseSetupError)
      setStatus('setup-error')
      return
    }

    let mounted = true

    async function bootAuth() {
      try {
        authLog('auth boot start', { href: window.location.href })

        const callbackResult = await resolveAuthCallback()

        if (!mounted) {
          return
        }

        if (callbackResult.error) {
          setAuthError(callbackResult.error.message)
        }

        authLog('boot after callback', {
          callbackHandled: callbackResult.handled,
          callbackUserId: callbackResult.session?.user?.id ?? null,
        })

        authLog('getSession start')
        const { data, error } = await supabase.auth.getSession()

        if (!mounted) {
          return
        }

        authLog('getSession result', {
          userId: data.session?.user?.id ?? null,
          sessionDetected: Boolean(data.session),
          error: error?.message ?? null,
          callbackHandled: callbackResult.handled,
        })

        if (error) {
          setAuthError(error.message)
          setSession(null)
          setStatus('unauthenticated')
          return
        }

        setSession(data.session ?? callbackResult.session ?? null)
        setStatus(data.session || callbackResult.session ? 'authenticated' : 'unauthenticated')
      } catch (error) {
        authLog('auth boot failed', { error: error.message })
        if (!mounted) {
          return
        }
        setAuthError(error.message)
        setSession(null)
        setStatus('unauthenticated')
      }
    }

    bootAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authLog('auth state changed', {
        event,
        userId: nextSession?.user?.id ?? null,
        sessionDetected: Boolean(nextSession),
      })

      if (!mounted) {
        return
      }

      if (nextSession) {
        clearAuthUrlArtifacts()
      }

      setSession(nextSession ?? null)
      setStatus(nextSession ? 'authenticated' : 'unauthenticated')
      setAuthError('')
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      status,
      authError,
      signInWithOtp: (email) => {
        const emailRedirectTo = `${window.location.origin}/dashboard`
        authLog('magic link send', { email, emailRedirectTo })

        return supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo,
          },
        })
      },
      signInWithPassword: (email, password) => {
        return supabase.auth.signInWithPassword({ email, password })
      },
      signUpWithPassword: (email, password) => {
        return supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        })
      },
      sendPasswordReset: (email) => {
        return supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
      },
      updateUserPassword: (password) => {
        return supabase.auth.updateUser({ password })
      },
      signOut: async () => {
        authLog('sign out start')
        const result = await supabase.auth.signOut()
        authLog('sign out result', { error: result.error?.message ?? null })
        return result
      },
    }),
    [session, status, authError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return value
}
