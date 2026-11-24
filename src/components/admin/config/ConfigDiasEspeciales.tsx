"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { contarReservasDelDia, eliminarDiaEspecial, guardarDiaEspecial } from "@/app/admin/acciones-config";
import type { Resultado } from "@/app/admin/acciones";
import { Boton } from "@/components/ui";
import { capitalizar, diaLargoDeFecha, precio } from "@/lib/tiempo";
import { Aviso, DURACIONES, Seccion, claseControl, duracionLegible, turnosDeFranja } from "./comun";

export type DiaEspecial = {
  fecha: string;
  cerrado: boolean;
  apertura: string | null;
  cierre: string | null;
  duracion_minutos: number | null;
  precio_ars: number | null;
  motivo: string | null;
};

export function ConfigDiasEspeciales({ dias, hoy }: { dias: DiaEspecial[]; hoy: string }) {
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(guardarDiaEspecial, {});
  const [fecha, setFecha] = useState("");
  const [cerrado, setCerrado] = useState(true);
  const [apertura, setApertura] = useState("08:00");
  const [cierre, setCierre] = useState("20:00");
  const [duracion, setDuracion] = useState(90);
  const [afectadas, setAfectadas] = useState<{ fecha: string; cantidad: number } | null>(null);
  const [borrando, iniciarBorrado] = useTransition();
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  // Cuántas reservas activas hay ese día, para ofrecer cancelarlas
  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    contarReservasDelDia(fecha).then((cantidad) => {
      if (vigente) setAfectadas({ fecha, cantidad });
    });
    return () => {
      vigente = false;
    };
  }, [fecha, estado]);

  const cantidad = afectadas?.fecha === fecha ? afectadas.cantidad : 0;
  const turnos = cerrado ? [] : turnosDeFranja(apertura, cierre, duracion);

  return (
    <Seccion
      titulo="Feriados y días especiales"
      descripcion="Para cerrar el club un día puntual o abrir con otro horario. Le gana al horario semanal."
    >
      {dias.length ? (
        <ul className="mb-5 divide-y divide-borde rounded-xl border border-borde">
          {dias.map((d) => (
            <li key={d.fecha} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <span className="font-semibold">{capitalizar(diaLargoDeFecha(d.fecha))}</span>
              <span className={`text-sm ${d.cerrado ? "text-estado-cancelada" : "text-texto-suave"}`}>
                {d.cerrado
                  ? "Cerrado"
                  : `${d.apertura} a ${d.cierre} · turnos de ${duracionLegible(d.duracion_minutos ?? 0)}${d.precio_ars !== null ? ` · ${precio(d.precio_ars)}` : ""}`}
              </span>
              {d.motivo ? <span className="text-sm text-texto-suave">· {d.motivo}</span> : null}
              <button
                type="button"
                disabled={borrando}
                onClick={() =>
                  iniciarBorrado(async () => {
                    const r = await eliminarDiaEspecial(d.fecha);
                    setErrorBorrar(r.error ?? null);
                  })
                }
                className="ml-auto min-h-11 rounded-lg px-3 text-sm text-error hover:bg-error/10"
                aria-label={`Quitar día especial del ${diaLargoDeFecha(d.fecha)}`}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-sm text-texto-suave">No hay días especiales cargados.</p>
      )}
      {errorBorrar ? <p role="alert" className="mb-4 text-sm text-error">{errorBorrar}</p> : null}

      <form action={accion} className="grid gap-4 rounded-xl border border-dashed border-borde-control p-4 sm:grid-cols-2">
        <h3 className="font-semibold sm:col-span-2">Agregar un día</h3>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Fecha</span>
          <input type="date" name="fecha" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseControl} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Motivo (opcional)</span>
          <input name="motivo" maxLength={120} placeholder="Ej: Navidad, torneo, mantenimiento" className={claseControl} />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">Ese día el club…</legend>
          <div className="flex flex-wrap gap-2">
            {[
              { v: "si", t: "Está cerrado" },
              { v: "no", t: "Abre con otro horario" },
            ].map((o) => (
              <label key={o.v} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-borde-control px-3 has-checked:border-primario has-checked:text-primario">
                <input type="radio" name="cerrado" value={o.v} checked={cerrado === (o.v === "si")} onChange={() => setCerrado(o.v === "si")} className="accent-lima-400" />
                {o.t}
              </label>
            ))}
          </div>
        </fieldset>

        {!cerrado ? (
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs text-texto-suave">Abre</span>
              <input type="time" name="apertura" step={1800} value={apertura} onChange={(e) => setApertura(e.target.value)} className={claseControl} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-texto-suave">Cierra</span>
              <input type="time" name="cierre" step={1800} value={cierre} onChange={(e) => setCierre(e.target.value)} className={claseControl} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-texto-suave">Turno</span>
              <select name="duracion_minutos" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} className={claseControl}>
                {DURACIONES.map((d) => <option key={d} value={d}>{duracionLegible(d)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-texto-suave">Precio ($)</span>
              <input type="number" name="precio_ars" min={0} step={500} inputMode="numeric" placeholder="A confirmar" className={claseControl} />
            </label>
            <p className="col-span-full text-xs text-texto-suave">
              {turnos.length ? `${turnos.length} turnos por cancha: ${turnos[0]} a ${turnos.at(-1)}` : "Con este horario no entra ningún turno."}
            </p>
          </div>
        ) : null}

        {fecha && cantidad > 0 ? (
          <div className="rounded-lg border border-estado-pendiente/60 bg-estado-pendiente/10 p-3 text-sm sm:col-span-2">
            <p>
              Ese día hay <strong>{cantidad} {cantidad === 1 ? "reserva activa" : "reservas activas"}</strong>.
              {cerrado ? "" : " Si cambiás el horario, revisalas a mano en Reservas."}
            </p>
            {cerrado ? (
              <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2">
                <input type="checkbox" name="cancelar_reservas" value="si" className="size-5 accent-lima-400" />
                Cancelarlas y avisarles por mail
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Boton type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar día"}
          </Boton>
          <Aviso resultado={estado} />
        </div>
      </form>
    </Seccion>
  );
}
