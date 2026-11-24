import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { NavAdmin } from "@/components/admin/NavAdmin";
import { salir } from "@/app/admin/acciones";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel · Global Padel Center" },
  robots: { index: false, follow: false },
};

export default function LayoutPanel({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-borde bg-fondo/95 backdrop-blur">
        {/* En celular: logo y Salir arriba, el menú abajo a todo el ancho. En PC, una sola fila. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 px-4 py-1 sm:flex-nowrap sm:py-2">
          <Logo ancho={72} className="h-7 w-auto" />
          <Suspense fallback={<div className="order-last h-11 w-full sm:order-none sm:w-auto sm:flex-1" />}>
            <div className="order-last -mx-4 w-[calc(100%+2rem)] min-w-0 px-4 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:px-0">
              <NavAdmin />
            </div>
          </Suspense>
          <form action={salir} className="ml-auto">
            <button type="submit" className="min-h-11 rounded-lg px-3 text-sm text-texto-suave hover:bg-superficie-2">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
