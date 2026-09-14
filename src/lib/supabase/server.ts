import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

// Singleton instance with connection pooling
let cachedClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!cachedClient) {
    cachedClient = createSupabaseClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return cachedClient;
}
