// Lógica del worker de mails, separada de Deno para poder probarla desde Node.
// Ver diseno_tecnico_v1.md, sección 4, "Job 2".
import { armarMail, type DatosMail } from "./plantillas.ts";

type Notificacion = {
  id: number;
  reserva_id: string;
  tipo: DatosMail["tipo"];
  intentos: number;
};

type ReservaMail = {
  id: string;
  estado: string;
  inicio: string;
  fin: string;
  nombre: string;
  email: string | null;
  precio_ars: number | null;
  token_gestion: string;
  motivo_cancelacion: string | null;
  cancelada_por: DatosMail["cancelada_por"];
  canchas: { nombre: string } | null;
};

// Subconjunto del cliente de supabase-js que se usa (service role)
// deno-lint-ignore no-explicit-any
type Cliente = any;

export type EnviarMail = (m: {
  para: string;
  asunto: string;
  html: string;
  texto: string;
  idempotencia: string;
}) => Promise<{ id: string }>;

export type Opciones = {
  sitioUrl: string;
  logoUrl: string;
  ahora?: () => Date;
};

const MAX_INTENTOS = 5;
const MARGEN_RECORDATORIO_MS = 60 * 60 * 1000; // si falta menos de 1 h, el recordatorio no sirve

export async function procesarNotificaciones(supabase: Cliente, enviar: EnviarMail, op: Opciones) {
  const ahora = op.ahora ?? (() => new Date());
  const resumen = { reclamadas: 0, enviadas: 0, descartadas: 0, reintentos: 0, fallidas: 0 };

  const { data: lote, error } = await supabase.rpc("reclamar_notificaciones", { p_limite: 20 });
  if (error) throw new Error(`reclamar_notificaciones: ${error.message}`);
  const notificaciones = (lote ?? []) as Notificacion[];
  resumen.reclamadas = notificaciones.length;
  if (!notificaciones.length) return resumen;

  const { data: cfg } = await supabase.from("config").select("whatsapp_numero, limite_cancelacion_usuario").single();

  for (const n of notificaciones) {
    const { data: r } = await supabase
      .from("reservas")
      .select("id, estado, inicio, fin, nombre, email, precio_ars, token_gestion, motivo_cancelacion, cancelada_por, canchas(nombre)")
      .eq("id", n.reserva_id)
      .single();
    const reserva = r as ReservaMail | null;

    const motivoDescarte = !reserva
      ? "la reserva no existe"
      : !reserva.email
        ? "sin mail"
        : n.tipo === "confirmacion" && reserva.estado !== "confirmada"
          ? "la reserva ya no está confirmada"
          : n.tipo === "recordatorio" &&
              (reserva.estado !== "confirmada" || new Date(reserva.inicio).getTime() - ahora().getTime() < MARGEN_RECORDATORIO_MS)
            ? "recordatorio fuera de tiempo o reserva no confirmada"
            : null;

    if (motivoDescarte) {
      await supabase.from("notificaciones").update({ estado: "descartada", ultimo_error: motivoDescarte }).eq("id", n.id);
      resumen.descartadas++;
      continue;
    }

    const res = reserva!;
    const linkReserva = `${op.sitioUrl}/reserva/${res.token_gestion}`;
    const limiteMs = intervaloAMs(cfg?.limite_cancelacion_usuario ?? "03:00:00");
    const mail = armarMail({
      tipo: n.tipo,
      nombre: res.nombre,
      cancha: res.canchas?.nombre ?? "Cancha",
      inicio: res.inicio,
      fin: res.fin,
      precio_ars: res.precio_ars,
      motivo_cancelacion: res.motivo_cancelacion,
      cancelada_por: res.cancelada_por,
      link_reserva: linkReserva,
      link_cancelar: `${linkReserva}/cancelar`,
      link_whatsapp: `https://wa.me/${cfg?.whatsapp_numero ?? ""}`,
      logo_url: op.logoUrl,
      sitio_url: op.sitioUrl,
      puede_cancelar: new Date(res.inicio).getTime() - ahora().getTime() >= limiteMs,
    });

    try {
      const { id } = await enviar({
        para: res.email!,
        asunto: mail.asunto,
        html: mail.html,
        texto: mail.texto,
        idempotencia: `notif-${n.id}`,
      });
      await supabase
        .from("notificaciones")
        .update({ estado: "enviada", enviada_en: ahora().toISOString(), proveedor_id: id, ultimo_error: null })
        .eq("id", n.id);
      resumen.enviadas++;
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      const agotada = n.intentos >= MAX_INTENTOS;
      await supabase
        .from("notificaciones")
        .update({
          estado: agotada ? "fallida" : "pendiente",
          enviar_desde: new Date(ahora().getTime() + 2 ** n.intentos * 60_000).toISOString(),
          ultimo_error: mensaje.slice(0, 500),
        })
        .eq("id", n.id);
      if (agotada) resumen.fallidas++;
      else resumen.reintentos++;
    }
  }
  return resumen;
}

/** "03:00:00" o "3 hours" (formatos de interval de Postgres) a milisegundos */
export function intervaloAMs(v: string): number {
  const hms = /^(\d+):(\d{2}):(\d{2})$/.exec(v);
  if (hms) return ((+hms[1] * 60 + +hms[2]) * 60 + +hms[3]) * 1000;
  const horas = /(\d+)\s*hours?/.exec(v);
  const minutos = /(\d+)\s*min/.exec(v);
  return ((horas ? +horas[1] * 60 : 0) + (minutos ? +minutos[1] : 0)) * 60_000;
}

/** Envío con la API de Resend. La Idempotency-Key evita duplicados si se reintenta. */
export function enviarConResend(apiKey: string, remitente: string, responderA?: string): EnviarMail {
  return async ({ para, asunto, html, texto, idempotencia }) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencia,
      },
      body: JSON.stringify({
        from: remitente,
        to: [para],
        subject: asunto,
        html,
        text: texto,
        ...(responderA ? { reply_to: responderA } : {}),
      }),
    });
    const cuerpo = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(cuerpo).slice(0, 300)}`);
    return { id: (cuerpo as { id: string }).id };
  };
}
