import { Suspense } from "react";
import { PanelReservas } from "@/components/admin/PanelReservas";
import { COLUMNAS_RESERVA, exigirAdmin, rangoDelDia, type ReservaConCancha } from "@/lib/datos-admin";
import { esFechaISO } from "@/lib/tiempo";

export const metadata = { title: "Reservas" };

export default function PaginaReservas({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-superficie" aria-busy="true" />}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const { supabase } = await exigirAdmin();
  const sp = await searchParams;
  const { data: hoy } = await supabase.rpc("hoy_local");
  const fecha = esFechaISO(sp.fecha) ? sp.fecha : (hoy as string);
  const { desde, hasta } = rangoDelDia(fecha);
  const ahora = new Date();

  const [pendientes, delDia, fallidas] = await Promise.all([
    supabase
      .from("reservas")
      .select(COLUMNAS_RESERVA)
      .eq("estado", "pendiente_pago")
      .gt("vence_en", ahora.toISOString())
      .order("vence_en"),
    supabase
      .from("reservas")
      .select(COLUMNAS_RESERVA)
      .neq("estado", "pendiente_pago")
      .gte("inicio", desde)
      .lt("inicio", hasta)
      .order("inicio")
      .order("cancha_id"),
    supabase.from("notificaciones").select("id", { count: "exact", head: true }).eq("estado", "fallida"),
  ]);

  return (
    <PanelReservas
      fecha={fecha}
      hoy={hoy as string}
      pendientes={(pendientes.data ?? []) as ReservaConCancha[]}
      delDia={(delDia.data ?? []) as ReservaConCancha[]}
      mailsFallidos={fallidas.count ?? 0}
      ahora={ahora.getTime()}
    />
  );
}
