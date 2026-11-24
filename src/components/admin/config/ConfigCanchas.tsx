"use client";

import { useState, useTransition } from "react";
import { guardarCancha } from "@/app/admin/acciones-config";
import type { Resultado } from "@/app/admin/acciones";
import { Aviso, Seccion, claseControl } from "./comun";

type Cancha = { id: number; nombre: string; activa: boolean };

export function ConfigCanchas({ canchas }: { canchas: Cancha[] }) {
  return (
    <Seccion titulo="Canchas" descripcion="Una cancha desactivada no aparece en la grilla. Las reservas que ya tenía no se cancelan solas.">
      <ul className="grid gap-3 sm:grid-cols-2">
        {canchas.map((c) => (
          <FilaCancha key={`${c.id}-${c.nombre}-${c.activa}`} cancha={c} />
        ))}
      </ul>
    </Seccion>
  );
}

function FilaCancha({ cancha }: { cancha: Cancha }) {
  const [nombre, setNombre] = useState(cancha.nombre);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [guardando, iniciar] = useTransition();

  const guardar = (cambios: { nombre?: string; activa?: boolean }) =>
    iniciar(async () => setResultado(await guardarCancha(cancha.id, cambios)));

  return (
    <li className={`rounded-xl border p-4 ${cancha.activa ? "border-borde" : "border-dashed border-borde-control opacity-80"}`}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          guardar({ nombre });
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Nombre de la cancha</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} className={claseControl} />
        </label>
        {nombre.trim() !== cancha.nombre ? (
          <button type="submit" disabled={guardando} className="min-h-11 rounded-lg bg-primario px-3 text-sm font-semibold text-sobre-primario">
            Guardar
          </button>
        ) : null}
      </form>
      <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          role="switch"
          checked={cancha.activa}
          disabled={guardando}
          onChange={(e) => guardar({ activa: e.target.checked })}
          className="size-5 accent-lima-400"
        />
        <span className={cancha.activa ? "text-estado-libre" : "text-texto-suave"}>{cancha.activa ? "Activa: se puede reservar" : "Desactivada"}</span>
      </label>
      <div className="mt-1">
        <Aviso resultado={resultado} />
      </div>
    </li>
  );
}
