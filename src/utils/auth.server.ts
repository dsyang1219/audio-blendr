// Server-only helper for resolving the authenticated Supabase user from the request.
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function getAuthUserFromRequest() {
  const req = getRequest();
  const auth = req?.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new Error("Not authenticated");
  const supa = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid session");
  return { userId: data.user.id, supa };
}
