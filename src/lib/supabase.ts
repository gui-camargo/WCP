import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.')
}

// PWA standalone mode gets its own storage key so the session never conflicts
// with a browser tab open on the same origin (shared localStorage + refresh
// token rotation would cause each to sign the other out).
const isPWA =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true

// Lock with 5-second timeout: serializes token refreshes across tabs (preventing
// refresh-token rotation from invalidating other tabs), but never blocks forever.
// After 5s without acquiring the lock, falls back to running without it.
const lockWithTimeout = async <R,>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  if (typeof navigator === 'undefined' || !navigator.locks) return fn()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    return await (navigator.locks.request(name, { signal: controller.signal }, fn) as Promise<R>)
  } catch (err: any) {
    if (err?.name === 'AbortError') return fn()
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(isPWA ? { storageKey: 'sb-pwa' } : {}),
    lock: lockWithTimeout,
  },
})
