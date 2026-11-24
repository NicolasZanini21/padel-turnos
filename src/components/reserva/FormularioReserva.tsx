"use client";

import { useActionState, useEffect, useRef } from "react";
import { crearReserva, type EstadoFormReserva } from "@/app/acciones";
import { Boton, Campo } from "@/components/ui";
import type { Turno } from "@/lib/tipos";
import { capitalizar, diaLargo, hora, precio } from "@/lib/tiempo";

export function FormularioReserva({
  turno,
  alCerrar,
  alOcupado,
}: {
  turno: Turno;
  alCerrar: () => void;
  alOcupado: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, accion, enviando] = useActionState<EstadoFormReserva, FormData>(crearReserva, {});

  useEffect(() => {
    // Sin close() en el cleanup: dispararía onClose y desmontaría el formulario en StrictMode
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    if (estado.ocupado) {
      const t = setTimeout(alOcupado, 2500);
      return () => clearTimeout(t);
    }
  }, [estado.ocupado, alOcupado]);

  const p = precio(turno.precio_ars);

  return (
    <dialog
      ref={dialogo}
      onClose={alCerrar}
      aria-labelledby="titulo-form"
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl border border-borde bg-superficie p-0 text-texto backdrop:bg-black/70 sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      <form action={accion} className="space-y-4 p-5 sm:p-6" noValidate>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="titulo-form" className="font-titulo text-xl font-bold">
              {turno.cancha} · {hora(turno.inicio)} a {hora(turno.fin)}
            </h2>
            <p className="text-sm text-texto-suave">
              {capitalizar(diaLargo(turno.inicio))}
              {p ? ` · ${p}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            className="-mt-1 -mr-2 min-h-11 min-w-11 rounded-full text-2xl leading-none text-texto-suave hover:bg-superficie-2"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <input type="hidden" name="cancha_id" value={turno.cancha_id} />
        <input type="hidden" name="inicio" value={turno.inicio} />
        {/* Honeypot: invisible para las personas */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            No completar
            <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <Campo
          etiqueta="Nombre y apellido"
          nombre="nombre"
          autoComplete="name"
          required
          maxLength={80}
          defaultValue={estado.valores?.nombre}
          error={estado.campos?.nombre}
        />
        <Campo
          etiqueta="Teléfono (WhatsApp)"
          nombre="telefono"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="341 555 1234"
          required
          defaultValue={estado.valores?.telefono}
          error={estado.campos?.telefono}
        />
        <Campo
          etiqueta="Mail"
          nombre="email"
          type="email"
          autoComplete="email"
          required
          ayuda="Te mandamos la confirmación y el recordatorio."
          defaultValue={estado.valores?.email}
          error={estado.campos?.email}
        />

        {estado.error ? (
          <p role="alert" className="rounded-lg border border-error/60 bg-error/10 p-3 text-sm text-error">
            {estado.error}
          </p>
        ) : null}

        <p className="text-sm text-texto-suave">
          El turno queda reservado a tu nombre mientras coordinás el pago por WhatsApp. Si el club no lo confirma a
          tiempo, se libera solo.
        </p>

        <Boton type="submit" disabled={enviando || estado.ocupado} className="w-full text-base">
          {enviando ? "Reservando…" : "Reservar turno"}
        </Boton>
      </form>
    </dialog>
  );
}
