import { Suspense } from "react";
import { FormTurnoFijo } from "@/components/admin/FormTurnoFijo";
import { exigirAdmin } from "@/lib/datos-admin";

export const metadata = { title: "Nuevo turno fijo" };

export default function PaginaNuevoFijo() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-superficie" aria-busy="true" />}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const { supabase } = await exigirAdmin();
  const [{ data: canchas }, { data: franjas }, { data: hoy }] = await Promise.all([
    supabase.from("canchas").select("id, nombre").eq("activa", true).order("orden"),
    supabase.from("franjas_semanales").select("dia_semana, apertura, cierre, duracion_turno").order("dia_semana"),
    supabase.rpc("hoy_local"),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-titulo text-2xl font-extrabold">Nuevo turno fijo</h1>
      <FormTurnoFijo
        canchas={(canchas ?? []) as { id: number; nombre: string }[]}
        franjas={(franjas ?? []) as { dia_semana: number; apertura: string; cierre: string; duracion_turno: string }[]}
        hoy={hoy as string}
      />
    </div>
  );
}
