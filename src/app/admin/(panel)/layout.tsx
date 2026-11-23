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
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
          <Logo ancho={72} className="h-7 w-auto" />
          <Suspense fallback={<div className="h-11 flex-1" />}>
            <NavAdmin />
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
