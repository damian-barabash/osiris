import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/config";

/** Ссылка из письма «Забыли пароль?» приходит с токенами в #hash (её могли запросить с телефона и открыть где угодно,
 *  поэтому PKCE с привязкой к устройству тут не годится). Забираем токены до создания клиента и освобождаем hash для маршрутов. */
export const recoveryLink: { access?: string; refresh?: string; error?: string } = (() => {
  try {
    const h = new URLSearchParams(location.hash.replace(/^#/, ""));
    if (h.get("type") === "recovery" && h.get("access_token") && h.get("refresh_token")) {
      history.replaceState(null, "", location.pathname + location.search);
      return { access: h.get("access_token")!, refresh: h.get("refresh_token")! };
    }
    if (h.get("error_code") || h.get("error")) {
      history.replaceState(null, "", location.pathname + location.search);
      return { error: h.get("error_code") ?? h.get("error") ?? "error" };
    }
  } catch { /* */ }
  return {};
})();

/** Письмо для сброса пароля без PKCE: ссылку можно открыть на любом устройстве. */
export async function sendRecoveryEmail(email: string, redirectTo: string): Promise<string | null> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, { method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
  if (r.ok) return null;
  const j = await r.json().catch(() => ({}));
  return String(j.msg ?? j.message ?? j.error_description ?? r.status);
}

// PKCE: после входа через Google код приходит в ?code=…, а не в #hash — hash занят маршрутами приложения.
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "osiris-auth" },
  realtime: { params: { eventsPerSecond: 5 } },
});
