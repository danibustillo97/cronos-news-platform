import { createClient } from '@supabase/supabase-js'

// Fallback values are the anon key/URL that used to be hardcoded here
// unconditionally -- kept only as a dev-environment default so nothing
// breaks before NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY are
// set in Vercel. The anon key is meant to be public (protected by RLS),
// but hardcoding it removes the ability to point at a different Supabase
// project per environment (local/staging/production) -- see
// docs/NEXUS_ENVIRONMENT_MATRIX.md.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://mxvdnfaeqjifnxqmxbri.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14dmRuZmFlcWppZm54cW14YnJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNjg0NzAsImV4cCI6MjA2Nzg0NDQ3MH0.KLD8IAWiAIhkKXJ9lZR7Yc6GaPpxOa3zdaItozCw4Hc'

export const supabase = createClient(supabaseUrl, supabaseKey)
