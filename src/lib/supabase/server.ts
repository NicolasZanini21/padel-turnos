import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** Cliente con la sesión del admin (cookies). Para el panel y sus server actions. */
export async function supabaseConSesion() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (aSetear) => {
        try {
          aSetear.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: el proxy se encarga de refrescar la sesión.
        }
      },
    },
  });
}

/** Cliente anónimo, sin cookies. Para las funciones públicas (disponibilidad, reservar...). */
export function supabasePublico() {
  return createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Devuelve el usuario si es admin; si no, null. Verifica el JWT contra Supabase. */
export async function adminActual() {
  const supabase = await supabaseConSesion();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return null;
  const { data: esAdmin } = await supabase.rpc("es_admin");
  return esAdmin ? { id: uid, email: (data.claims.email as string | undefined) ?? "" } : null;
}
