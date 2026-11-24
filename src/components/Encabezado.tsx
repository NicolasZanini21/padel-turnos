import Link from "next/link";
import { Suspense } from "react";
import { obtenerWhatsapp } from "@/lib/datos-publicos";
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
    <footer className="mt-auto border-t border-borde">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-5 pr-20 text-sm text-texto-suave sm:pr-4">
        <span>Global Padel Center · Entre Ríos 542, Rosario</span>
        <Suspense fallback={null}>
          <LinkWhatsappPie />
        </Suspense>
      </div>
    </footer>
  );
}

async function LinkWhatsappPie() {
  const numero = await obtenerWhatsapp();
  if (!numero) return null;
  return (
    <a className="text-acento underline-offset-4 hover:underline" href={`https://wa.me/${numero}`} target="_blank" rel="noreferrer">
      WhatsApp del club
    </a>
  );
}
