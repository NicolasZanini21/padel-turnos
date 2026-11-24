"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  {
    href: "/",
    texto: "Reservas",
    activa: (r: string) => r === "/" || r.startsWith("/reserva"),
  },
  {
    href: "/torneos",
    texto: "Torneos",
    activa: (r: string) => r.startsWith("/torneos"),
  },
] as const;

export function NavPublica() {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones" className="ml-auto">
      <ul className="flex gap-0.5 sm:gap-1">
        {SECCIONES.map((s) => {
          const activa = s.activa(ruta);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={`relative flex min-h-11 items-center rounded-lg px-2.5 font-titulo text-[13px] sm:px-3 sm:text-sm font-bold tracking-wide uppercase transition-colors ${
                  activa
                    ? "text-primario"
                    : "text-texto-suave hover:bg-superficie-2 hover:text-texto"
                }`}
              >
                {s.texto}
                {activa ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-2.5 -bottom-px sm:inset-x-3 h-0.5 rounded-full bg-primario"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
