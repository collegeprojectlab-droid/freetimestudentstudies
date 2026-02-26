import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// Correct: all strings in quotes
const supabaseUrl = process.env.SUPABASE_URL || 'https://phndaufemuivorafxenx.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_jnaqQUrUn44rwMa0Fd6guA_U8fUXoBt'

const supabase = createClient(supabaseUrl, supabaseKey)

// Example function: fetch all users from "users" table
async function fetchUsers() {
  const { data, error } = await supabase.from('users').select('*')
  if (error) {
    console.error('Error fetching users:', error)
  } else {
    console.log('Users:', data)
  }
}

fetchUsers()