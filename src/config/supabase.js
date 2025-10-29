const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL environment variable is required');
}

if (!SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_ANON_KEY) {
  throw new Error('Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be provided');
}

// For server-side operations, prefer service role key if available, fall back to anon key
const apiKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, apiKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = supabase;
