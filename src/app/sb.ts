import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/config";

// PKCE: после входа через Google код приходит в ?code=…, а не в #hash — hash занят маршрутами приложения.
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "osiris-auth" },
  realtime: { params: { eventsPerSecond: 5 } },
});
