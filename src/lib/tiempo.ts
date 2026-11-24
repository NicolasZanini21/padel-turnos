// Todas las conversiones a hora local usan la zona del club explícita:
// el servidor de Vercel corre en UTC.
export const ZONA = "America/Argentina/Buenos_Aires";

const fmtFechaISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const fmtHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const fmtDiaLargo = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const fmtDiaCorto = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  weekday: "short",
  day: "numeric",
});

/** YYYY-MM-DD en la zona del club */
export function fechaLocal(d: Date | string): string {
  return fmtFechaISO.format(typeof d === "string" ? new Date(d) : d);
}

/** "20:00" */
export function hora(d: Date | string): string {
  return fmtHora.format(typeof d === "string" ? new Date(d) : d);
}

/** "martes 24 de noviembre" */
export function diaLargo(d: Date | string): string {
  return fmtDiaLargo.format(typeof d === "string" ? new Date(d) : d);
}

/** Una fecha YYYY-MM-DD como mediodía local, para formatearla sin corrimientos */
export function fechaComoInstante(fecha: string): Date {
  return new Date(`${fecha}T12:00:00-03:00`);
}

export function diaCorto(fecha: string): string {
  return fmtDiaCorto.format(fechaComoInstante(fecha)).replace(".", "");
}

export function diaLargoDeFecha(fecha: string): string {
  return fmtDiaLargo.format(fechaComoInstante(fecha));
}

export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
}

export function esFechaISO(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function precio(ars: number | null | undefined): string | null {
  if (ars == null) return null;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(ars);
}
