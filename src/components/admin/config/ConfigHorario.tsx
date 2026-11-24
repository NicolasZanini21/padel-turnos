"use client";

import { useState, useTransition } from "react";
import { guardarHorarioSemanal, type FranjaEditable } from "@/app/admin/acciones-config";
import type { Resultado } from "@/app/admin/acciones";
import { Boton } from "@/components/ui";
import { Aviso, DIAS, DURACIONES, Seccion, claseControl, duracionLegible, turnosDeFranja } from "./comun";

type Fila = FranjaEditable & { clave: number };

let siguienteClave = 0;
const conClave = (f: FranjaEditable): Fila => ({ ...f, clave: siguienteClave++ });

export function ConfigHorario({ franjas }: { franjas: FranjaEditable[] }) {
  const [filas, setFilas] = useState<Fila[]>(() => franjas.map(conClave));
  const [cambios, setCambios] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [guardando, iniciar] = useTransition();

  const editar = (nuevas: Fila[]) => {
    setFilas(nuevas);
    setCambios(true);
    setResultado(null);
  };
  const cambiar = (clave: number, campo: Partial<FranjaEditable>) =>
    editar(filas.map((f) => (f.clave === clave ? { ...f, ...campo } : f)));

  const agregar = (dia: number) => {
    const ultima = filas.filter((f) => f.dia_semana === dia).at(-1) ?? filas.at(-1);
    editar([
      ...filas,
      conClave({
        dia_semana: dia,
        apertura: ultima?.apertura ?? "08:00",
        cierre: ultima?.cierre ?? "23:30",
        duracion_minutos: ultima?.duracion_minutos ?? 90,
        precio_ars: ultima?.precio_ars ?? null,
      }),
    ]);
  };

  const copiarATodos = (dia: number) => {
    const modelo = filas.filter((f) => f.dia_semana === dia);
    const destino = dia <= 5 ? [1, 2, 3, 4, 5] : [6, 7];
    editar([
      ...filas.filter((f) => !destino.includes(f.dia_semana) || f.dia_semana === dia),
      ...destino.filter((d) => d !== dia).flatMap((d) => modelo.map((m) => conClave({ ...m, dia_semana: d }))),
    ]);
  };

  const guardar = () =>
    iniciar(async () => {
      const r = await guardarHorarioSemanal(filas.map((f) => ({ dia_semana: f.dia_semana, apertura: f.apertura, cierre: f.cierre, duracion_minutos: f.duracion_minutos, precio_ars: f.precio_ars })));
      setResultado(r);
      if (r.ok) setCambios(false);
    });

  return (
    <Seccion
      titulo="Horario semanal"
      descripcion="De qué hora a qué hora se puede reservar cada día, cuánto dura cada turno y cuánto sale. Si cierra después de medianoche, poné la hora igual (por ejemplo 00:30)."
    >
      <div className="divide-y divide-borde">
        {[1, 2, 3, 4, 5, 6, 7].map((dia) => {
          const delDia = filas.filter((f) => f.dia_semana === dia);
          return (
            <div key={dia} className="py-4 first:pt-0" role="group" aria-label={DIAS[dia]}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold sm:w-28">{DIAS[dia]}</h3>
                {!delDia.length ? <span className="text-sm text-estado-cancelada">Cerrado</span> : null}
                <div className="-mx-3 flex w-full flex-wrap gap-1 sm:mx-0 sm:ml-auto sm:w-auto">
                  {delDia.length ? (
                    <button type="button" onClick={() => copiarATodos(dia)} className="min-h-11 rounded-lg px-3 text-sm text-acento hover:bg-superficie-2">
                      Copiar a {dia <= 5 ? "lun a vie" : "sáb y dom"}
                    </button>
                  ) : null}
                  <button type="button" onClick={() => agregar(dia)} className="min-h-11 rounded-lg px-3 text-sm text-acento hover:bg-superficie-2">
                    {delDia.length ? "+ Otro horario" : "+ Abrir este día"}
                  </button>
                </div>
              </div>
              {delDia.map((f) => {
                const turnos = turnosDeFranja(f.apertura, f.cierre, f.duracion_minutos);
                return (
                  <div key={f.clave} className="mt-2 grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_1.2fr_auto]">
                    <label className="block">
                      <span className="mb-1 block text-xs text-texto-suave">Abre</span>
                      <input type="time" step={1800} value={f.apertura} onChange={(e) => cambiar(f.clave, { apertura: e.target.value })} className={claseControl} required />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-texto-suave">Cierra</span>
                      <input type="time" step={1800} value={f.cierre} onChange={(e) => cambiar(f.clave, { cierre: e.target.value })} className={claseControl} required />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-texto-suave">Turno</span>
                      <select value={f.duracion_minutos} onChange={(e) => cambiar(f.clave, { duracion_minutos: Number(e.target.value) })} className={claseControl}>
                        {[...new Set([...DURACIONES, f.duracion_minutos])].sort((a, b) => a - b).map((d) => (
                          <option key={d} value={d}>{duracionLegible(d)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-texto-suave">Precio por turno ($)</span>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        inputMode="numeric"
                        placeholder="A confirmar"
                        value={f.precio_ars ?? ""}
                        onChange={(e) => cambiar(f.clave, { precio_ars: e.target.value === "" ? null : Number(e.target.value) })}
                        className={claseControl}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => editar(filas.filter((x) => x.clave !== f.clave))}
                      className="min-h-11 justify-self-start rounded-lg px-3 text-sm text-error hover:bg-error/10 sm:justify-self-auto"
                      aria-label={`Quitar horario de ${f.apertura} a ${f.cierre} del ${DIAS[dia].toLowerCase()}`}
                    >
                      Quitar
                    </button>
                    <p className="col-span-full text-xs text-texto-suave">
                      {turnos.length
                        ? `${turnos.length} turnos por cancha: ${turnos[0]} a ${turnos.at(-1)} (último turno)`
                        : "Con este horario no entra ningún turno."}
                    </p>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-borde pt-4">
        <Boton type="button" onClick={guardar} disabled={guardando || !cambios}>
          {guardando ? "Guardando…" : "Guardar horario"}
        </Boton>
        {cambios && !guardando ? <span className="text-sm text-estado-pendiente">Tenés cambios sin guardar</span> : null}
        <Aviso resultado={resultado} />
      </div>
    </Seccion>
  );
}
