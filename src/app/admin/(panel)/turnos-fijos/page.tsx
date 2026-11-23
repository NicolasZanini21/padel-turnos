import Link from "next/link";
import { Suspense } from "react";
import { clasesBoton } from "@/components/ui";
import { telefonoLegible } from "@/lib/contacto";
import { exigirAdmin } from "@/lib/datos-admin";
import { capitalizar, diaLargo, hora } from "@/lib/tiempo";

export const metadata = { title: "Turnos fijos" };

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function PaginaTurnosFijos() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-superficie" aria-busy="true" />}>
      <Lista />
    </Suspense>
  );
}

type Fijo = {
  id: number;
  dia_semana: number;
  hora_inicio: string;
  nombre: string;
  telefono: string;
  vigente_hasta: string | null;
  canchas: { nombre: string } | null;
};

async function Lista() {
  const { supabase } = await exigirAdmin();
  const { data: hoy } = await supabase.rpc("hoy_local");
  const ahora = new Date().toISOString();

  const [fijos, proximas, conflictos] = await Promise.all([
    supabase
      .from("turnos_fijos")
      .select("id, dia_semana, hora_inicio, nombre, telefono, vigente_hasta, canchas(nombre)")
      .is("dado_de_baja_en", null)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
      .order("dia_semana")
      .order("hora_inicio"),
    supabase
      .from("reservas")
      .select("turno_fijo_id, inicio")
      .eq("origen", "fijo")
      .eq("estado", "confirmada")
      .gt("inicio", ahora)
      .order("inicio"),
    supabase
      .from("turno_fijo_excepciones")
      .select("turno_fijo_id, fecha")
      .eq("tipo", "conflicto")
      .gte("fecha", hoy as string),
  ]);

  const proxima = new Map<number, string>();
  for (const r of proximas.data ?? []) if (!proxima.has(r.turno_fijo_id)) proxima.set(r.turno_fijo_id, r.inicio);
  const lista = (fijos.data ?? []) as unknown as Fijo[];
  const nConflictos = conflictos.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-titulo text-2xl font-extrabold">Turnos fijos</h1>
        <Link href="/admin/turnos-fijos/nuevo" className={clasesBoton("primario")}>
          Nuevo turno fijo
        </Link>
      </div>

      {nConflictos > 0 ? (
        <p role="alert" className="rounded-xl border border-estado-pendiente/60 bg-estado-pendiente/10 p-3 text-sm">
          Hay {nConflictos} {nConflictos === 1 ? "fecha" : "fechas"} de turnos fijos que no se generaron porque ya había otra reserva.
          Revisalas en el detalle de cada turno.
        </p>
      ) : null}

      {lista.length === 0 ? (
        <p className="rounded-2xl border border-borde bg-superficie p-6 text-texto-suave">
          Todavía no hay turnos fijos. Un turno fijo reserva la misma cancha todas las semanas, así la web nunca la ofrece ese día.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-borde bg-superficie">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-texto-suave">
                <th className="px-4 py-3 font-medium">Día y hora</th>
                <th className="px-4 py-3 font-medium">Cancha</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Próxima fecha</th>
                <th className="px-4 py-3 font-medium"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((f) => {
                const enConflicto = conflictos.data?.some((c) => c.turno_fijo_id === f.id);
                const p = proxima.get(f.id);
                return (
                  <tr key={f.id} className="border-b border-borde last:border-0">
                    <td className="px-4 py-3 font-semibold">
                      {DIAS[f.dia_semana]} {f.hora_inicio.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3">{f.canchas?.nombre}</td>
                    <td className="px-4 py-3">
                      {f.nombre}
                      <span className="block text-xs text-texto-suave">{telefonoLegible(f.telefono)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {p ? `${capitalizar(diaLargo(p))}, ${hora(p)}` : <span className="text-texto-suave">—</span>}
                      {enConflicto ? <span className="block text-xs font-semibold text-estado-pendiente">Tiene fechas en conflicto</span> : null}
                      {f.vigente_hasta ? <span className="block text-xs text-texto-suave">Hasta el {f.vigente_hasta}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/turnos-fijos/${f.id}`} className="text-acento underline-offset-4 hover:underline">
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
