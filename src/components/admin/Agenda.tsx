"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  crearBloqueo,
  crearReservaManual,
  eliminarBloqueo,
  type Resultado,
} from "@/app/admin/acciones";
import { Boton, Campo } from "@/components/ui";
import type { ReservaConCancha } from "@/lib/datos-admin";
import { capitalizar, diaLargoDeFecha, hora, sumarDias } from "@/lib/tiempo";
import { useRealtimeReservas } from "./useRealtimeReservas";

export type Slot = { inicio: string; fin: string; precio_ars: number | null };
export type Bloqueo = {
  id: number;
  cancha_id: number | null;
  rango: string;
  motivo: string;
};

function limitesRango(rango: string): [number, number] {
  const m = /^[[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/.exec(rango);
  if (!m) return [0, 0];
  // Postgres devuelve "2026-11-26 11:00:00+00": se pasa a ISO para que lo entienda Date
  const iso = (s: string) =>
    new Date(s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")).getTime();
  return [iso(m[1]), iso(m[2])];
}

function seSuperpone(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && b0 < a1;
}

export function Agenda({
  fecha,
  hoy,
  ahora,
  slots,
  canchas,
  reservas,
  bloqueos,
  diaEspecial,
}: {
  fecha: string;
  hoy: string;
  ahora: number;
  slots: Slot[];
  canchas: { id: number; nombre: string }[];
  reservas: ReservaConCancha[];
  bloqueos: Bloqueo[];
  diaEspecial: { cerrado: boolean; motivo: string | null } | null;
}) {
  const router = useRouter();
  const [nueva, setNueva] = useState<{
    cancha: { id: number; nombre: string };
    slot: Slot;
  } | null>(null);
  useRealtimeReservas();

  const bloqueosMs = bloqueos.map((b) => ({ ...b, ms: limitesRango(b.rango) }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-titulo text-2xl font-extrabold">
          Agenda · {fecha === hoy ? "Hoy, " : ""}
          {diaLargoDeFecha(fecha)}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/agenda?fecha=${sumarDias(fecha, -1)}`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-borde-control hover:bg-superficie-2"
            aria-label="Día anterior"
          >
            ‹
          </Link>
          <input
            type="date"
            value={fecha}
            onChange={(e) =>
              e.target.value &&
              router.push(`/admin/agenda?fecha=${e.target.value}`)
            }
            className="min-h-11 rounded-lg border border-borde-control bg-superficie-2 px-3"
            aria-label="Elegir día"
          />
          <Link
            href={`/admin/agenda?fecha=${sumarDias(fecha, 1)}`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-borde-control hover:bg-superficie-2"
            aria-label="Día siguiente"
          >
            ›
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-texto-suave">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded border-2 border-estado-confirmada" />{" "}
          Confirmada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded border-2 border-estado-pendiente" />{" "}
          Pendiente de pago
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded border-2 border-acento" /> Turno fijo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded bg-noche-700" /> Bloqueado
        </span>
      </div>

      {diaEspecial ? (
        <p className="rounded-xl border border-estado-pendiente/60 bg-estado-pendiente/10 p-3 text-sm">
          {diaEspecial.cerrado
            ? "El club está cerrado este día"
            : "Horario especial este día"}
          {diaEspecial.motivo ? `: ${diaEspecial.motivo}` : ""}.
        </p>
      ) : null}

      {slots.length === 0 ? (
        <p className="rounded-2xl border border-borde bg-superficie p-6 text-texto-suave">
          No hay turnos este día.
        </p>
      ) : (
        <>
          {canchas.length > 2 ? (
            <p className="text-sm text-texto-suave sm:hidden">
              Deslizá la tabla hacia el costado para ver todas las canchas{" "}
              <span aria-hidden>→</span>
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-2xl border border-borde bg-superficie">
            <table className="w-full min-w-[600px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-borde text-texto-suave">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 w-20 bg-superficie px-3 py-2 text-left font-medium sm:w-24"
                  >
                    Hora
                  </th>
                  {canchas.map((c) => (
                    <th
                      key={c.id}
                      scope="col"
                      className="px-2 py-2 text-left font-medium"
                    >
                      {c.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((s) => {
                  const s0 = new Date(s.inicio).getTime();
                  const s1 = new Date(s.fin).getTime();
                  return (
                    <tr
                      key={s.inicio}
                      className="border-b border-borde last:border-0"
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-superficie px-3 py-1.5 text-left align-top font-semibold tabular-nums"
                      >
                        {hora(s.inicio)}
                        <span className="block text-xs font-normal text-texto-suave">
                          {hora(s.fin)}
                        </span>
                      </th>
                      {canchas.map((c) => {
                        const r = reservas.find(
                          (x) =>
                            x.cancha_id === c.id &&
                            seSuperpone(
                              s0,
                              s1,
                              new Date(x.inicio).getTime(),
                              new Date(x.fin).getTime(),
                            ),
                        );
                        const b = bloqueosMs.find(
                          (x) =>
                            (x.cancha_id === null || x.cancha_id === c.id) &&
                            seSuperpone(s0, s1, x.ms[0], x.ms[1]),
                        );
                        return (
                          <td key={c.id} className="p-1 align-top">
                            {r ? (
                              <CeldaReserva r={r} />
                            ) : b ? (
                              <div className="min-h-11 rounded-lg bg-noche-700 px-2 py-1.5 text-xs text-texto-suave">
                                Bloqueado
                                <span className="block truncate">
                                  {b.motivo}
                                </span>
                              </div>
                            ) : s0 > ahora ? (
                              <button
                                type="button"
                                onClick={() => setNueva({ cancha: c, slot: s })}
                                className="flex min-h-11 w-full items-center justify-center rounded-lg border border-dashed border-borde-control text-xs text-texto-suave hover:border-primario hover:text-primario"
                                aria-label={`Reserva manual ${c.nombre} ${hora(s.inicio)}`}
                              >
                                + Reservar
                              </button>
                            ) : (
                              <div
                                className="min-h-11 rounded-lg bg-superficie-2/40"
                                aria-label="Libre, ya pasó"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Bloqueos fecha={fecha} canchas={canchas} bloqueos={bloqueosMs} />

      {nueva ? (
        <DialogoReservaManual {...nueva} alCerrar={() => setNueva(null)} />
      ) : null}
    </div>
  );
}

function CeldaReserva({ r }: { r: ReservaConCancha }) {
  const borde =
    r.origen === "fijo"
      ? "border-acento"
      : r.estado === "pendiente_pago"
        ? "border-estado-pendiente"
        : "border-estado-confirmada";
  const contenido = (
    <>
      <span className="block truncate font-semibold">{r.nombre}</span>
      <span className="block text-xs text-texto-suave">
        {r.origen === "fijo"
          ? "Fijo"
          : r.estado === "pendiente_pago"
            ? "Pendiente de pago"
            : r.origen === "admin"
              ? "Manual"
              : "Web"}
      </span>
    </>
  );
  const clase = `block min-h-11 rounded-lg border-l-4 ${borde} bg-superficie-2 px-2 py-1.5`;
  return r.turno_fijo_id ? (
    <Link
      href={`/admin/turnos-fijos/${r.turno_fijo_id}`}
      className={`${clase} hover:brightness-125`}
    >
      {contenido}
    </Link>
  ) : (
    <div className={clase} title={r.telefono}>
      {contenido}
    </div>
  );
}

function DialogoReservaManual({
  cancha,
  slot,
  alCerrar,
}: {
  cancha: { id: number; nombre: string };
  slot: Slot;
  alCerrar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(
    crearReservaManual,
    {},
  );
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  useEffect(() => {
    if (estado.ok) ref.current?.close();
  }, [estado.ok]);

  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-borde bg-superficie p-0 text-texto backdrop:bg-black/70"
    >
      <form action={accion} className="space-y-4 p-6">
        <h2 className="font-titulo text-xl font-bold">
          Reserva manual · {cancha.nombre} · {hora(slot.inicio)} a{" "}
          {hora(slot.fin)}
        </h2>
        <p className="text-sm text-texto-suave">
          Para quien reserva por teléfono o en el mostrador. Queda confirmada.
        </p>
        <input type="hidden" name="cancha_id" value={cancha.id} />
        <input type="hidden" name="inicio" value={slot.inicio} />
        <input type="hidden" name="fin" value={slot.fin} />
        <Campo etiqueta="Nombre" nombre="nombre" required maxLength={80} />
        <Campo
          etiqueta="Teléfono"
          nombre="telefono"
          type="tel"
          required
          placeholder="341 555 1234"
        />
        <Campo
          etiqueta="Mail (opcional)"
          nombre="email"
          type="email"
          ayuda="Si lo cargás, le llega la confirmación y el recordatorio."
        />
        <Campo
          etiqueta="Nota interna (opcional)"
          nombre="notas"
          maxLength={500}
        />
        {estado.error ? (
          <p role="alert" className="text-sm text-error">
            {estado.error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Boton type="submit" disabled={enviando} className="flex-1">
            {enviando ? "Guardando…" : "Crear reserva"}
          </Boton>
          <Boton
            type="button"
            variante="fantasma"
            onClick={() => ref.current?.close()}
          >
            Cancelar
          </Boton>
        </div>
      </form>
    </dialog>
  );
}

function Bloqueos({
  fecha,
  canchas,
  bloqueos,
}: {
  fecha: string;
  canchas: { id: number; nombre: string }[];
  bloqueos: (Bloqueo & { ms: [number, number] })[];
}) {
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(
    crearBloqueo,
    {},
  );
  const [borrando, iniciar] = useTransition();
  const fmt = (ms: number) =>
    new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(ms);

  return (
    <section aria-labelledby="t-bloqueos" className="grid gap-6 lg:grid-cols-2">
      <div>
        <h2 id="t-bloqueos" className="mb-3 font-titulo text-lg font-bold">
          Bloqueos de este día
        </h2>
        {bloqueos.length === 0 ? (
          <p className="text-sm text-texto-suave">Ninguno.</p>
        ) : (
          <ul className="space-y-2">
            {bloqueos.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-borde bg-superficie p-3 text-sm"
              >
                <span>
                  <strong>
                    {b.cancha_id
                      ? canchas.find((c) => c.id === b.cancha_id)?.nombre
                      : "Todas las canchas"}
                  </strong>{" "}
                  · {fmt(b.ms[0])} a {fmt(b.ms[1])}
                  <span className="block text-texto-suave">{b.motivo}</span>
                </span>
                <Boton
                  variante="fantasma"
                  disabled={borrando}
                  onClick={() =>
                    iniciar(async () => void (await eliminarBloqueo(b.id)))
                  }
                >
                  Quitar
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form
        action={accion}
        className="space-y-3 rounded-2xl border border-borde bg-superficie p-4"
      >
        <h3 className="font-semibold">Nuevo bloqueo</h3>
        <p className="text-sm text-texto-suave">
          Torneo, mantenimiento, clase: la web no ofrece esos turnos.
        </p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Cancha</span>
          <select
            name="cancha_id"
            className="min-h-11 w-full rounded-lg border border-borde-control bg-superficie-2 px-3"
          >
            <option value="">Todas</option>
            {canchas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etiqueta="Desde"
            nombre="desde"
            type="datetime-local"
            defaultValue={`${fecha}T08:00`}
            required
          />
          <Campo
            etiqueta="Hasta"
            nombre="hasta"
            type="datetime-local"
            defaultValue={`${fecha}T12:00`}
            required
          />
        </div>
        <Campo
          etiqueta="Motivo"
          nombre="motivo"
          required
          maxLength={200}
          placeholder="Ej.: torneo interno"
        />
        {estado.error ? (
          <p role="alert" className="text-sm text-error">
            {estado.error}
          </p>
        ) : null}
        {estado.mensaje ? (
          <p role="status" className="text-sm text-texto-suave">
            {capitalizar(estado.mensaje)}
          </p>
        ) : null}
        <Boton type="submit" variante="secundario" disabled={enviando}>
          Crear bloqueo
        </Boton>
      </form>
    </section>
  );
}
