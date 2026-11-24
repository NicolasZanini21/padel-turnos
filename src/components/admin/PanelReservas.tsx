"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  confirmarReserva,
  reactivarReserva,
  rechazarReserva,
  type Resultado,
} from "@/app/admin/acciones";
import { Boton, EtiquetaEstado } from "@/components/ui";
import { telefonoLegible } from "@/lib/contacto";
import type { ReservaConCancha } from "@/lib/datos-admin";
import { capitalizar, diaLargo, diaLargoDeFecha, hora, sumarDias } from "@/lib/tiempo";
import { sonarAviso, useRealtimeReservas } from "./useRealtimeReservas";

const ORIGEN: Record<string, string> = { web: "Web", admin: "Manual", fijo: "Fijo" };

export function PanelReservas({
  fecha,
  hoy,
  pendientes,
  delDia,
  mailsFallidos,
  ahora,
}: {
  fecha: string;
  hoy: string;
  pendientes: ReservaConCancha[];
  delDia: ReservaConCancha[];
  mailsFallidos: number;
  ahora: number;
}) {
  const router = useRouter();
  const [sonido, setSonido] = useState(true);
  const [nuevas, setNuevas] = useState<string[]>([]);

  const conexion = useRealtimeReservas((fila) => {
    setNuevas((n) => [...n, fila.id]);
    if (sonido) sonarAviso();
  });

  const confirmadas = delDia.filter((r) => r.estado === "confirmada");
  const otras = delDia.filter((r) => r.estado !== "confirmada");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-titulo text-2xl font-extrabold">Reservas</h1>
        <div className="flex items-center gap-3 text-sm">
          <span
            className={`inline-flex items-center gap-1.5 ${conexion === "en_vivo" ? "text-estado-confirmada" : "text-texto-suave"}`}
            role="status"
          >
            <span
              aria-hidden
              className={`size-2 rounded-full ${conexion === "en_vivo" ? "bg-estado-confirmada" : conexion === "conectando" ? "bg-estado-pendiente" : "bg-error"}`}
            />
            {conexion === "en_vivo" ? "En vivo" : conexion === "conectando" ? "Conectando…" : "Sin conexión en vivo"}
          </span>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-texto-suave">
            <input type="checkbox" checked={sonido} onChange={(e) => setSonido(e.target.checked)} className="size-4 accent-primario" />
            Sonido
          </label>
        </div>
      </div>

      {mailsFallidos > 0 ? (
        <p role="alert" className="rounded-xl border border-error/60 bg-error/10 p-3 text-sm text-error">
          Hay {mailsFallidos} {mailsFallidos === 1 ? "mail que no se pudo" : "mails que no se pudieron"} mandar después de 5 intentos.
          Revisá la configuración de Resend.
        </p>
      ) : null}

      <section aria-labelledby="t-pendientes">
        <h2 id="t-pendientes" className="mb-3 flex items-center gap-2 font-titulo text-lg font-bold">
          Pendientes de pago
          <span className="rounded-full bg-estado-pendiente px-2 py-0.5 text-sm text-sobre-primario">{pendientes.length}</span>
        </h2>
        {pendientes.length === 0 ? (
          <p className="rounded-2xl border border-borde bg-superficie p-5 text-texto-suave">
            No hay reservas esperando pago. Las nuevas aparecen acá solas.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendientes.map((r) => (
              <FilaReserva key={r.id} r={r} ahora={ahora} nueva={nuevas.includes(r.id)} mostrarDia />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-dia">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="t-dia" className="font-titulo text-lg font-bold">
            {fecha === hoy ? "Hoy, " : ""}
            {diaLargoDeFecha(fecha)}
          </h2>
          <div className="flex items-center gap-2">
            <Link href={`/admin?fecha=${sumarDias(fecha, -1)}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-borde-control hover:bg-superficie-2" aria-label="Día anterior">
              ‹
            </Link>
            <input
              type="date"
              value={fecha}
              onChange={(e) => e.target.value && router.push(`/admin?fecha=${e.target.value}`)}
              className="min-h-11 rounded-lg border border-borde-control bg-superficie-2 px-3"
              aria-label="Elegir día"
            />
            <Link href={`/admin?fecha=${sumarDias(fecha, 1)}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-borde-control hover:bg-superficie-2" aria-label="Día siguiente">
              ›
            </Link>
            {fecha !== hoy ? (
              <Link href="/admin" className="min-h-11 rounded-lg px-3 py-2.5 text-sm text-acento">
                Hoy
              </Link>
            ) : null}
          </div>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-texto-suave">Confirmadas ({confirmadas.length})</h3>
        {confirmadas.length === 0 ? (
          <p className="mb-6 text-sm text-texto-suave">Sin reservas confirmadas este día.</p>
        ) : (
          <ul className="mb-6 space-y-2">
            {confirmadas.map((r) => (
              <FilaReserva key={r.id} r={r} ahora={ahora} nueva={nuevas.includes(r.id)} />
            ))}
          </ul>
        )}

        {otras.length > 0 ? (
          <details className="rounded-2xl border border-borde bg-superficie">
            <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-texto-suave">
              Canceladas y vencidas ({otras.length})
            </summary>
            <ul className="space-y-2 p-2">
              {otras.map((r) => (
                <FilaReserva key={r.id} r={r} ahora={ahora} />
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  );
}

function FilaReserva({
  r,
  ahora,
  nueva = false,
  mostrarDia = false,
}: {
  r: ReservaConCancha;
  ahora: number;
  nueva?: boolean;
  mostrarDia?: boolean;
}) {
  const futura = new Date(r.inicio).getTime() > ahora;
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<Resultado>({});
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const correr = (f: () => Promise<Resultado>) =>
    iniciar(async () => {
      setResultado(await f());
    });

  const telLimpio = r.telefono.replace("+", "");

  return (
    <li
      className={`rounded-2xl border bg-superficie p-4 transition-colors ${
        nueva ? "border-primario shadow-[0_0_0_1px_var(--color-primario)]" : "border-borde"
      } ${r.estado === "cancelada" || r.estado === "vencida" ? "opacity-75" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">
            <span className="tabular-nums">
              {hora(r.inicio)}–{hora(r.fin)}
            </span>{" "}
            · {r.canchas?.nombre}
            {mostrarDia ? <span className="font-normal text-texto-suave"> · {capitalizar(diaLargo(r.inicio))}</span> : null}
          </p>
          <p className="text-sm">
            {r.nombre}
            {" · "}
            <a href={`https://wa.me/${telLimpio}`} className="-my-2 inline-block py-2 text-acento underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
              {telefonoLegible(r.telefono)}
            </a>
            {r.email ? <span className="text-texto-suave"> · {r.email}</span> : null}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <EtiquetaEstado estado={r.estado} />
            <span className={`rounded-full border px-2 py-0.5 ${r.origen === "fijo" ? "border-acento text-acento" : "border-borde-control text-texto-suave"}`}>
              {ORIGEN[r.origen]}
            </span>
            {nueva ? <span className="font-semibold text-primario">Nueva</span> : null}
            {r.estado === "pendiente_pago" && r.vence_en ? <Vence en={r.vence_en} /> : null}
            {r.motivo_cancelacion ? <span className="text-texto-suave">Motivo: {r.motivo_cancelacion}</span> : null}
          </div>
          {r.notas_admin ? <p className="text-xs text-texto-suave">Nota: {r.notas_admin}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {r.estado === "pendiente_pago" && !rechazando ? (
            <>
              <Boton onClick={() => correr(() => confirmarReserva(r.id))} disabled={pendiente}>
                Confirmar pago
              </Boton>
              <Boton variante="fantasma" onClick={() => setRechazando(true)} disabled={pendiente}>
                Rechazar
              </Boton>
            </>
          ) : null}
          {r.estado === "confirmada" && futura && !rechazando ? (
            <Boton variante="fantasma" onClick={() => setRechazando(true)} disabled={pendiente}>
              Cancelar
            </Boton>
          ) : null}
          {r.estado === "vencida" && futura ? (
            <Boton variante="secundario" onClick={() => correr(() => reactivarReserva(r.id))} disabled={pendiente}>
              Pagó tarde: confirmar
            </Boton>
          ) : null}
        </div>
      </div>

      {rechazando ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-borde pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            correr(() => rechazarReserva(r.id, motivo));
          }}
        >
          <label className="min-w-48 flex-1">
            <span className="mb-1 block text-sm">Motivo (le llega en el mail)</span>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: no se recibió el pago"
              className="min-h-11 w-full rounded-lg border border-borde-control bg-superficie-2 px-3"
              autoFocus
            />
          </label>
          <Boton type="submit" variante="peligro" disabled={pendiente}>
            {r.estado === "pendiente_pago" ? "Rechazar reserva" : "Cancelar reserva"}
          </Boton>
          <Boton type="button" variante="fantasma" onClick={() => setRechazando(false)}>
            Volver
          </Boton>
        </form>
      ) : null}

      {resultado.error ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {resultado.error}
        </p>
      ) : null}
    </li>
  );
}

function Vence({ en }: { en: string }) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setAhora(Date.now());
    const primero = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(primero);
      clearInterval(id);
    };
  }, []);
  if (ahora === null) return null;
  const min = Math.max(0, Math.round((new Date(en).getTime() - ahora) / 60000));
  const texto = min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
  return <span className={min <= 15 ? "font-semibold text-error" : "text-estado-pendiente"}>Vence en {texto}</span>;
}
