// Edge Function: manda los mails pendientes del outbox `notificaciones`.
// La invoca pg_cron cada minuto (solo si hay algo para mandar), con el header x-cron-secret.
//
// Secretos (supabase secrets set ...):
//   CRON_SECRET     mismo valor que el secreto `cron_secret` de Vault
//   SITIO_URL       ej.: https://global-padel.vercel.app
//   MAIL_RESPONDER_A (opcional) mail del club para las respuestas
//
// Con qué se manda (MAIL_PROVIDER):
//   sin definir o "resend":  RESEND_API_KEY y MAIL_REMITENTE ("Global Padel Center <turnos@tudominio.com>")
//   "gmail":                 GMAIL_USER (la cuenta de Gmail) y GMAIL_APP_PASSWORD (contraseña de aplicación)
//                            MAIL_NOMBRE (opcional) nombre visible, por defecto "Global Padel Center"
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las pone Supabase solo.
import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarConResend, procesarNotificaciones, type EnviarMail } from "./procesar.ts";
import { enviarConGmail } from "./gmail.ts";

Deno.serve(async (req) => {
  const secreto = Deno.env.get("CRON_SECRET");
  if (!secreto || req.headers.get("x-cron-secret") !== secreto) {
    return new Response("no autorizado", { status: 401 });
  }

  const sitio = (Deno.env.get("SITIO_URL") ?? "").replace(/\/$/, "");
  if (!sitio) return new Response("falta SITIO_URL", { status: 500 });
  const enviar = elegirEnvio();
  if (typeof enviar === "string") return new Response(enviar, { status: 500 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    const resumen = await procesarNotificaciones(
      supabase,
      enviar,
      { sitioUrl: sitio, logoUrl: `${sitio}/marca/logo.png` },
    );
    console.log(JSON.stringify(resumen));
    return Response.json(resumen);
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});

/** Arma el envío según MAIL_PROVIDER. Devuelve un texto si falta algún secreto. */
function elegirEnvio(): EnviarMail | string {
  const proveedor = (Deno.env.get("MAIL_PROVIDER") ?? "resend").trim().toLowerCase();
  const responderA = Deno.env.get("MAIL_RESPONDER_A") || undefined;
  if (proveedor === "gmail") {
    const usuario = Deno.env.get("GMAIL_USER")?.trim();
    const contrasena = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!usuario || !contrasena) return "faltan GMAIL_USER o GMAIL_APP_PASSWORD";
    return enviarConGmail(usuario, contrasena, Deno.env.get("MAIL_NOMBRE") || "Global Padel Center", responderA);
  }
  if (proveedor !== "resend") return `MAIL_PROVIDER desconocido: ${proveedor} (usá gmail o resend)`;
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const remitente = Deno.env.get("MAIL_REMITENTE");
  if (!apiKey || !remitente) return "faltan RESEND_API_KEY o MAIL_REMITENTE";
  return enviarConResend(apiKey, remitente, responderA);
}
