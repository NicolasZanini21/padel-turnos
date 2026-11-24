"use client";

import { useActionState } from "react";
import { guardarParametros } from "@/app/admin/acciones-config";
import type { Resultado } from "@/app/admin/acciones";
import { Boton, Campo } from "@/components/ui";
import { Aviso, Seccion } from "./comun";

type Valores = {
  whatsapp_numero: string;
  ventana_gracia_minutos: number;
  dias_max_anticipacion: number;
  limite_cancelacion_horas: number;
  max_pendientes_por_telefono: number;
};

export function ConfigParametros({ valores }: { valores: Valores }) {
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(guardarParametros, {});
  return (
    <Seccion titulo="Reglas de reserva y contacto">
      <form action={accion} className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="WhatsApp del club"
          nombre="whatsapp_numero"
          inputMode="numeric"
          defaultValue={valores.whatsapp_numero}
          ayuda="Con código de país y sin el 15. Ej: 5493415551234. Lo usa el botón de WhatsApp de la web."
          required
        />
        <Campo
          etiqueta="Tiempo para pagar la seña (minutos)"
          nombre="ventana_gracia_minutos"
          type="number"
          min={15}
          step={15}
          defaultValue={valores.ventana_gracia_minutos}
          ayuda="Si no se confirma en ese tiempo, la reserva vence y el turno se libera."
          required
        />
        <Campo
          etiqueta="Días de anticipación para reservar"
          nombre="dias_max_anticipacion"
          type="number"
          min={1}
          max={90}
          defaultValue={valores.dias_max_anticipacion}
          required
        />
        <Campo
          etiqueta="Cancelación online hasta (horas antes)"
          nombre="limite_cancelacion_horas"
          type="number"
          min={0}
          max={72}
          step={0.5}
          defaultValue={valores.limite_cancelacion_horas}
          ayuda="Después de eso, tienen que escribir al club."
          required
        />
        <Campo
          etiqueta="Máximo de reservas sin pagar por teléfono"
          nombre="max_pendientes_por_telefono"
          type="number"
          min={1}
          max={10}
          defaultValue={valores.max_pendientes_por_telefono}
          required
        />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Boton type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar reglas"}
          </Boton>
          <Aviso resultado={estado} />
        </div>
      </form>
    </Seccion>
  );
}
