// Edge Function: manda los mails pendientes del outbox `notificaciones`.
// La invoca pg_cron cada minuto (solo si hay algo para mandar), con el header x-cron-secret.
//
// Secretos (supabase secrets set ...):
//   CRON_SECRET     mismo valor que el secreto `cron_secret` de Vault
//   RESEND_API_KEY  API key de Resend
//   MAIL_REMITENTE  ej.: "Global Padel Center <turnos@tudominio.com>"
//   SITIO_URL       ej.: https://global-padel.vercel.app
//   MAIL_RESPONDER_A (opcional) mail del club para las respuestas
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las pone Supabase solo.
import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarConResend, procesarNotificaciones } from "./procesar.ts";

Deno.serve(async (req) => {
  const secreto = Deno.env.get("CRON_SECRET");
  if (!secreto || req.headers.get("x-cron-secret") !== secreto) {
    return new Response("no autorizado", { status: 401 });
  }

  const sitio = (Deno.env.get("SITIO_URL") ?? "").replace(/\/$/, "");
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const remitente = Deno.env.get("MAIL_REMITENTE");
  if (!sitio || !apiKey || !remitente) {
    return new Response("faltan SITIO_URL, RESEND_API_KEY o MAIL_REMITENTE", { status: 500 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    const resumen = await procesarNotificaciones(
      supabase,
      enviarConResend(apiKey, remitente, Deno.env.get("MAIL_RESPONDER_A") ?? undefined),
      { sitioUrl: sitio, logoUrl: `${sitio}/marca/logo.png` },
    );
    console.log(JSON.stringify(resumen));
    return Response.json(resumen);
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});
