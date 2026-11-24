import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { supabasePublico } from "@/lib/supabase/server";
import type { ConfigPublica, ReservaPublica, Turno } from "@/lib/tipos";

export async function obtenerConfig(): Promise<ConfigPublica> {
  const { data, error } = await supabasePublico().rpc("config_publica");
  if (error || !data) throw new Error(`config_publica: ${error?.message ?? "sin datos"}`);
  return data as ConfigPublica;
}

export async function obtenerDisponibilidad(fecha: string): Promise<Turno[]> {
  const { data, error } = await supabasePublico().rpc("disponibilidad", { p_fecha: fecha });
  if (error) throw new Error(`disponibilidad: ${error.message}`);
  return (data ?? []) as Turno[];
}

export async function obtenerReserva(token: string): Promise<ReservaPublica | null> {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const { data, error } = await supabasePublico().rpc("ver_reserva", { p_token: token });
  if (error) throw new Error(`ver_reserva: ${error.message}`);
  return (data as ReservaPublica | null) ?? null;
}

/** Número de WhatsApp del club. Cacheado unos minutos; se invalida al guardar la configuración. */
export async function obtenerWhatsapp(): Promise<string> {
  "use cache";
  cacheLife("minutes");
  cacheTag("config");
  // Nunca rompe la página (ni el build, que la prerenderiza): si la base no responde,
  // el botón no se muestra y se vuelve a intentar al vencer el cache.
  try {
    const { data } = await supabasePublico().rpc("config_publica");
    return (data as ConfigPublica | null)?.whatsapp_numero ?? "";
  } catch {
    return "";
  }
}
