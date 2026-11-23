import { parsePhoneNumberFromString } from "libphonenumber-js";
import { capitalizar, diaLargo, hora } from "./tiempo";

/** Normaliza a E.164 (+549341...). Por defecto asume Argentina. */
export function normalizarTelefono(entrada: string): string | null {
  const limpio = entrada.trim();
  if (!limpio) return null;
  const tel = parsePhoneNumberFromString(limpio, "AR");
  if (!tel || !tel.isValid()) return null;
  return tel.number as string;
}

export function telefonoLegible(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

export function linkWhatsapp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export function mensajeReserva(r: { cancha: string; inicio: string; fin: string; nombre: string }, link: string) {
  return [
    `Hola! Reservé un turno en la web y quiero coordinar el pago.`,
    `${r.cancha} · ${capitalizar(diaLargo(r.inicio))} de ${hora(r.inicio)} a ${hora(r.fin)}`,
    `A nombre de: ${r.nombre}`,
    `Mi reserva: ${link}`,
  ].join("\n");
}
