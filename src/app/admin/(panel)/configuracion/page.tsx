import { Suspense } from "react";
import { ConfigCanchas } from "@/components/admin/config/ConfigCanchas";
import { ConfigDiasEspeciales, type DiaEspecial } from "@/components/admin/config/ConfigDiasEspeciales";
import { ConfigHorario } from "@/components/admin/config/ConfigHorario";
import { ConfigParametros } from "@/components/admin/config/ConfigParametros";
import { exigirAdmin } from "@/lib/datos-admin";
import { intervaloAMinutos } from "@/lib/tiempo";

export const metadata = { title: "Configuración" };

export default function PaginaConfiguracion() {
  return (
    <>
      <h1 className="font-titulo text-2xl font-extrabold">Configuración</h1>
      <p className="mt-1 text-texto-suave">Horarios, canchas y reglas de reserva. Los cambios se ven en la web al guardar.</p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-2xl bg-superficie" aria-busy="true" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const { supabase } = await exigirAdmin();
  const { data: hoy } = await supabase.rpc("hoy_local");
  const [config, franjas, especiales, canchas] = await Promise.all([
    supabase.from("config").select("*").single(),
    supabase.from("franjas_semanales").select("dia_semana, apertura, cierre, duracion_turno, precio_ars").order("dia_semana").order("apertura"),
    supabase.from("dias_especiales").select("*").gte("fecha", hoy).order("fecha"),
    supabase.from("canchas").select("id, nombre, activa").order("orden").order("id"),
  ]);
  const c = config.data;

  return (
    <div className="mt-6 grid gap-6">
      <ConfigHorario
        franjas={(franjas.data ?? []).map((f) => ({
          dia_semana: f.dia_semana,
          apertura: String(f.apertura).slice(0, 5),
          cierre: String(f.cierre).slice(0, 5),
          duracion_minutos: intervaloAMinutos(f.duracion_turno),
          precio_ars: f.precio_ars === null ? null : Number(f.precio_ars),
        }))}
      />
      <ConfigDiasEspeciales
        hoy={hoy as string}
        dias={(especiales.data ?? []).map(
          (d): DiaEspecial => ({
            fecha: d.fecha,
            cerrado: d.cerrado,
            apertura: d.apertura ? String(d.apertura).slice(0, 5) : null,
            cierre: d.cierre ? String(d.cierre).slice(0, 5) : null,
            duracion_minutos: d.duracion_turno ? intervaloAMinutos(d.duracion_turno) : null,
            precio_ars: d.precio_ars === null ? null : Number(d.precio_ars),
            motivo: d.motivo,
          }),
        )}
      />
      <ConfigCanchas canchas={canchas.data ?? []} />
      {c ? (
        <ConfigParametros
          valores={{
            whatsapp_numero: c.whatsapp_numero,
            ventana_gracia_minutos: intervaloAMinutos(c.ventana_gracia),
            dias_max_anticipacion: c.dias_max_anticipacion,
            limite_cancelacion_horas: intervaloAMinutos(c.limite_cancelacion_usuario) / 60,
            max_pendientes_por_telefono: c.max_pendientes_por_telefono,
          }}
        />
      ) : null}
    </div>
  );
}
