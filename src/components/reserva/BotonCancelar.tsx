"use client";

import { useActionState } from "react";
import { cancelarReserva } from "@/app/acciones";
import { Boton } from "@/components/ui";

export function BotonCancelar({ token }: { token: string }) {
  const [estado, accion, enviando] = useActionState(async () => cancelarReserva(token), {} as { error?: string });
  return (
    <form action={accion}>
      {estado.error ? (
        <p role="alert" className="mb-3 text-sm text-error">
          {estado.error}
        </p>
      ) : null}
      <Boton type="submit" variante="peligro" disabled={enviando} className="w-full">
        {enviando ? "Cancelando…" : "Sí, cancelar la reserva"}
      </Boton>
    </form>
  );
}
