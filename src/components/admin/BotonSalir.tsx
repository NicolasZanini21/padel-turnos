"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { salir } from "@/app/admin/acciones";
import { Boton } from "@/components/ui";

/** "Salir" del panel con confirmación, para no cerrar la sesión por un toque sin querer. */
export function BotonSalir() {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        className="ml-auto min-h-11 rounded-lg px-3 text-sm text-texto-suave hover:bg-superficie-2"
      >
        Salir
      </button>
      <dialog
        ref={ref}
        aria-labelledby="salir-titulo"
        aria-describedby="salir-texto"
        // tocar afuera de la caja también cancela
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-borde bg-superficie p-0 text-texto backdrop:bg-black/70"
      >
        <form action={salir} className="space-y-4 p-6">
          <h2 id="salir-titulo" className="font-titulo text-xl font-bold">
            ¿Querés salir?
          </h2>
          <p id="salir-texto" className="text-sm text-texto-suave">
            Se cierra la sesión del panel en este dispositivo. Para volver a entrar vas a necesitar el mail y la contraseña.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {/* Cancelar primero en el foco: es lo más seguro si se tocó sin querer */}
            <Boton type="button" variante="fantasma" autoFocus onClick={() => ref.current?.close()}>
              Cancelar
            </Boton>
            <BotonConfirmar />
          </div>
        </form>
      </dialog>
    </>
  );
}

function BotonConfirmar() {
  const { pending } = useFormStatus();
  return (
    <Boton type="submit" disabled={pending}>
      {pending ? "Saliendo…" : "Salir"}
    </Boton>
  );
}
