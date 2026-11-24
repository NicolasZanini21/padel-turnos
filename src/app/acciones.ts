"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizarTelefono } from "@/lib/contacto";
import { codigoDeError, mensajeDeError } from "@/lib/errores";
import { supabasePublico } from "@/lib/supabase/server";

export type EstadoFormReserva = {
  error?: string;
  campos?: Partial<Record<"nombre" | "telefono" | "email", string>>;
  ocupado?: boolean;
  valores?: { nombre: string; telefono: string; email: string };
};

const esquema = z.object({
  cancha_id: z.coerce.number().int().positive(),
  inicio: z.iso.datetime({ offset: true }),
  nombre: z.string().trim().min(2, "Poné tu nombre y apellido").max(80, "Máximo 80 caracteres"),
  telefono: z.string().trim().min(6, "Poné un teléfono"),
  email: z.email("Ese mail no parece válido").trim().max(120),
});

export async function crearReserva(_prev: EstadoFormReserva, form: FormData): Promise<EstadoFormReserva> {
  const valores = {
    nombre: String(form.get("nombre") ?? ""),
    telefono: String(form.get("telefono") ?? ""),
    email: String(form.get("email") ?? ""),
  };

  // Honeypot: los bots completan todos los campos
  if (String(form.get("sitio_web") ?? "") !== "") {
    return { error: "No pudimos procesar la reserva.", valores };
  }

  const parse = esquema.safeParse(Object.fromEntries(form));
  if (!parse.success) {
    const campos: EstadoFormReserva["campos"] = {};
    for (const issue of parse.error.issues) {
      const k = issue.path[0];
      if (k === "nombre" || k === "telefono" || k === "email") campos[k] ??= issue.message;
    }
    return { error: Object.keys(campos).length ? undefined : "Elegí un turno de la grilla.", campos, valores };
  }

  const telefono = normalizarTelefono(parse.data.telefono);
  if (!telefono) {
    return { campos: { telefono: "Revisá el número: código de área y número, por ejemplo 341 555 1234" }, valores };
  }

  const { data, error } = await supabasePublico().rpc("crear_reserva", {
    p_cancha_id: parse.data.cancha_id,
    p_inicio: parse.data.inicio,
    p_nombre: parse.data.nombre,
    p_telefono: telefono,
    p_email: parse.data.email.toLowerCase(),
  });

  if (error || !data) {
    return { error: mensajeDeError(error), ocupado: codigoDeError(error) === "horario_ocupado", valores };
  }

  redirect(`/reserva/${(data as { token_gestion: string }).token_gestion}?nueva=1`);
}

export async function cancelarReserva(token: string): Promise<{ error?: string }> {
  if (!/^[0-9a-f]{48}$/.test(token)) return { error: mensajeDeError({ message: "no_encontrada" }) };
  const { error } = await supabasePublico().rpc("cancelar_reserva", { p_token: token });
  if (error) return { error: mensajeDeError(error) };
  redirect(`/reserva/${token}?cancelada=1`);
}
