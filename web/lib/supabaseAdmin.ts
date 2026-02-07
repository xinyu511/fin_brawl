import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side admin client for DB inserts/queries.
export const supabaseAdmin = createClient(url, service, {
  auth: { persistSession: false }
});
