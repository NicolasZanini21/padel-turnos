"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", texto: "Reservas" },
  { href: "/admin/agenda", texto: "Agenda" },
  { href: "/admin/turnos-fijos", texto: "Turnos fijos" },
  { href: "/admin/configuracion", texto: "Configuración", corto: "Config." },
] as const;

export function NavAdmin() {
  const ruta = usePathname();
  return (
    <nav aria-label="Panel" className="flex gap-0.5 overflow-x-auto sm:gap-1">
      {LINKS.map((l) => {
        const { href, texto } = l;
        const corto = "corto" in l ? l.corto : undefined;
        const activo = href === "/admin" ? ruta === "/admin" : ruta.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-lg px-2 text-[13px] font-semibold whitespace-nowrap sm:px-3 sm:text-sm ${
              activo ? "bg-superficie-2 text-primario" : "text-texto-suave hover:bg-superficie-2 hover:text-texto"
            }`}
          >
            {corto ? (
              <>
                <span className="sm:hidden">{corto}</span>
                <span className="hidden sm:inline">{texto}</span>
              </>
            ) : (
              texto
            )}
          </Link>
        );
      })}
    </nav>
  );
}
