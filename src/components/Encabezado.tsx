import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "./Logo";
import { NavPublica } from "./NavPublica";

export function Encabezado() {
  return (
    <header className="sticky top-0 z-20 border-b border-borde bg-fondo/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:h-16">
        <Link href="/" className="shrink-0 rounded-md" aria-label="Global Padel Center, inicio">
          <Logo ancho={84} className="h-8 w-auto sm:h-10" prioridad />
        </Link>
        <Suspense fallback={<div className="ml-auto h-11" />}>
          <NavPublica />
        </Suspense>
      </div>
    </header>
  );
}

export function Pie() {
  return (
    // pb extra en celular: el botón flotante de WhatsApp queda sobre espacio vacío, sin tapar texto
    <footer className="mt-auto border-t border-borde">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 px-4 pt-6 pb-24 text-center text-sm text-texto-suave sm:pb-6">
        <span className="font-titulo font-bold tracking-wide text-texto uppercase">Global Padel Center</span>
        <span>Entre Ríos 542 · Rosario</span>
      </div>
    </footer>
  );
}
