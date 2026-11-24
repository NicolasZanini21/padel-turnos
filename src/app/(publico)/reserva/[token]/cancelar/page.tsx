import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { BotonCancelar } from "@/components/reserva/BotonCancelar";
import { clasesBoton } from "@/components/ui";
import { obtenerReserva } from "@/lib/datos-publicos";
import { capitalizar, diaLargo, hora } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Cancelar reserva", robots: { index: false, follow: false } };

// La cancelación nunca ocurre en un GET: los antivirus y clientes de mail abren los
// links para escanearlos. Esta página solo pide confirmación; cancela el botón (POST).
export default function PaginaCancelar(props: PageProps<"/reserva/[token]/cancelar">) {
  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <Suspense fallback={<div className="h-72 animate-pulse rounded-3xl bg-superficie" aria-busy="true" />}>
          <Confirmacion {...props} />
        </Suspense>
      </main>
    </>
  );
}

async function Confirmacion({ params }: PageProps<"/reserva/[token]/cancelar">) {
  const { token } = await params;
  const reserva = await obtenerReserva(token);
  if (!reserva) notFound();

  return (
    <div className="rounded-3xl border border-borde bg-superficie p-6 text-center">
      <Logo ancho={160} className="mx-auto h-auto w-36" />
      {reserva.puede_cancelar ? (
        <>
          <h1 className="mt-5 font-titulo text-2xl font-extrabold">¿Seguro que querés cancelar?</h1>
          <p className="mt-2 text-texto-suave">
            {reserva.cancha} · {capitalizar(diaLargo(reserva.inicio))} de {hora(reserva.inicio)} a {hora(reserva.fin)}
          </p>
          <p className="mt-2 text-sm text-texto-suave">El turno queda libre para otra persona.</p>
          <div className="mt-6 space-y-3">
            <BotonCancelar token={token} />
            <Link href={`/reserva/${token}`} className={clasesBoton("fantasma", "w-full")}>
              No, volver
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-5 font-titulo text-2xl font-extrabold">Esta reserva no se puede cancelar online</h1>
          <p className="mt-2 text-texto-suave">
            {reserva.estado === "cancelada" || reserva.estado === "vencida"
              ? "Ya no está activa."
              : "Falta poco para el turno. Escribile al club por WhatsApp."}
          </p>
          <Link href={`/reserva/${token}`} className={clasesBoton("fantasma", "mt-6 w-full")}>
            Ver la reserva
          </Link>
        </>
      )}
    </div>
  );
}
