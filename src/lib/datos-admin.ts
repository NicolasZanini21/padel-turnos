import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { adminActual, supabaseConSesion } from "@/lib/supabase/server";
import type { Reserva } from "@/lib/tipos";

/** Para usar al principio de cada página del panel (dentro de Suspense). */
export async function exigirAdmin() {
  await connection(); // el panel siempre se renderiza en el momento
  const admin = await adminActual();
  if (!admin) redirect("/admin/login");
  return { admin, supabase: await supabaseConSesion() };
}

export type ReservaConCancha = Reserva & { canchas: { nombre: string } | null };

export const COLUMNAS_RESERVA = "*, canchas(nombre)";

/** Rango [desde, hasta) en UTC del día operativo local (06:00 a 06:00 del día siguiente). */
export function rangoDelDia(fecha: string) {
  const desde = new Date(`${fecha}T06:00:00-03:00`);
  const hasta = new Date(desde.getTime() + 24 * 3600 * 1000);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

export async function canchas() {
  const { supabase } = await exigirAdmin();
  const { data } = await supabase.from("canchas").select("id, nombre, activa").order("orden");
  return (data ?? []) as { id: number; nombre: string; activa: boolean }[];
}

export async function hoyLocal() {
  const { supabase } = await exigirAdmin();
  const { data } = await supabase.rpc("hoy_local");
  return data as string;
}
