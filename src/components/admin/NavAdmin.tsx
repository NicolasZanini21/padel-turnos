"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", texto: "Reservas" },
  { href: "/admin/agenda", texto: "Agenda" },
  { href: "/admin/turnos-fijos", texto: "Turnos fijos" },
  { href: "/admin/configuracion", texto: "Configuración" },
] as const;

export function NavAdmin() {
  const ruta = usePathname();
  return (
    <nav aria-label="Panel" className="flex gap-1 overflow-x-auto">
      {LINKS.map(({ href, texto }) => {
        const activo = href === "/admin" ? ruta === "/admin" : ruta.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap ${
              activo ? "bg-superficie-2 text-primario" : "text-texto-suave hover:bg-superficie-2 hover:text-texto"
            }`}
          >
            {texto}
          </Link>
        );
      })}
    </nav>
  );
}
