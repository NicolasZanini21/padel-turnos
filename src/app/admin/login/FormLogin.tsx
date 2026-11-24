"use client";

import { useActionState } from "react";
import { ingresar, type Resultado } from "@/app/admin/acciones";
import { Boton, Campo } from "@/components/ui";

export function FormLogin() {
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(ingresar, {});
  return (
    <form action={accion} className="mt-6 space-y-4">
      <Campo etiqueta="Mail" nombre="email" type="email" autoComplete="username" required defaultValue={estado.email} key={estado.email} />
      <Campo etiqueta="Contraseña" nombre="password" type="password" autoComplete="current-password" required />
      {estado.error ? (
        <p role="alert" className="text-sm text-error">
          {estado.error}
        </p>
      ) : null}
      <Boton type="submit" disabled={enviando} className="w-full">
        {enviando ? "Ingresando…" : "Ingresar"}
      </Boton>
    </form>
  );
}
