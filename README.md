# Global Padel Center: sistema de turnos

Reservas online de las 4 canchas de Global Padel Center (Rosario), con panel para el club.
El diseño técnico completo está en el documento `diseno_tecnico_v1.md` del proyecto.

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4, Supabase (Postgres, Auth, Realtime, pg_cron, Edge Functions), Vercel y Resend.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `supabase/migrations/` | Esquema, máquina de estados, funciones RPC, RLS y jobs de pg_cron |
| `supabase/seed.sql` | Canchas y horarios de ejemplo (valores **[SUPUESTO]** hasta que confirme el club) |
| `supabase/tests/` | Pruebas de la base (reserva, doble reserva, vencimiento, mails, cancelación, turnos fijos) |
| `supabase/functions/` | Edge Function que manda los mails |
| `src/app/` | Páginas públicas (`/`, `/reserva/[token]`) y panel (`/admin`) |

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar con los datos del proyecto de Supabase
npm run dev
```

### Probar la base

Necesita Docker. Levanta un Postgres de Supabase descartable, aplica migraciones y seed, y corre las pruebas:

```bash
scripts/db-test.sh
```

## Reglas que garantiza la base

- Nunca dos reservas activas superpuestas en la misma cancha (exclusion constraint).
- El jugador no toca tablas: solo las funciones `disponibilidad`, `crear_reserva`, `ver_reserva`, `cancelar_reserva` y `config_publica`.
- Las transiciones de estado inválidas se rechazan en un trigger.
- Los mails salen de una tabla `notificaciones` (outbox) con idempotencia por fila.
