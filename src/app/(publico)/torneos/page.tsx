import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { clasesBoton } from "@/components/ui";
import { obtenerWhatsapp } from "@/lib/datos-publicos";

export const metadata: Metadata = {
  title: "Torneos",
  description: "Muy pronto vas a poder anotarte a los torneos de Global Padel Center desde acá.",
};

const QUE_VIENE = [
  { titulo: "Inscripción online", texto: "Anotate con tu pareja en un par de pasos, sin mandar mensajes." },
  { titulo: "Cuadros y horarios", texto: "Vas a ver contra quién jugás y en qué cancha, siempre actualizado." },
  { titulo: "Resultados", texto: "Los resultados de cada partido y los ganadores de cada categoría." },
];

export default function PaginaTorneos() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-16">
      <section className="relative overflow-hidden rounded-3xl border border-borde bg-superficie px-6 py-12 text-center sm:px-12 sm:py-16">
        {/* órbita decorativa, como el arco del logo */}
        <svg aria-hidden viewBox="0 0 400 400" className="pointer-events-none absolute -top-24 -right-24 size-80 text-acento-solido opacity-40">
          <circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" strokeWidth="14" strokeDasharray="620 400" strokeLinecap="round" />
        </svg>
        <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute -bottom-10 -left-10 size-40 text-primario opacity-20">
          <circle cx="50" cy="50" r="46" fill="currentColor" />
        </svg>

        <p className="relative inline-flex items-center gap-2 rounded-full border border-primario px-3 py-1 font-titulo text-xs font-bold tracking-widest text-primario uppercase">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-primario motion-reduce:animate-none" />
          Próximamente
        </p>
        <h1 className="relative mt-5 font-titulo text-4xl font-extrabold tracking-tight uppercase sm:text-5xl">
          Torneos
        </h1>
        <p className="relative mx-auto mt-4 max-w-md text-lg text-texto-suave">
          Estamos armando la sección de torneos del club. Muy pronto vas a poder ver las fechas y anotarte desde acá.
        </p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Suspense fallback={null}>
            <AvisarmeWhatsapp />
          </Suspense>
          <Link href="/" className={clasesBoton("fantasma")}>
            Reservar una cancha
          </Link>
        </div>
      </section>

      <h2 className="mt-12 font-titulo text-sm font-bold tracking-widest text-texto-suave uppercase">Lo que se viene</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {QUE_VIENE.map((q) => (
          <li key={q.titulo} className="rounded-2xl border border-borde bg-superficie p-5">
            <span aria-hidden className="block h-1 w-8 rounded-full bg-primario" />
            <h3 className="mt-3 font-semibold">{q.titulo}</h3>
            <p className="mt-1 text-sm text-texto-suave">{q.texto}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

async function AvisarmeWhatsapp() {
  const numero = await obtenerWhatsapp();
  if (!numero) return null;
  const texto = "Hola! Quiero enterarme cuando salgan los torneos.";
  return (
    <a href={`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className={clasesBoton("primario")}>
      Avisame por WhatsApp
    </a>
  );
}
