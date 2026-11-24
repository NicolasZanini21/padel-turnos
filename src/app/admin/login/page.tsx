import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { FormLogin } from "./FormLogin";

export const metadata: Metadata = { title: "Ingresar al panel", robots: { index: false, follow: false } };

export default function Login() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-borde bg-superficie p-6">
        <Logo ancho={160} className="mx-auto h-auto w-40" prioridad />
        <h1 className="mt-5 text-center font-titulo text-xl font-bold">Panel del club</h1>
        <FormLogin />
      </div>
    </main>
  );
}
