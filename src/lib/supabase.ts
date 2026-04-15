import { createClient } from "@supabase/supabase-js";

// Server-side client for db.ts — uses service role key to bypass RLS
// (API routes handle auth checks via getAuthUserId before calling db functions)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
