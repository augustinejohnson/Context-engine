import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cqagunhewncthekmvftk.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_RHLgwUCfvdGNtjog7NrLGg_31AsXAEx'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
