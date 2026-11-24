import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { Grilla } from "@/components/reserva/Grilla";
import { obtenerConfig, obtenerDisponibilidad } from "@/lib/datos-publicos";
import { diaCorto, esFechaISO, sumarDias } from "@/lib/tiempo";

export default function Inicio({ searchParams }: PageProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10">
        <section className="flex flex-col items-center pt-4 pb-4 text-center sm:pt-10">
          <h1 className="sr-only">Global Padel Center</h1>
          <Logo ancho={240} className="hidden h-auto w-60 sm:block" />
          <p className="font-titulo text-2xl font-extrabold tracking-tight sm:mt-3">Reservá tu cancha</p>
          <p className="mt-1 text-sm text-texto-suave">Elegí día y horario. El pago se coordina por WhatsApp.</p>
        </section>
        <Suspense fallback={<EsqueletoGrilla />}>
          <Contenido searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  // Primero los searchParams: así el build no consulta la base al prerenderizar.
  const params = await searchParams;
  const config = await obtenerConfig();
  const pedida = typeof params.fecha === "string" ? params.fecha : undefined;
  const ultimo = sumarDias(config.hoy, config.dias_max_anticipacion);
  const fecha = esFechaISO(pedida) && pedida >= config.hoy && pedida <= ultimo ? pedida : config.hoy;
  const turnos = await obtenerDisponibilidad(fecha);

  const dias = Array.from({ length: config.dias_max_anticipacion + 1 }, (_, i) => sumarDias(config.hoy, i));

  return (
    <>
      <nav aria-label="Elegir día" className="-mx-4 mb-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-2">
          {dias.map((d, i) => {
            const activo = d === fecha;
            const [nombre, numero] = diaCorto(d).split(" ");
            return (
              <li key={d}>
                <Link
                  href={d === config.hoy ? "/" : `/?fecha=${d}`}
                  scroll={false}
                  aria-current={activo ? "date" : undefined}
                  className={`flex min-h-14 w-14 flex-col items-center justify-center rounded-xl border text-sm transition-colors ${
                    activo
                      ? "border-primario bg-primario font-bold text-sobre-primario"
                      : "border-borde-control bg-superficie text-texto hover:bg-superficie-2"
                  }`}
                >
                  <span className="text-xs uppercase">{i === 0 ? "Hoy" : nombre}</span>
                  <span className="text-lg leading-tight font-bold">{numero}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Grilla key={fecha} fecha={fecha} turnosIniciales={turnos} />
    </>
  );
}

function EsqueletoGrilla() {
  return (
    <div aria-busy="true" aria-label="Cargando turnos" className="space-y-2">
      <div className="mb-4 h-14 animate-pulse rounded-xl bg-superficie" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-superficie" />
      ))}
    </div>
  );
}
