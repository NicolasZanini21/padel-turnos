"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Turno } from "@/lib/tipos";
import { capitalizar, diaLargoDeFecha, hora, precio } from "@/lib/tiempo";
import { FormularioReserva } from "./FormularioReserva";

const REFRESCO_MS = 30_000;

export function Grilla({ fecha, turnosIniciales }: { fecha: string; turnosIniciales: Turno[] }) {
  const [turnos, setTurnos] = useState(turnosIniciales);
  const [elegido, setElegido] = useState<Turno | null>(null);

  const refrescar = useCallback(async () => {
    try {
      const res = await fetch(`/api/disponibilidad?fecha=${fecha}`, { cache: "no-store" });
      if (res.ok) setTurnos(((await res.json()) as { turnos: Turno[] }).turnos);
    } catch {
      // sin conexión: se mantiene lo último que se vio
    }
  }, [fecha]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refrescar();
    }, REFRESCO_MS);
    const alVolver = () => document.visibilityState === "visible" && refrescar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [refrescar]);

  const { canchas, filas } = useMemo(() => {
    const canchas = new Map<number, string>();
    const filas = new Map<string, Map<number, Turno>>();
    for (const t of turnos) {
      canchas.set(t.cancha_id, t.cancha);
      if (!filas.has(t.inicio)) filas.set(t.inicio, new Map());
      filas.get(t.inicio)!.set(t.cancha_id, t);
    }
    return {
      canchas: [...canchas.entries()],
      filas: [...filas.entries()].sort(([a], [b]) => a.localeCompare(b)),
    };
  }, [turnos]);

  const libres = turnos.filter((t) => t.estado === "libre").length;

  return (
    <section aria-labelledby="titulo-grilla">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 id="titulo-grilla" className="font-titulo text-lg font-bold">
          {capitalizar(diaLargoDeFecha(fecha))}
        </h2>
        <p className="text-sm whitespace-nowrap text-texto-suave" aria-live="polite">
          {filas.length === 0 ? "" : libres === 0 ? "Sin turnos libres" : `${libres} turnos libres`}
        </p>
      </div>

      {filas.length === 0 ? (
        <p className="rounded-2xl border border-borde bg-superficie p-6 text-center text-texto-suave">
          El club no abre este día. Probá con otra fecha.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-borde bg-superficie">
          <table className="w-full table-fixed border-collapse text-sm">
            <caption className="sr-only">Turnos por horario y cancha. Tocá un turno libre para reservarlo.</caption>
            <thead>
              <tr className="border-b border-borde text-texto-suave">
                <th scope="col" className="w-16 px-2 py-2 text-left font-medium sm:w-24 sm:px-3">
                  Hora
                </th>
                {canchas.map(([id, nombre]) => (
                  <th key={id} scope="col" className="px-1 py-2 font-medium">
                    <span className="sm:hidden">{nombre.replace("Cancha ", "C")}</span>
                    <span className="hidden sm:inline">{nombre}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map(([inicio, porCancha]) => {
                const algun = porCancha.values().next().value!;
                return (
                  <tr key={inicio} className="border-b border-borde last:border-0">
                    <th scope="row" className="px-2 py-1.5 text-left align-middle sm:px-3">
                      <span className="block font-semibold tabular-nums">{hora(inicio)}</span>
                      <span className="block text-xs font-normal text-texto-suave tabular-nums">{hora(algun.fin)}</span>
                    </th>
                    {canchas.map(([id, nombre]) => {
                      const t = porCancha.get(id);
                      return (
                        <td key={id} className="p-1">
                          {t ? <Celda turno={t} alElegir={() => setElegido(t)} cancha={nombre} /> : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {elegido ? (
        <FormularioReserva
          turno={elegido}
          alCerrar={() => setElegido(null)}
          alOcupado={() => {
            setElegido(null);
            refrescar();
          }}
        />
      ) : null}
    </section>
  );
}

function Celda({ turno, cancha, alElegir }: { turno: Turno; cancha: string; alElegir: () => void }) {
  const etiqueta = `${cancha}, ${hora(turno.inicio)} a ${hora(turno.fin)}`;
  if (turno.estado === "libre") {
    const p = precio(turno.precio_ars);
    return (
      <button
        type="button"
        onClick={alElegir}
        aria-label={`Reservar ${etiqueta}${p ? `, ${p}` : ""}`}
        className="flex min-h-11 w-full flex-col items-center justify-center rounded-lg border border-primario/70 bg-primario/10 px-1 py-1 font-semibold text-primario transition-colors hover:bg-primario hover:text-sobre-primario"
      >
        Libre
        {p ? <span className="text-[11px] font-normal">{p}</span> : null}
      </button>
    );
  }
  return (
    <div
      aria-label={`${etiqueta}: ${turno.estado === "ocupado" ? "ocupado" : "no disponible"}`}
      className="flex min-h-11 w-full items-center justify-center rounded-lg bg-superficie-2 px-1 text-xs text-noche-400 line-through"
    >
      {turno.estado === "ocupado" ? "Ocupado" : "—"}
    </div>
  );
}
