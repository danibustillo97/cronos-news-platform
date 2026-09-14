import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mxvdnfaeqjifnxqmxbri.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14dmRuZmFlcWppZm54cW14YnJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNjg0NzAsImV4cCI6MjA2Nzg0NDQ3MH0.KLD8IAWiAIhkKXJ9lZR7Yc6GaPpxOa3zdaItozCw4Hc'

export const supabase = createClient(supabaseUrl, supabaseKey)
