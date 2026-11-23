# Puesta en marcha

Pasos para dejar el sistema andando en Supabase, Vercel y Resend. Todo se hace una sola vez.
Los comandos se corren desde la carpeta del repo, con Node 20 o más nuevo.

## 1. Supabase

1. En [supabase.com/dashboard](https://supabase.com/dashboard) creá un proyecto nuevo. Región: **South America (São Paulo)**. Guardá la contraseña de la base.
2. Vinculá el repo y subí el esquema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push            # aplica supabase/migrations
   ```
3. Cargá los datos iniciales (canchas, horarios y número de WhatsApp). En **SQL Editor**, pegá el contenido de `supabase/seed.sql`, cambiá el número de WhatsApp por el del club y ejecutalo.
4. **Authentication → Sign In / Providers**: apagá *Allow new users to sign up*. El panel no tiene registro público.
5. **Authentication → URL Configuration**: en *Site URL* poné la URL de Vercel (paso 3).
6. Creá el usuario del club (la service role key está en **Project Settings → API Keys**; se usa solo acá, desde tu compu):
   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role> \
     node scripts/crear-admin.mjs encargado@club.com 'una-contraseña-larga'
   ```

## 2. Resend (mails)

1. En [resend.com](https://resend.com) → **Domains**, agregá el dominio del club y cargá los registros DNS que te muestra. Sin dominio propio solo se puede mandar a tu propio mail (sirve para probar).
2. **API Keys** → creá una con permiso *Sending access*.
3. Subí la Edge Function y sus secretos:
   ```bash
   npx supabase functions deploy procesar-notificaciones --no-verify-jwt
   npx supabase secrets set \
     CRON_SECRET=<un-texto-largo-al-azar> \
     RESEND_API_KEY=<api-key-de-resend> \
     MAIL_REMITENTE='Global Padel Center <turnos@dominio-del-club.com>' \
     SITIO_URL=https://<tu-proyecto>.vercel.app
   ```
4. Dale al job de pg_cron la URL de la función y el mismo secreto. En **SQL Editor**:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/procesar-notificaciones', 'url_procesar_notificaciones');
   select vault.create_secret('<el-mismo-CRON_SECRET>', 'cron_secret');
   ```

## 3. Vercel

1. En [vercel.com/new](https://vercel.com/new) importá el repo `padel-turnos`. Vercel detecta Next.js solo.
2. En **Environment Variables** cargá (de **Supabase → Project Settings → API**):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la clave *anon* / *publishable*
   - `NEXT_PUBLIC_SITE_URL` = `https://<tu-proyecto>.vercel.app`
3. Deploy. La service role **no** va en Vercel.

## 4. Probar

1. Entrá a la web, reservá un turno con tu mail.
2. Entrá a `/admin`, logueate y confirmalo. En menos de un minuto te tiene que llegar el mail de confirmación.
3. Si no llega: **Supabase → Edge Functions → procesar-notificaciones → Logs**, y en el panel aparece un aviso si un mail falló 5 veces.

## Jobs que quedan corriendo (pg_cron)

| Job | Cada | Qué hace |
|---|---|---|
| `vencer-reservas` | 1 min | Pasa a *vencida* las pendientes cuyo plazo terminó |
| `procesar-notificaciones` | 1 min | Llama a la Edge Function solo si hay mails para mandar |
| `generar-turnos-fijos` | 03:00 AR | Reserva las fechas de los turnos fijos hasta 28 días adelante |

## Cambiar horarios y parámetros

Hasta que exista la pantalla de configuración, se cambian desde **Table Editor** en Supabase:

- `franjas_semanales`: apertura, cierre y duración del turno por día (1 = lunes ... 7 = domingo).
- `dias_especiales`: feriados (cerrado) u horarios especiales por fecha.
- `config`: WhatsApp, ventana para pagar, días de anticipación, límite para cancelar.
