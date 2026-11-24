"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mensajeDeError } from "@/lib/errores";
import { adminActual, supabaseConSesion } from "@/lib/supabase/server";
import { rangoDelDia } from "@/lib/datos-admin";
import type { Resultado } from "./acciones";

async function cliente() {
  if (!(await adminActual())) redirect("/admin/login");
  return supabaseConSesion();
}

/** Cambió algo que ve el público: grilla, WhatsApp, plazos. */
function refrescar() {
  updateTag("config");
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------
// Parámetros generales
// ---------------------------------------------------------------------
const esquemaParametros = z.object({
  whatsapp_numero: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().regex(/^[1-9][0-9]{7,14}$/, "El WhatsApp va con código de país, sin + ni espacios. Ej: 5493415551234")),
  ventana_gracia_minutos: z.coerce.number().int().min(15, "La ventana de pago es de al menos 15 minutos").max(72 * 60),
  dias_max_anticipacion: z.coerce.number().int().min(1).max(90, "Hasta 90 días de anticipación"),
  limite_cancelacion_horas: z.coerce.number().min(0).max(72, "Hasta 72 horas"),
  max_pendientes_por_telefono: z.coerce.number().int().min(1).max(10, "Entre 1 y 10"),
});

export async function guardarParametros(_prev: Resultado, form: FormData): Promise<Resultado> {
  const parse = esquemaParametros.safeParse(Object.fromEntries(form));
  if (!parse.success) return { error: parse.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parse.data;

  const supabase = await cliente();
  const { error } = await supabase
    .from("config")
    .update({
      whatsapp_numero: d.whatsapp_numero,
      ventana_gracia: `${d.ventana_gracia_minutos} minutes`,
      dias_max_anticipacion: d.dias_max_anticipacion,
      limite_cancelacion_usuario: `${Math.round(d.limite_cancelacion_horas * 60)} minutes`,
      max_pendientes_por_telefono: d.max_pendientes_por_telefono,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { error: mensajeDeError(error) };
  refrescar();
  return { ok: true, mensaje: "Guardado." };
}

// ---------------------------------------------------------------------
// Horario semanal
// ---------------------------------------------------------------------
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");

const esquemaFranja = z.object({
  dia_semana: z.number().int().min(1).max(7),
  apertura: hhmm,
  cierre: hhmm,
  duracion_minutos: z.number().int().min(30).max(180),
  precio_ars: z.number().min(0).nullable(),
});

export type FranjaEditable = z.infer<typeof esquemaFranja>;

function aMinutos(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Valida que cada franja tenga al menos un turno y que no se pisen dentro del mismo día. */
function validarFranjas(franjas: FranjaEditable[]): string | null {
  const DIAS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  for (let dia = 1; dia <= 7; dia++) {
    const delDia = franjas
      .filter((f) => f.dia_semana === dia)
      .map((f) => {
        const desde = aMinutos(f.apertura);
        let hasta = aMinutos(f.cierre);
        if (hasta <= desde) hasta += 24 * 60; // cierra después de medianoche
        return { desde, hasta, dur: f.duracion_minutos };
      })
      .sort((a, b) => a.desde - b.desde);
    for (const [i, f] of delDia.entries()) {
      if (f.hasta - f.desde < f.dur) return `El ${DIAS[dia]} hay un horario donde no entra ni un turno.`;
      const sig = delDia[i + 1];
      if (sig && sig.desde < f.hasta) return `El ${DIAS[dia]} hay dos horarios que se pisan.`;
    }
  }
  return null;
}

export async function guardarHorarioSemanal(franjas: FranjaEditable[]): Promise<Resultado> {
  const parse = z.array(esquemaFranja).max(28).safeParse(franjas);
  if (!parse.success) return { error: parse.error.issues[0]?.message ?? "Datos inválidos" };
  const problema = validarFranjas(parse.data);
  if (problema) return { error: problema };

  const supabase = await cliente();
  const { data: anteriores, error: errLeer } = await supabase.from("franjas_semanales").select("id");
  if (errLeer) return { error: mensajeDeError(errLeer) };

  // Primero insertamos las nuevas y después borramos las viejas:
  // si algo falla a mitad de camino, el club nunca queda sin horario.
  if (parse.data.length) {
    const { error } = await supabase.from("franjas_semanales").insert(
      parse.data.map((f) => ({
        dia_semana: f.dia_semana,
        apertura: f.apertura,
        cierre: f.cierre,
        duracion_turno: `${f.duracion_minutos} minutes`,
        precio_ars: f.precio_ars,
      })),
    );
    if (error) return { error: mensajeDeError(error) };
  }
  const ids = (anteriores ?? []).map((f) => f.id as number);
  if (ids.length) {
    const { error } = await supabase.from("franjas_semanales").delete().in("id", ids);
    if (error) return { error: mensajeDeError(error) };
  }
  refrescar();
  return { ok: true, mensaje: "Horario guardado. Las reservas que ya estaban hechas no cambian." };
}

// ---------------------------------------------------------------------
// Días especiales (feriados, cierres, horarios distintos)
// ---------------------------------------------------------------------
const esquemaDiaEspecial = z
  .object({
    fecha: z.iso.date("Elegí una fecha"),
    cerrado: z.enum(["si", "no"]),
    apertura: z.string().optional(),
    cierre: z.string().optional(),
    duracion_minutos: z.coerce.number().int().min(30).max(180).optional(),
    precio_ars: z.string().optional(),
    motivo: z.string().trim().max(120).optional(),
    cancelar_reservas: z.string().optional(),
  })
  .refine((d) => d.cerrado === "si" || (hhmm.safeParse(d.apertura).success && hhmm.safeParse(d.cierre).success && d.duracion_minutos), {
    message: "Si el club abre ese día, completá apertura, cierre y duración del turno.",
  });

/** Reservas activas (confirmadas o pendientes) del día operativo. */
async function reservasActivasDelDia(supabase: Awaited<ReturnType<typeof cliente>>, fecha: string) {
  const { desde, hasta } = rangoDelDia(fecha);
  return supabase
    .from("reservas")
    .select("id, inicio")
    .gte("inicio", desde)
    .lt("inicio", hasta)
    .in("estado", ["confirmada", "pendiente_pago"]);
}

export async function contarReservasDelDia(fecha: string): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 0;
  const supabase = await cliente();
  const { data } = await reservasActivasDelDia(supabase, fecha);
  return data?.length ?? 0;
}

export async function guardarDiaEspecial(_prev: Resultado, form: FormData): Promise<Resultado> {
  const parse = esquemaDiaEspecial.safeParse(Object.fromEntries(form));
  if (!parse.success) return { error: parse.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parse.data;
  const cerrado = d.cerrado === "si";

  const supabase = await cliente();
  const { error } = await supabase.from("dias_especiales").upsert({
    fecha: d.fecha,
    cerrado,
    apertura: cerrado ? null : d.apertura,
    cierre: cerrado ? null : d.cierre,
    duracion_turno: cerrado ? null : `${d.duracion_minutos} minutes`,
    precio_ars: !cerrado && d.precio_ars ? Number(d.precio_ars) : null,
    motivo: d.motivo || null,
  });
  if (error) return { error: mensajeDeError(error) };

  let mensaje = "Día especial guardado.";
  if (cerrado) {
    const { data: afectadas } = await reservasActivasDelDia(supabase, d.fecha);
    const cantidad = afectadas?.length ?? 0;
    if (cantidad && d.cancelar_reservas === "si") {
      const { error: errCancelar, count } = await supabase
        .from("reservas")
        .update(
          { estado: "cancelada", cancelada_por: "admin", motivo_cancelacion: d.motivo ? `el club cierra: ${d.motivo}` : "el club cierra ese día" },
          { count: "exact" },
        )
        .in("id", afectadas!.map((r) => r.id));
      if (errCancelar) return { error: `Se guardó el día, pero no se pudieron cancelar las reservas: ${mensajeDeError(errCancelar)}` };
      mensaje = count === 1
        ? "Día cerrado. Se canceló 1 reserva y se le avisa por mail si dejó uno."
        : `Día cerrado. Se cancelaron ${count} reservas y se les avisa por mail a quienes dejaron uno.`;
    } else if (cantidad) {
      mensaje = `Día cerrado. Ojo: hay ${cantidad} ${cantidad === 1 ? "reserva" : "reservas"} ese día que siguen activas. Avisales o cancelalas desde Reservas.`;
    }
  }
  refrescar();
  revalidatePath("/admin", "layout");
  return { ok: true, mensaje };
}

export async function eliminarDiaEspecial(fecha: string): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.from("dias_especiales").delete().eq("fecha", fecha);
  if (error) return { error: mensajeDeError(error) };
  refrescar();
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Canchas
// ---------------------------------------------------------------------
export async function guardarCancha(id: number, cambios: { nombre?: string; activa?: boolean }): Promise<Resultado> {
  const datos: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) {
    const nombre = cambios.nombre.trim();
    if (nombre.length < 2 || nombre.length > 40) return { error: "El nombre tiene que tener entre 2 y 40 letras." };
    datos.nombre = nombre;
  }
  if (cambios.activa !== undefined) datos.activa = cambios.activa;

  const supabase = await cliente();
  const { error } = await supabase.from("canchas").update(datos).eq("id", id);
  if (error) return { error: error.code === "23505" ? "Ya hay otra cancha con ese nombre." : mensajeDeError(error) };
  refrescar();
  revalidatePath("/admin", "layout");
  return { ok: true, mensaje: "Cancha actualizada." };
}
