import type { ReactNode } from "react";

export const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const DURACIONES = [60, 90, 120];

export const claseControl =
  "min-h-11 w-full rounded-lg border border-borde-control bg-superficie-2 px-3 py-2 text-texto aria-invalid:border-error";

export function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-borde bg-superficie p-5" aria-labelledby={`t-${titulo}`}>
      <h2 id={`t-${titulo}`} className="font-titulo text-lg font-bold">
        {titulo}
      </h2>
      {descripcion ? <p className="mt-1 text-sm text-texto-suave">{descripcion}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Aviso({ resultado }: { resultado: { ok?: boolean; error?: string; mensaje?: string } | null | undefined }) {
  if (!resultado) return null;
  if (resultado.error)
    return (
      <p role="alert" className="text-sm text-error">
        {resultado.error}
      </p>
    );
  if (resultado.mensaje)
    return (
      <p role="status" className="text-sm text-primario">
        {resultado.mensaje}
      </p>
    );
  return null;
}

export function duracionLegible(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Horarios de inicio que salen de una franja (mismo cálculo que slots_del_dia). */
export function turnosDeFranja(apertura: string, cierre: string, duracion: number): string[] {
  const aMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  if (!/^\d{2}:\d{2}$/.test(apertura) || !/^\d{2}:\d{2}$/.test(cierre) || !duracion) return [];
  const desde = aMin(apertura);
  let hasta = aMin(cierre);
  if (hasta <= desde) hasta += 24 * 60;
  const res: string[] = [];
  for (let t = desde; t + duracion <= hasta; t += duracion) {
    res.push(`${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return res;
}
