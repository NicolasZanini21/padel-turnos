"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { crearTurnoFijo, previsualizarTurnoFijo, type FechaPrevia, type Resultado } from "@/app/admin/acciones";
import { Boton, Campo } from "@/components/ui";
import { capitalizar, diaLargoDeFecha } from "@/lib/tiempo";

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

type Franja = { dia_semana: number; apertura: string; cierre: string; duracion_turno: string };

function minutos(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Horarios de inicio de la grilla de ese día (mismo cálculo que slots_del_dia) */
function horariosDelDia(franjas: Franja[], dia: number): string[] {
  const res: string[] = [];
  for (const f of franjas.filter((x) => x.dia_semana === dia)) {
    const dur = minutos(f.duracion_turno);
    const desde = minutos(f.apertura);
    let hasta = minutos(f.cierre);
    if (hasta <= desde) hasta += 24 * 60;
    for (let t = desde; t + dur <= hasta; t += dur) {
      const hh = Math.floor(t / 60) % 24;
      res.push(`${String(hh).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
    }
  }
  return res;
}

const MOTIVO: Record<string, string> = {
  conflicto: "Choca con otra reserva",
  club_cerrado: "El club está cerrado",
  bloqueo: "Hay un bloqueo",
};

export function FormTurnoFijo({ canchas, franjas, hoy }: { canchas: { id: number; nombre: string }[]; franjas: Franja[]; hoy: string }) {
  const [cancha, setCancha] = useState(canchas[0]?.id ?? 1);
  const [dia, setDia] = useState(1);
  const [horaInicio, setHoraInicio] = useState("");
  const [desde, setDesde] = useState(hoy);
  const [previa, setPrevia] = useState<{ fechas?: FechaPrevia[]; error?: string } | null>(null);
  const [cargando, iniciar] = useTransition();
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(crearTurnoFijo, {});

  const horarios = useMemo(() => horariosDelDia(franjas, dia), [franjas, dia]);
  const horaElegida = horarios.includes(horaInicio) ? horaInicio : (horarios[0] ?? "");

  const pedirPrevia = () =>
    iniciar(async () => {
      setPrevia(await previsualizarTurnoFijo({ cancha_id: cancha, dia_semana: dia, hora_inicio: horaElegida, vigente_desde: desde }));
    });

  const conflictos = previa?.fechas?.filter((f) => f.motivo) ?? [];

  return (
    <form action={accion} className="space-y-6">
      <fieldset className="grid gap-4 rounded-2xl border border-borde bg-superficie p-5 sm:grid-cols-2">
        <legend className="px-1 font-semibold">Cuándo</legend>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Cancha</span>
          <select name="cancha_id" value={cancha} onChange={(e) => { setCancha(Number(e.target.value)); setPrevia(null); }} className="min-h-11 w-full rounded-lg border border-borde-control bg-superficie-2 px-3">
            {canchas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Día de la semana</span>
          <select name="dia_semana" value={dia} onChange={(e) => { setDia(Number(e.target.value)); setPrevia(null); }} className="min-h-11 w-full rounded-lg border border-borde-control bg-superficie-2 px-3">
            {DIAS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Horario</span>
          <select name="hora_inicio" value={horaElegida} onChange={(e) => { setHoraInicio(e.target.value); setPrevia(null); }} className="min-h-11 w-full rounded-lg border border-borde-control bg-superficie-2 px-3">
            {horarios.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <Campo etiqueta="Empieza el" nombre="vigente_desde" type="date" value={desde} min={hoy} onChange={(e) => { setDesde(e.target.value); setPrevia(null); }} required />
        <Campo etiqueta="Termina el (opcional)" nombre="vigente_hasta" type="date" min={desde} ayuda="Vacío = sin fecha de fin." />
      </fieldset>

      <fieldset className="grid gap-4 rounded-2xl border border-borde bg-superficie p-5 sm:grid-cols-2">
        <legend className="px-1 font-semibold">Quién</legend>
        <Campo etiqueta="Grupo o titular" nombre="nombre" required maxLength={80} placeholder="Ej.: Grupo de Juan" />
        <Campo etiqueta="Teléfono" nombre="telefono" type="tel" required placeholder="341 555 1234" />
        <Campo etiqueta="Mail (opcional)" nombre="email" type="email" />
        <Campo etiqueta="Precio por turno (opcional)" nombre="precio_ars" type="number" min={0} step={100} />
        <label className="flex min-h-11 items-center gap-2 sm:col-span-2">
          <input type="checkbox" name="avisos_por_mail" className="size-4 accent-primario" />
          <span className="text-sm">Mandarle el recordatorio por mail 5 h antes de cada fecha</span>
        </label>
        <Campo etiqueta="Notas (opcional)" nombre="notas" maxLength={500} />
      </fieldset>

      <section className="space-y-3 rounded-2xl border border-borde bg-superficie p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Próximas 8 fechas</h2>
          <Boton type="button" variante="secundario" onClick={pedirPrevia} disabled={cargando || !horaElegida}>
            {cargando ? "Revisando…" : "Revisar fechas"}
          </Boton>
        </div>
        {previa?.error ? <p role="alert" className="text-sm text-error">{previa.error}</p> : null}
        {previa?.fechas ? (
          <>
            <ul className="divide-y divide-borde text-sm">
              {previa.fechas.map((f) => (
                <li key={f.fecha} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{capitalizar(diaLargoDeFecha(f.fecha))}</span>
                  {f.motivo ? (
                    <span className="font-semibold text-estado-pendiente">
                      ⚠ {MOTIVO[f.motivo]}
                      {f.conflicto_nombre ? ` (${f.conflicto_nombre})` : ""}
                    </span>
                  ) : (
                    <span className="text-estado-confirmada">✓ Libre</span>
                  )}
                </li>
              ))}
            </ul>
            {conflictos.length ? (
              <p className="text-sm text-texto-suave">
                Las fechas con aviso se saltean y quedan anotadas en el detalle. Si preferís, primero cancelá esas reservas desde la agenda.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-texto-suave">Revisá las fechas antes de crear el turno para ver si choca con reservas.</p>
        )}
      </section>

      {estado.error ? <p role="alert" className="text-sm text-error">{estado.error}</p> : null}
      <Boton type="submit" disabled={enviando || !previa?.fechas} className="w-full sm:w-auto">
        {enviando ? "Creando…" : conflictos.length ? `Crear turno fijo y saltear ${conflictos.length} ${conflictos.length === 1 ? "fecha" : "fechas"}` : "Crear turno fijo"}
      </Boton>
    </form>
  );
}
