"use client";

import { useActionState, useState, useTransition } from "react";
import {
  darDeBajaTurnoFijo,
  editarContactoTurnoFijo,
  reactivarFechaFija,
  saltearFechaFija,
  type Resultado,
} from "@/app/admin/acciones";
import { Boton, Campo } from "@/components/ui";
import { capitalizar, diaLargoDeFecha, precio } from "@/lib/tiempo";

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export type TurnoFijo = {
  id: number;
  dia_semana: number;
  hora_inicio: string;
  nombre: string;
  telefono: string;
  email: string | null;
  avisos_por_mail: boolean;
  precio_ars: number | null;
  vigente_desde: string;
  vigente_hasta: string | null;
  notas: string | null;
  dado_de_baja_en: string | null;
  canchas: { nombre: string } | null;
};

export type FechaFija = {
  fecha: string;
  reserva: { estado: string; motivo: string | null } | null;
  excepcion: { tipo: string; detalle: string | null } | null;
  generada: boolean;
};

function estadoFecha(f: FechaFija): { texto: string; clase: string; accion: "saltear" | "reactivar" | null } {
  if (f.reserva?.estado === "confirmada") return { texto: "Reservada", clase: "text-estado-confirmada", accion: "saltear" };
  if (f.excepcion?.tipo === "conflicto") return { texto: "En conflicto: había otra reserva", clase: "text-estado-pendiente", accion: "reactivar" };
  if (f.excepcion?.tipo === "cierre") return { texto: "Club cerrado o bloqueado", clase: "text-texto-suave", accion: null };
  if (f.excepcion?.tipo === "salteo" || (f.reserva?.estado === "cancelada" && f.reserva.motivo === "salteo"))
    return { texto: "Salteada", clase: "text-texto-suave", accion: "reactivar" };
  if (f.reserva?.estado === "cancelada") return { texto: `Cancelada${f.reserva.motivo ? ` (${f.reserva.motivo})` : ""}`, clase: "text-estado-cancelada", accion: "reactivar" };
  if (!f.generada) return { texto: "Se reserva automáticamente más adelante", clase: "text-texto-suave", accion: "saltear" };
  return { texto: "Sin reserva", clase: "text-texto-suave", accion: "reactivar" };
}

export function DetalleTurnoFijo({
  tf,
  fechas,
  historial,
  hoy,
}: {
  tf: TurnoFijo;
  fechas: FechaFija[];
  historial: { fecha: string; tipo: string; detalle: string | null }[];
  hoy: string;
}) {
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<Resultado>({});
  const [contacto, accionContacto, guardando] = useActionState<Resultado, FormData>(editarContactoTurnoFijo.bind(null, tf.id), {});
  const [bajaDesde, setBajaDesde] = useState(hoy);
  const activo = !tf.dado_de_baja_en && (!tf.vigente_hasta || tf.vigente_hasta >= hoy);

  const correr = (f: () => Promise<Resultado>) => iniciar(async () => setResultado(await f()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-titulo text-2xl font-extrabold">
          {DIAS[tf.dia_semana]} {tf.hora_inicio.slice(0, 5)} · {tf.canchas?.nombre}
        </h1>
        <p className="text-texto-suave">
          {tf.nombre}
          {tf.precio_ars != null ? ` · ${precio(tf.precio_ars)}` : ""} · desde el {tf.vigente_desde}
          {tf.vigente_hasta ? ` hasta el ${tf.vigente_hasta}` : ""}
          {!activo ? " · Dado de baja" : ""}
        </p>
      </div>

      {resultado.error ? <p role="alert" className="rounded-xl border border-error/60 bg-error/10 p-3 text-sm text-error">{resultado.error}</p> : null}
      {resultado.mensaje ? <p role="status" className="rounded-xl border border-borde-control bg-superficie p-3 text-sm">{resultado.mensaje}</p> : null}

      <section className="rounded-2xl border border-borde bg-superficie p-5">
        <h2 className="mb-3 font-semibold">Próximas fechas</h2>
        {fechas.length === 0 ? (
          <p className="text-sm text-texto-suave">No hay fechas próximas.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {fechas.map((f) => {
              const e = estadoFecha(f);
              return (
                <li key={f.fecha} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-semibold">{capitalizar(diaLargoDeFecha(f.fecha))}</span>
                    <span className={`block text-sm ${e.clase}`}>{e.texto}</span>
                  </span>
                  {activo && e.accion === "saltear" ? (
                    <Boton variante="fantasma" disabled={pendiente} onClick={() => correr(() => saltearFechaFija(tf.id, f.fecha, ""))}>
                      Saltear esta fecha
                    </Boton>
                  ) : null}
                  {activo && e.accion === "reactivar" ? (
                    <Boton variante="secundario" disabled={pendiente} onClick={() => correr(() => reactivarFechaFija(tf.id, f.fecha))}>
                      {f.excepcion?.tipo === "conflicto" ? "Reintentar" : "Reactivar"}
                    </Boton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-texto-suave">Saltear libera la cancha ese día para la web. No se manda ningún mail.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={accionContacto} className="space-y-3 rounded-2xl border border-borde bg-superficie p-5">
          <h2 className="font-semibold">Datos de contacto</h2>
          <Campo etiqueta="Grupo o titular" nombre="nombre" defaultValue={tf.nombre} required maxLength={80} />
          <Campo etiqueta="Teléfono" nombre="telefono" type="tel" defaultValue={tf.telefono} required />
          <Campo etiqueta="Mail" nombre="email" type="email" defaultValue={tf.email ?? ""} />
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="avisos_por_mail" defaultChecked={tf.avisos_por_mail} className="size-4 accent-primario" />
            <span className="text-sm">Recordatorio por mail 5 h antes</span>
          </label>
          <Campo etiqueta="Notas" nombre="notas" defaultValue={tf.notas ?? ""} maxLength={500} />
          {contacto.error ? <p role="alert" className="text-sm text-error">{contacto.error}</p> : null}
          {contacto.mensaje ? <p role="status" className="text-sm text-texto-suave">{contacto.mensaje}</p> : null}
          <Boton type="submit" variante="secundario" disabled={guardando}>Guardar</Boton>
          <p className="text-xs text-texto-suave">Para cambiar cancha, día u hora: dalo de baja y creá uno nuevo.</p>
        </form>

        <div className="space-y-6">
          {activo ? (
            <section className="space-y-3 rounded-2xl border border-error/40 bg-superficie p-5">
              <h2 className="font-semibold">Dar de baja</h2>
              <p className="text-sm text-texto-suave">Se cancelan las fechas reservadas desde ese día en adelante y la cancha queda libre.</p>
              <Campo etiqueta="A partir del" nombre="baja" type="date" min={hoy} value={bajaDesde} onChange={(e) => setBajaDesde(e.target.value)} />
              <Boton
                variante="peligro"
                disabled={pendiente}
                onClick={() => {
                  if (confirm(`¿Dar de baja el turno fijo a partir del ${bajaDesde}?`)) correr(() => darDeBajaTurnoFijo(tf.id, bajaDesde));
                }}
              >
                Dar de baja
              </Boton>
            </section>
          ) : null}

          {historial.length ? (
            <section className="rounded-2xl border border-borde bg-superficie p-5">
              <h2 className="mb-2 font-semibold">Historial de excepciones</h2>
              <ul className="space-y-1 text-sm">
                {historial.map((h) => (
                  <li key={h.fecha}>
                    {h.fecha} · {h.tipo}
                    {h.detalle && h.tipo !== "conflicto" ? ` · ${h.detalle}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
