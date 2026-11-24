import Link from "next/link";
import { Logo } from "./Logo";

export function Encabezado() {
  return (
    <header className="border-b border-borde">
      <div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:h-16">
        <Link href="/" className="rounded-md" aria-label="Global Padel Center, inicio">
          <Logo ancho={84} className="h-8 w-auto sm:h-10" prioridad />
        </Link>
      </div>
    </header>
  );
}

export function Pie({ whatsapp }: { whatsapp?: string }) {
  return (
    <footer className="mt-auto border-t border-borde">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-texto-suave">
        <span>Global Padel Center · Entre Ríos 542, Rosario</span>
        {whatsapp ? (
          <a className="text-acento underline-offset-4 hover:underline" href={`https://wa.me/${whatsapp}`}>
            WhatsApp del club
          </a>
        ) : null}
      </div>
    </footer>
  );
}
