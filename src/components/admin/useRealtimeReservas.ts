"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/navegador";

export type EstadoConexion = "conectando" | "en_vivo" | "desconectado";

/**
 * Escucha los cambios en `reservas` (Realtime respeta RLS: solo le llegan al admin)
 * y refresca los datos del servidor. Devuelve el estado de la conexión.
 */
export function useRealtimeReservas(alInsertarWeb?: (fila: { id: string; nombre: string }) => void) {
  const router = useRouter();
  const [conexion, setConexion] = useState<EstadoConexion>("conectando");
  const callback = useRef(alInsertarWeb);
  useEffect(() => {
    callback.current = alInsertarWeb;
  });

  useEffect(() => {
    const supabase = supabaseNavegador();
    let espera: ReturnType<typeof setTimeout> | undefined;
    const refrescar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => router.refresh(), 250);
    };

    let canal: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;

    // El canal tiene que abrirse con el token del admin: si se abre con la anon key,
    // Realtime aplica RLS como anónimo y manda los cambios vacíos (401).
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelado) return;
      if (!data.session) {
        setConexion("desconectado");
        return;
      }
      await supabase.realtime.setAuth(data.session.access_token);
      canal = supabase
        .channel("panel-reservas")
        .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, (cambio) => {
          const fila = cambio.new as { id?: string; nombre?: string; origen?: string };
          if (cambio.eventType === "INSERT" && fila.origen === "web" && fila.id) {
            callback.current?.({ id: fila.id, nombre: fila.nombre ?? "" });
          }
          refrescar();
        })
        .subscribe((estado) => {
          if (estado === "SUBSCRIBED") setConexion("en_vivo");
          else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") setConexion("desconectado");
        });
    })();

    // Por si se perdió algún evento mientras la pestaña estaba en segundo plano
    const alVolver = () => document.visibilityState === "visible" && refrescar();
    document.addEventListener("visibilitychange", alVolver);
    // Las pendientes que vencen desaparecen de la lista aunque no haya eventos
    const reloj = setInterval(refrescar, 60_000);

    return () => {
      clearTimeout(espera);
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", alVolver);
      cancelado = true;
      if (canal) supabase.removeChannel(canal);
    };
  }, [router]);

  return conexion;
}

/** Aviso sonoro corto (dos tonos) generado con WebAudio, sin archivos. */
export function sonarAviso() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.17);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    // el navegador no permite audio todavía (falta un clic del usuario)
  }
}
