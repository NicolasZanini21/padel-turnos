import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { CuentaRegresiva } from "@/components/reserva/CuentaRegresiva";
import { clasesBoton, EtiquetaEstado } from "@/components/ui";
import { linkWhatsapp, mensajeReserva } from "@/lib/contacto";
import { obtenerConfig, obtenerReserva } from "@/lib/datos-publicos";
import { SITE_URL } from "@/lib/env";
import { capitalizar, diaLargo, hora, precio } from "@/lib/tiempo";

export const metadata: Metadata = {
  title: "Tu reserva",
  robots: { index: false, follow: false },
};

export default function PaginaReserva(props: PageProps<"/reserva/[token]">) {
  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-superficie" aria-busy="true" />}>
          <Ticket {...props} />
        </Suspense>
      </main>
    </>
  );
}

async function Ticket({ params, searchParams }: PageProps<"/reserva/[token]">) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const [reserva, config] = await Promise.all([obtenerReserva(token), obtenerConfig()]);
  if (!reserva) notFound();

  const link = `${SITE_URL()}/reserva/${token}`;
  const whatsapp = linkWhatsapp(config.whatsapp_numero, mensajeReserva(reserva, link));
  const p = precio(reserva.precio_ars);
  const pendiente = reserva.estado === "pendiente_pago";

  return (
    <>
      {sp.nueva && pendiente ? (
        <p role="status" className="mb-4 rounded-xl border border-primario/60 bg-primario/10 p-3 text-sm">
          ¡Listo! El turno quedó reservado a tu nombre. Ahora coordiná el pago con el club por WhatsApp.
        </p>
      ) : null}
      {sp.cancelada ? (
        <p role="status" className="mb-4 rounded-xl border border-borde-control bg-superficie p-3 text-sm">
          Cancelaste la reserva. El turno quedó libre para otra persona.
        </p>
      ) : null}

      <article className="overflow-hidden rounded-3xl border border-borde bg-superficie" aria-labelledby="titulo-ticket">
        <div className="flex flex-col items-center gap-3 border-b border-dashed border-borde-control px-6 pt-6 pb-5">
          <Logo ancho={200} className="h-auto w-44" />
          <EtiquetaEstado estado={reserva.estado} />
        </div>

        <div className="space-y-4 px-6 py-5">
          <h1 id="titulo-ticket" className="font-titulo text-2xl font-extrabold">
            {reserva.cancha}
          </h1>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-texto-suave">Día</dt>
            <dd className="font-semibold">{capitalizar(diaLargo(reserva.inicio))}</dd>
            <dt className="text-texto-suave">Horario</dt>
            <dd className="font-semibold tabular-nums">
              {hora(reserva.inicio)} a {hora(reserva.fin)}
            </dd>
            <dt className="text-texto-suave">A nombre de</dt>
            <dd className="font-semibold">{reserva.nombre}</dd>
            {p ? (
              <>
                <dt className="text-texto-suave">Precio</dt>
                <dd className="font-semibold">{p}</dd>
              </>
            ) : null}
          </dl>

          {pendiente && reserva.vence_en ? (
            <div className="rounded-2xl border border-estado-pendiente/60 bg-estado-pendiente/10 p-4">
              <p className="text-sm">Tenés tiempo para coordinar el pago hasta que se libere el turno:</p>
              <CuentaRegresiva hasta={reserva.vence_en} />
              <p className="mt-2 text-xs text-texto-suave">
                Cuando el club confirme el pago te llega un mail con la confirmación.
              </p>
            </div>
          ) : null}

          {reserva.estado === "confirmada" ? (
            <p className="text-sm text-texto-suave">
              Tu turno está confirmado. Te mandamos un recordatorio por mail 5 horas antes.
            </p>
          ) : null}

          {reserva.estado === "vencida" ? (
            <p className="text-sm text-texto-suave">
              No se confirmó el pago a tiempo y el turno se liberó.{" "}
              <Link href="/" className="text-acento underline underline-offset-4">
                Reservá otro turno
              </Link>
              .
            </p>
          ) : null}

          {reserva.estado === "cancelada" ? (
            <p className="text-sm text-texto-suave">
              {reserva.cancelada_por === "admin"
                ? "El club canceló esta reserva. Si tenés dudas, escribinos por WhatsApp."
                : "Esta reserva está cancelada."}
            </p>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-borde px-6 py-5">
          {pendiente ? (
            <a href={whatsapp} className={clasesBoton("primario", "w-full text-base")}>
              Coordinar pago por WhatsApp
            </a>
          ) : (
            <a href={whatsapp} className={clasesBoton("fantasma", "w-full")}>
              Escribirle al club
            </a>
          )}
          {reserva.puede_cancelar ? (
            <Link href={`/reserva/${token}/cancelar`} className={clasesBoton("fantasma", "w-full")}>
              Cancelar reserva
            </Link>
          ) : null}
          {reserva.estado === "confirmada" && !reserva.puede_cancelar ? (
            <p className="text-center text-xs text-texto-suave">
              Faltan menos de {Math.round(config.limite_cancelacion_minutos / 60)} horas: para cancelar, escribile al club.
            </p>
          ) : null}
        </div>
      </article>

      <p className="mt-4 text-center text-xs text-texto-suave">
        Guardá este link: es tu comprobante y desde acá podés cancelar.
      </p>
    </>
  );
}
