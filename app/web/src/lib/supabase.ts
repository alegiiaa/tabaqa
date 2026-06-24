import { createClient } from '@supabase/supabase-js'

// Read from Vite env (app/web/.env.local — git-ignored). Get these two values from
// your Supabase project: Dashboard → Project Settings → API.
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True once both env vars are present — the auth UI checks this before calling out. */
export const isSupabaseConfigured = Boolean(url && anon)

if (!isSupabaseConfigured) {
  // Non-fatal: the landing page still works. The login screen shows a clear notice.
  console.warn(
    '[Tabaqa] Supabase is not configured. Add VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY to app/web/.env.local, then restart `npm run dev`.',
  )
}

// Harmless placeholders keep the client (and the rest of the app) from crashing when
// env is missing; any auth call simply fails gracefully and surfaces a friendly message.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anon || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // completes the OAuth redirect (?code=…) on return
    },
  },
)
