import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cqagunhewncthekmvftk.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYWd1bmhld25jdGhla212ZnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDgxODEsImV4cCI6MjEwMTA4NDE4MX0.DuRnmcOrohiFRwzo5GDwGQ-i9TkE-Br287EkfiyXQeA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
