import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DetalleTurnoFijo, type FechaFija, type TurnoFijo } from "@/components/admin/DetalleTurnoFijo";
import { exigirAdmin } from "@/lib/datos-admin";
import { fechaLocal, sumarDias } from "@/lib/tiempo";

export const metadata = { title: "Turno fijo" };

export default function PaginaFijo(props: PageProps<"/admin/turnos-fijos/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-superficie" aria-busy="true" />}>
      <Contenido {...props} />
    </Suspense>
  );
}

async function Contenido({ params, searchParams }: PageProps<"/admin/turnos-fijos/[id]">) {
  const { supabase } = await exigirAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();

  const { data: tf } = await supabase.from("turnos_fijos").select("*, canchas(nombre)").eq("id", idNum).maybeSingle();
  if (!tf) notFound();
  const { data: hoy } = await supabase.rpc("hoy_local");

  const [{ data: reservas }, { data: excepciones }] = await Promise.all([
    supabase
      .from("reservas")
      .select("id, inicio, estado, motivo_cancelacion")
      .eq("turno_fijo_id", idNum)
      .gte("inicio", new Date(`${hoy}T00:00:00-03:00`).toISOString())
      .order("inicio"),
    supabase.from("turno_fijo_excepciones").select("fecha, tipo, detalle, creada_en").eq("turno_fijo_id", idNum).order("fecha", { ascending: false }),
  ]);

  // Próximas 8 fechas de ese día de la semana
  const desde = (hoy as string) > tf.vigente_desde ? (hoy as string) : tf.vigente_desde;
  const dow = new Date(`${desde}T12:00:00-03:00`).getUTCDay() || 7;
  let f = sumarDias(desde, (tf.dia_semana - dow + 7) % 7);
  const fechas: FechaFija[] = [];
  for (let i = 0; i < 8 && (!tf.vigente_hasta || f <= tf.vigente_hasta); i++, f = sumarDias(f, 7)) {
    const r = (reservas ?? []).find((x) => fechaLocal(x.inicio) === f);
    const e = (excepciones ?? []).find((x) => x.fecha === f);
    fechas.push({
      fecha: f,
      reserva: r ? { estado: r.estado, motivo: r.motivo_cancelacion } : null,
      excepcion: e ? { tipo: e.tipo, detalle: e.detalle } : null,
      generada: tf.generado_hasta ? f <= tf.generado_hasta : false,
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/turnos-fijos" className="inline-flex min-h-11 items-center text-sm text-acento underline-offset-4 hover:underline">
        ← Turnos fijos
      </Link>
      {sp.creado !== undefined ? (
        <p role="status" className="rounded-xl border border-primario/60 bg-primario/10 p-3 text-sm">
          Turno fijo creado: se reservaron {String(sp.creado)} fechas
          {Number(sp.conflictos) > 0 ? ` y se saltearon ${String(sp.conflictos)} por conflicto` : ""}. Las siguientes se generan
          solas cada noche.
        </p>
      ) : null}
      <DetalleTurnoFijo
        tf={tf as unknown as TurnoFijo}
        fechas={fechas}
        historial={(excepciones ?? []) as { fecha: string; tipo: string; detalle: string | null }[]}
        hoy={hoy as string}
      />
    </div>
  );
}
