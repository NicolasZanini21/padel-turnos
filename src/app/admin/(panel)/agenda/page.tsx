import { Suspense } from "react";
import { Agenda, type Bloqueo, type Slot } from "@/components/admin/Agenda";
import { COLUMNAS_RESERVA, exigirAdmin, rangoDelDia, type ReservaConCancha } from "@/lib/datos-admin";
import { esFechaISO } from "@/lib/tiempo";

export const metadata = { title: "Agenda" };

export default function PaginaAgenda({ searchParams }: PageProps<"/admin/agenda">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-superficie" aria-busy="true" />}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/admin/agenda">["searchParams"] }) {
  const { supabase } = await exigirAdmin();
  const sp = await searchParams;
  const { data: hoy } = await supabase.rpc("hoy_local");
  const fecha = esFechaISO(sp.fecha) ? sp.fecha : (hoy as string);
  const { desde, hasta } = rangoDelDia(fecha);
  const ahora = new Date();

  const [slots, canchas, reservas, bloqueos, especial] = await Promise.all([
    supabase.rpc("slots_del_dia", { p_fecha: fecha }),
    supabase.from("canchas").select("id, nombre, activa").order("orden"),
    supabase
      .from("reservas")
      .select(COLUMNAS_RESERVA)
      .in("estado", ["pendiente_pago", "confirmada"])
      .lt("inicio", hasta)
      .gt("fin", desde)
      .order("inicio"),
    supabase
      .from("bloqueos")
      .select("id, cancha_id, rango, motivo")
      .overlaps("rango", `[${desde},${hasta})`)
      .order("id"),
    supabase.from("dias_especiales").select("cerrado, motivo").eq("fecha", fecha).maybeSingle(),
  ]);

  // Las pendientes vencidas que el job todavía no pasó a "vencida" ya no ocupan el turno
  const activas = ((reservas.data ?? []) as ReservaConCancha[]).filter(
    (r) => r.estado === "confirmada" || (r.vence_en && new Date(r.vence_en) > ahora),
  );

  return (
    <Agenda
      fecha={fecha}
      hoy={hoy as string}
      ahora={ahora.getTime()}
      slots={(slots.data ?? []) as Slot[]}
      canchas={(canchas.data ?? []).filter((c) => c.activa) as { id: number; nombre: string }[]}
      reservas={activas}
      bloqueos={(bloqueos.data ?? []) as Bloqueo[]}
      diaEspecial={especial.data as { cerrado: boolean; motivo: string | null } | null}
    />
  );
}
