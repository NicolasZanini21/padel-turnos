-- =====================================================================
-- Jobs programados (diseno_tecnico_v1.md, sección 4)
-- Requiere en Supabase Vault los secretos:
--   url_procesar_notificaciones  https://<proyecto>.supabase.co/functions/v1/procesar-notificaciones
--   cron_secret                  el mismo valor que el secreto CRON_SECRET de la Edge Function
-- Mientras no existan, el job de mails simplemente no hace nada.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Job 1: vencimiento de reservas pendientes, cada minuto. SQL puro e idempotente.
select cron.schedule('vencer-reservas', '* * * * *', $$
  update public.reservas
     set estado = 'vencida'
   where estado = 'pendiente_pago'
     and vence_en <= now();
$$);

-- Job 2: mails. Llama a la Edge Function solo si hay notificaciones listas.
select cron.schedule('procesar-notificaciones', '* * * * *', $$
  select net.http_post(
           url     := u.decrypted_secret,
           headers := jsonb_build_object('Content-Type', 'application/json',
                                         'x-cron-secret', s.decrypted_secret),
           body    := '{}'::jsonb,
           timeout_milliseconds := 15000)
    from vault.decrypted_secrets u, vault.decrypted_secrets s
   where u.name = 'url_procesar_notificaciones'
     and s.name = 'cron_secret'
     and exists (select 1 from public.notificaciones
                  where (estado = 'pendiente' and enviar_desde <= now())
                     or (estado = 'enviando' and reclamada_en < now() - interval '5 minutes'));
$$);

-- Job 3: generación de las fechas de turnos fijos. 06:00 UTC = 03:00 en Argentina.
select cron.schedule('generar-turnos-fijos', '0 6 * * *', $$
  select public.generar_turnos_fijos();
$$);
