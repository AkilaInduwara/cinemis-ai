import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bhlzrdadggptpddqatdo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImjobHpyZGFkZ2dwdHBkZHFhdGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDc1NDMsImV4cCI6MjA2ODQ4MzU0M30.fuO8CHSv1Tpa9l-tPKsYhcmChAC4lMS-ymH7LCXJWAo'

export const supabase = createClient(supabaseUrl, supabaseKey)