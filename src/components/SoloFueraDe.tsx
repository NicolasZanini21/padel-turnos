"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Muestra el contenido en todas las páginas menos las que empiezan con `prefijo`. */
export function SoloFueraDe({ prefijo, children }: { prefijo: string; children: ReactNode }) {
  const ruta = usePathname();
  return ruta.startsWith(prefijo) ? null : children;
}
