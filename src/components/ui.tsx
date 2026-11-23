import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { EstadoReserva } from "@/lib/tipos";
import { NOMBRE_ESTADO } from "@/lib/tipos";

type Variante = "primario" | "secundario" | "fantasma" | "peligro";

const VARIANTES: Record<Variante, string> = {
  // Botón principal: lima con texto oscuro, nunca texto blanco sobre lima
  primario: "bg-primario text-sobre-primario hover:bg-primario-hover",
  // Botón azul: azul-600 (el azul de marca no da contraste con texto blanco)
  secundario: "bg-acento-solido text-sobre-acento hover:brightness-110",
  fantasma: "border border-borde-control text-texto hover:bg-superficie-2",
  peligro: "border border-error text-error hover:bg-error/10",
};

export function clasesBoton(variante: Variante = "primario", extra = "") {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]} ${extra}`;
}

export function Boton({
  variante = "primario",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return <button {...props} className={clasesBoton(variante, className)} />;
}

const COLOR_ESTADO: Record<EstadoReserva, string> = {
  pendiente_pago: "text-estado-pendiente border-estado-pendiente",
  confirmada: "text-estado-confirmada border-estado-confirmada",
  cancelada: "text-estado-cancelada border-estado-cancelada",
  vencida: "text-estado-vencida border-estado-vencida",
};

const ICONO_ESTADO: Record<EstadoReserva, string> = {
  pendiente_pago: "⏳",
  confirmada: "✓",
  cancelada: "✕",
  vencida: "✕",
};

/** El estado siempre lleva su nombre en texto, no solo color (regla 2). */
export function EtiquetaEstado({ estado }: { estado: EstadoReserva }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${COLOR_ESTADO[estado]}`}>
      <span aria-hidden>{ICONO_ESTADO[estado]}</span>
      {NOMBRE_ESTADO[estado]}
    </span>
  );
}

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-borde bg-superficie p-5 ${className}`}>{children}</div>;
}

export function Campo({
  etiqueta,
  nombre,
  ayuda,
  error,
  ...props
}: {
  etiqueta: string;
  nombre: string;
  ayuda?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const idAyuda = ayuda || error ? `${nombre}-ayuda` : undefined;
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{etiqueta}</span>
      <input
        name={nombre}
        aria-invalid={error ? true : undefined}
        aria-describedby={idAyuda}
        className="block min-h-11 w-full rounded-lg border border-borde-control bg-superficie-2 px-3 py-2 text-texto placeholder:text-noche-400 aria-invalid:border-error"
        {...props}
      />
      {error ? (
        <span id={idAyuda} className="mt-1 block text-sm text-error">
          {error}
        </span>
      ) : ayuda ? (
        <span id={idAyuda} className="mt-1 block text-sm text-texto-suave">
          {ayuda}
        </span>
      ) : null}
    </label>
  );
}
