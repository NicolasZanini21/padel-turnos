"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizarTelefono } from "@/lib/contacto";
import { mensajeDeError } from "@/lib/errores";
import { adminActual, supabaseConSesion } from "@/lib/supabase/server";

export type Resultado = { ok?: boolean; error?: string; mensaje?: string; email?: string };

async function cliente() {
  if (!(await adminActual())) redirect("/admin/login");
  return supabaseConSesion();
}

// ---------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------
export async function ingresar(_prev: Resultado, form: FormData): Promise<Resultado> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Completá mail y contraseña.", email };

  const supabase = await supabaseConSesion();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Mail o contraseña incorrectos.", email };

  const { data: esAdmin } = await supabase.rpc("es_admin");
  if (!esAdmin) {
    await supabase.auth.signOut();
    return { error: "Esta cuenta no tiene acceso al panel.", email };
  }
  redirect("/admin");
}

export async function salir() {
  const supabase = await supabaseConSesion();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ---------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------
async function cambiarEstado(id: string, cambios: Record<string, unknown>): Promise<Resultado> {
  const supabase = await cliente();
  const { error, count } = await supabase.from("reservas").update(cambios, { count: "exact" }).eq("id", id);
  if (error) return { error: mensajeDeError(error) };
  if (!count) return { error: "La reserva no existe o ya cambió de estado." };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function confirmarReserva(id: string) {
  return cambiarEstado(id, { estado: "confirmada" });
}

export async function rechazarReserva(id: string, motivo: string) {
  return cambiarEstado(id, {
    estado: "cancelada",
    cancelada_por: "admin",
    motivo_cancelacion: motivo.trim() || "rechazada por el club",
  });
}

export async function reactivarReserva(id: string) {
  const r = await cambiarEstado(id, { estado: "confirmada" });
  if (r.error?.includes("alguien acaba de reservar")) {
    return { error: "Ese horario ya lo tomó otra reserva, no se puede reactivar." };
  }
  return r;
}

export async function guardarNotas(id: string, notas: string) {
  return cambiarEstado(id, { notas_admin: notas.trim() || null });
}

const esquemaManual = z.object({
  cancha_id: z.coerce.number().int().positive(),
  inicio: z.iso.datetime({ offset: true }),
  fin: z.iso.datetime({ offset: true }),
  nombre: z.string().trim().min(2, "Poné un nombre").max(80),
  telefono: z.string().trim().min(6, "Poné un teléfono"),
  email: z.union([z.literal(""), z.email("Mail inválido")]),
  notas: z.string().max(500).optional(),
});

export async function crearReservaManual(_prev: Resultado, form: FormData): Promise<Resultado> {
  const parse = esquemaManual.safeParse(Object.fromEntries(form));
  if (!parse.success) return { error: parse.error.issues[0]?.message ?? "Datos inválidos" };
  const telefono = normalizarTelefono(parse.data.telefono);
  if (!telefono) return { error: "Revisá el teléfono." };

  const supabase = await cliente();
  const { error } = await supabase.from("reservas").insert({
    cancha_id: parse.data.cancha_id,
    inicio: parse.data.inicio,
    fin: parse.data.fin,
    nombre: parse.data.nombre,
    telefono,
    email: parse.data.email || null,
    estado: "confirmada",
    origen: "admin",
    notas_admin: parse.data.notas?.trim() || null,
  });
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, mensaje: "Reserva creada." };
}

// ---------------------------------------------------------------------
// Bloqueos
// ---------------------------------------------------------------------
export async function crearBloqueo(_prev: Resultado, form: FormData): Promise<Resultado> {
  const cancha = String(form.get("cancha_id") ?? "");
  const desde = String(form.get("desde") ?? "");
  const hasta = String(form.get("hasta") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!desde || !hasta || motivo.length < 2) return { error: "Completá desde, hasta y motivo." };
  const d = new Date(`${desde}:00-03:00`);
  const h = new Date(`${hasta}:00-03:00`);
  if (!(h > d)) return { error: "El fin tiene que ser después del inicio." };

  const supabase = await cliente();
  const { error } = await supabase.from("bloqueos").insert({
    cancha_id: cancha ? Number(cancha) : null,
    rango: `[${d.toISOString()},${h.toISOString()})`,
    motivo,
  });
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, mensaje: "Bloqueo creado. Las reservas existentes en ese rango no se cancelan solas." };
}

export async function eliminarBloqueo(id: number) {
  const supabase = await cliente();
  const { error } = await supabase.from("bloqueos").delete().eq("id", id);
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Turnos fijos
// ---------------------------------------------------------------------
const esquemaFijo = z.object({
  cancha_id: z.coerce.number().int().positive(),
  dia_semana: z.coerce.number().int().min(1).max(7),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/),
  vigente_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type FechaPrevia = {
  fecha: string;
  inicio: string;
  fin: string;
  motivo: "conflicto" | "club_cerrado" | "bloqueo" | null;
  conflicto_nombre: string | null;
  conflicto_estado: string | null;
};

export async function previsualizarTurnoFijo(datos: {
  cancha_id: number;
  dia_semana: number;
  hora_inicio: string;
  vigente_desde: string;
}): Promise<{ fechas?: FechaPrevia[]; error?: string }> {
  const parse = esquemaFijo.safeParse(datos);
  if (!parse.success) return { error: "Completá cancha, día, hora y fecha de inicio." };
  const supabase = await cliente();
  const { data, error } = await supabase.rpc("previsualizar_turno_fijo", {
    p_cancha_id: parse.data.cancha_id,
    p_dia_semana: parse.data.dia_semana,
    p_hora_inicio: parse.data.hora_inicio,
    p_vigente_desde: parse.data.vigente_desde,
    p_semanas: 8,
  });
  if (error) {
    return { error: error.message === "horario_invalido" ? "Esa hora no coincide con un turno de la grilla de ese día." : mensajeDeError(error) };
  }
  return { fechas: data as FechaPrevia[] };
}

export async function crearTurnoFijo(_prev: Resultado, form: FormData): Promise<Resultado> {
  const base = esquemaFijo.safeParse(Object.fromEntries(form));
  const nombre = String(form.get("nombre") ?? "").trim();
  const telefono = normalizarTelefono(String(form.get("telefono") ?? ""));
  const email = String(form.get("email") ?? "").trim();
  const avisos = form.get("avisos_por_mail") === "on";
  const precioTxt = String(form.get("precio_ars") ?? "").trim();
  const hasta = String(form.get("vigente_hasta") ?? "").trim();
  if (!base.success) return { error: "Completá cancha, día, hora y fecha de inicio." };
  if (nombre.length < 2) return { error: "Poné el nombre del grupo o titular." };
  if (!telefono) return { error: "Revisá el teléfono." };
  if (avisos && !email) return { error: "Para mandar avisos por mail hace falta un mail." };

  const supabase = await cliente();
  const { data, error } = await supabase.rpc("crear_turno_fijo", {
    p_cancha_id: base.data.cancha_id,
    p_dia_semana: base.data.dia_semana,
    p_hora_inicio: base.data.hora_inicio,
    p_nombre: nombre,
    p_telefono: telefono,
    p_email: email,
    p_avisos_por_mail: avisos,
    p_precio_ars: precioTxt ? Number(precioTxt) : null,
    p_vigente_desde: base.data.vigente_desde,
    p_vigente_hasta: hasta || null,
    p_notas: String(form.get("notas") ?? ""),
  });
  if (error) return { error: mensajeDeError(error) };
  const r = data as { id: number; fechas_creadas: number; conflictos: number };
  revalidatePath("/admin", "layout");
  redirect(`/admin/turnos-fijos/${r.id}?creado=${r.fechas_creadas}&conflictos=${r.conflictos}`);
}

export async function saltearFechaFija(id: number, fecha: string, motivo: string) {
  const supabase = await cliente();
  const { error } = await supabase.rpc("saltear_fecha_fija", { p_turno_fijo_id: id, p_fecha: fecha, p_motivo: motivo });
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function reactivarFechaFija(id: number, fecha: string): Promise<Resultado> {
  const supabase = await cliente();
  const { data, error } = await supabase.rpc("reactivar_fecha_fija", { p_turno_fijo_id: id, p_fecha: fecha });
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/admin", "layout");
  if (data === "conflicto") return { error: "Ese horario ya lo reservó otra persona: la fecha quedó en conflicto." };
  return { ok: true };
}

export async function darDeBajaTurnoFijo(id: number, desde: string): Promise<Resultado> {
  const supabase = await cliente();
  const { data, error } = await supabase.rpc("dar_de_baja_turno_fijo", { p_turno_fijo_id: id, p_desde: desde });
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, mensaje: `Turno fijo dado de baja. Se cancelaron ${data} fechas futuras.` };
}

export async function editarContactoTurnoFijo(id: number, _prev: Resultado, form: FormData): Promise<Resultado> {
  const nombre = String(form.get("nombre") ?? "").trim();
  const telefono = normalizarTelefono(String(form.get("telefono") ?? ""));
  const email = String(form.get("email") ?? "").trim();
  const avisos = form.get("avisos_por_mail") === "on";
  if (nombre.length < 2) return { error: "Poné el nombre." };
  if (!telefono) return { error: "Revisá el teléfono." };
  if (avisos && !email) return { error: "Para mandar avisos por mail hace falta un mail." };
  const supabase = await cliente();
  const { error } = await supabase.rpc("editar_contacto_turno_fijo", {
    p_turno_fijo_id: id,
    p_nombre: nombre,
    p_telefono: telefono,
    p_email: email,
    p_avisos_por_mail: avisos,
    p_notas: String(form.get("notas") ?? ""),
  });
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, mensaje: "Datos guardados. Se copiaron a las fechas futuras." };
}
