// Supabase client (only created when the connection settings in .env exist).
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

// The claude.ai artifact build uses its own database and can't reach other servers.
export const supabase =
  url && key && import.meta.env.MODE !== 'artifact'
    ? createClient(url, key, {
        auth: {
          flowType: 'pkce', // sign-in link comes back as ?code=..., which doesn't clash with our #/routes
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    : null;
