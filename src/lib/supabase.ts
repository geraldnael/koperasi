import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON || '', {
  auth: { persistSession: false },
})

export const isOnline = () =>
  !!(SUPABASE_URL && SUPABASE_ANON &&
     SUPABASE_URL.startsWith('https://') &&
     SUPABASE_ANON.length > 10)
