-- Pruebas de la base: correr con
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/reservas_test.sql
-- Todo corre en una transacción que se deshace al final: no deja datos.
\set QUIET on
begin;
create schema tst;
grant usage on schema tst to anon, authenticated;
alter default privileges in schema tst grant select on tables to anon, authenticated;
alter default privileges in schema tst grant execute on functions to anon, authenticated;
create table tst.res (nombre text primary key, j jsonb);
grant all on tst.res to anon, authenticated;
create view tst.r1  as select j from tst.res where nombre = 'r1';
create view tst.r2  as select j from tst.res where nombre = 'r2';
create view tst.r23 as select j from tst.res where nombre = 'r23';
create view tst.tf  as select j from tst.res where nombre = 'tf';

create function tst.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLÓ: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Espera que la sentencia falle con el mensaje dado
create function tst.falla(sql text, esperado text, msg text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FALLÓ: % (no dio error, se esperaba %)', msg, esperado;
exception when others then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
  if sqlerrm <> esperado then
    raise exception 'FALLÓ: % (error "%", se esperaba "%")', msg, sqlerrm, esperado;
  end if;
  raise notice 'ok - %', msg;
end $$;

create function tst.como_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function tst.como_admin() returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true),
         set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
$$;
create function tst.como_intruso() returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true),
         set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
$$;
create function tst.como_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@club.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'otro@usuario.test');
insert into public.admins (user_id, email) values ('00000000-0000-0000-0000-0000000000a1', 'admin@club.test');

-- Fecha de prueba: el próximo martes desde mañana, para que no dependa de la hora
create table tst.ctx as
select d as fecha,
       (d + time '20:00') at time zone 'America/Argentina/Buenos_Aires' as t20,
       (d + time '23:00') at time zone 'America/Argentina/Buenos_Aires' as t23
  from (select public.hoy_local() + 1 + ((2 - extract(isodow from public.hoy_local() + 1)::int + 7) % 7) as d) x;

-- ---------------------------------------------------------------------
\echo '# Grilla'
select tst.ok((select count(*) from public.slots_del_dia((select fecha from tst.ctx))) = 11, 'martes: 11 turnos de 90 min');
select tst.ok((select max(fin) from public.slots_del_dia((select fecha from tst.ctx)))
                  = ((select fecha from tst.ctx) + 1 + time '00:30') at time zone 'America/Argentina/Buenos_Aires',
                  'el último turno termina 00:30 del día siguiente');
select tst.ok((select count(*) from public.slots_del_dia((select fecha from tst.ctx) + 4)) = 10, 'sábado: 10 turnos');
insert into public.dias_especiales (fecha, cerrado, motivo) values ((select fecha from tst.ctx) + 1, true, 'feriado');
select tst.ok((select count(*) from public.slots_del_dia((select fecha from tst.ctx) + 1)) = 0, 'día especial cerrado: sin turnos');

-- ---------------------------------------------------------------------
\echo '# Público (anon)'
select tst.como_anon();
select tst.falla('select * from public.reservas', 'permission denied for table reservas', 'anon no lee reservas');
select tst.falla('select public.slots_del_dia(current_date)', 'permission denied for function slots_del_dia', 'anon no llama funciones internas');
select tst.falla('select public.generar_turnos_fijos()', 'permission denied for function generar_turnos_fijos', 'anon no genera turnos fijos');
select tst.ok((select count(*) from public.disponibilidad((select fecha from tst.ctx))) = 44, 'disponibilidad: 4 canchas x 11 turnos');
select tst.ok((select count(*) from public.disponibilidad(public.hoy_local() + 30)) = 0, 'disponibilidad fuera de rango: vacía');
select tst.ok((public.config_publica() ->> 'whatsapp_numero') is not null, 'config_publica');

insert into tst.res select 'r1', public.crear_reserva(1::smallint, (select t20 from tst.ctx), 'Juan Pérez', '+5493415550001', 'juan@test.com');
select tst.ok((select j ->> 'token_gestion' from tst.r1) ~ '^[0-9a-f]{48}$', 'crear_reserva devuelve token de 48 hex');
select tst.ok((select estado from public.disponibilidad((select fecha from tst.ctx)) where cancha_id = 1 and inicio = (select t20 from tst.ctx)) = 'ocupado',
                  'el turno reservado aparece ocupado');
select tst.falla($$select public.crear_reserva(1::smallint, (select t20 from tst.ctx), 'Otra Persona', '+5493415550002', 'otra@test.com')$$,
                     'horario_ocupado', 'doble reserva rechazada');
select tst.falla($$select public.crear_reserva(1::smallint, (select t20 from tst.ctx) + interval '10 minutes', 'Otra Persona', '+5493415550002', 'otra@test.com')$$,
                     'horario_invalido', 'inicio fuera de la grilla');
select tst.falla($$select public.crear_reserva(1::smallint, (select t20 from tst.ctx) + interval '20 days', 'Otra Persona', '+5493415550002', 'otra@test.com')$$,
                     'fuera_de_rango', 'más allá de la anticipación máxima');
select tst.falla($$select public.crear_reserva(1::smallint, (select t20 from tst.ctx) + interval '1 day', 'Otra Persona', '+5493415550002', 'otra@test.com')$$,
                     'horario_invalido', 'día cerrado');
select tst.falla($$select public.crear_reserva(2::smallint, (select t20 from tst.ctx), 'X', '+5493415550002', 'otra@test.com')$$,
                     'datos_invalidos', 'nombre demasiado corto');
select public.crear_reserva(2::smallint, (select t20 from tst.ctx), 'Juan Pérez', '+5493415550001', 'juan@test.com');
select tst.falla($$select public.crear_reserva(3::smallint, (select t20 from tst.ctx), 'Juan Pérez', '+5493415550001', 'juan@test.com')$$,
                     'demasiadas_pendientes', 'límite de 2 pendientes por teléfono');

-- Turno después de medianoche (23:00 a 00:30)
insert into tst.res select 'r23', public.crear_reserva(4::smallint, (select t23 from tst.ctx), 'Noche Tarde', '+5493415550003', 'noche@test.com');
select tst.ok((select (j ->> 'fin')::timestamptz - (j ->> 'inicio')::timestamptz from tst.r23) = interval '90 minutes', 'turno de 23:00 dura 90 min');

select tst.ok((public.ver_reserva((select j ->> 'token_gestion' from tst.r1)) ->> 'estado') = 'pendiente_pago', 'ver_reserva por token');
select tst.ok(public.ver_reserva('token-que-no-existe') is null, 'token inexistente: null');

-- ---------------------------------------------------------------------
\echo '# Seguridad del admin'
select tst.como_intruso();
select tst.ok((select count(*) from public.reservas) = 0, 'un usuario logueado que no es admin no ve reservas');
select tst.falla('select public.generar_turnos_fijos()', 'no_autorizado', 'no admin no genera turnos fijos');

-- ---------------------------------------------------------------------
\echo '# Admin: confirmar y mails'
select tst.como_admin();
select tst.ok((select count(*) from public.reservas) = 3, 'el admin ve las 3 reservas');
update public.reservas set estado = 'confirmada' where token_gestion = (select j ->> 'token_gestion' from tst.r1);
select tst.ok((select confirmada_en is not null and vence_en is null from public.reservas
                    where token_gestion = (select j ->> 'token_gestion' from tst.r1)), 'confirmar completa confirmada_en');
select tst.ok((select array_agg(tipo::text order by tipo) from public.notificaciones
                    where reserva_id = (select (j ->> 'id')::uuid from tst.r1)) = array['confirmacion', 'recordatorio'],
                  'confirmar encola confirmación y recordatorio');
select tst.ok((select enviar_desde from public.notificaciones
                    where reserva_id = (select (j ->> 'id')::uuid from tst.r1) and tipo = 'recordatorio')
                  = (select t20 from tst.ctx) - interval '5 hours', 'recordatorio 5 h antes');
select tst.falla($$update public.reservas set inicio = inicio + interval '1 day' where token_gestion = (select j ->> 'token_gestion' from tst.r1)$$,
                     'campo_inmutable', 'no se puede mover una reserva');
select tst.falla($$update public.reservas set estado = 'pendiente_pago' where token_gestion = (select j ->> 'token_gestion' from tst.r1)$$,
                     'transicion_invalida', 'confirmada -> pendiente no vale');

-- Rechazo de una pendiente: va mail de cancelación
update public.reservas set estado = 'cancelada', motivo_cancelacion = 'no pagó'
 where token_gestion = (select j ->> 'token_gestion' from tst.r23);
select tst.ok((select cancelada_por = 'admin' from public.reservas where token_gestion = (select j ->> 'token_gestion' from tst.r23)),
                  'rechazo queda cancelada_por admin');
select tst.ok(exists (select 1 from public.notificaciones where reserva_id = (select (j ->> 'id')::uuid from tst.r23) and tipo = 'cancelacion'),
                  'rechazo encola mail de cancelación');

-- Reserva manual
insert into public.reservas (cancha_id, inicio, fin, nombre, telefono, estado, origen)
values (3, (select t20 from tst.ctx), (select t20 from tst.ctx) + interval '90 minutes', 'Mostrador', '+5493415550009', 'confirmada', 'admin');
select tst.falla($$insert into public.reservas (cancha_id, inicio, fin, nombre, telefono, email, estado, origen)
                       values (3, (select t20 from tst.ctx), (select t20 from tst.ctx) + interval '90 minutes', 'Pisa', '+5493415550008', 'a@b.co', 'confirmada', 'web')$$,
                     'new row violates row-level security policy for table "reservas"', 'el admin no inserta como web');

-- ---------------------------------------------------------------------
\echo '# Cancelación por token'
select tst.como_anon();
select tst.ok((public.ver_reserva((select j ->> 'token_gestion' from tst.r1)) ->> 'puede_cancelar')::boolean, 'confirmada con tiempo: puede cancelar');
select public.cancelar_reserva((select j ->> 'token_gestion' from tst.r1));
select tst.falla($$select public.cancelar_reserva((select j ->> 'token_gestion' from tst.r1))$$, 'ya_cancelada', 'no se cancela dos veces');
select tst.ok((select estado from public.disponibilidad((select fecha from tst.ctx)) where cancha_id = 1 and inicio = (select t20 from tst.ctx)) = 'libre',
                  'al cancelar el turno queda libre');
select tst.como_postgres();
select tst.ok((select array_agg(tipo::text || ':' || estado::text order by tipo) from public.notificaciones
                    where reserva_id = (select (j ->> 'id')::uuid from tst.r1))
                  = array['confirmacion:descartada', 'recordatorio:descartada', 'cancelacion:pendiente'],
                  'cancelar descarta los mails pendientes y encola la cancelación');

-- ---------------------------------------------------------------------
\echo '# Vencimiento'
update public.reservas set vence_en = now() - interval '1 minute'
 where cancha_id = 2 and inicio = (select t20 from tst.ctx) and estado = 'pendiente_pago';
select tst.como_anon();
select tst.ok((select estado from public.disponibilidad((select fecha from tst.ctx)) where cancha_id = 2 and inicio = (select t20 from tst.ctx)) = 'libre',
                  'pendiente expirada se ve libre antes de que corra el job');
insert into tst.res select 'r2', public.crear_reserva(2::smallint, (select t20 from tst.ctx), 'Nueva Persona', '+5493415550004', 'nueva@test.com');
select tst.como_postgres();
select tst.ok((select estado = 'vencida' and vencida_en is not null from public.reservas
                    where cancha_id = 2 and inicio = (select t20 from tst.ctx) and telefono = '+5493415550001'),
                  'crear_reserva vence en el acto la pendiente expirada');
update public.reservas set estado = 'vencida' where estado = 'pendiente_pago' and vence_en <= now();  -- el job

-- ---------------------------------------------------------------------
\echo '# Turnos fijos'
select tst.como_admin();
select tst.falla($$select * from public.previsualizar_turno_fijo(2::smallint, 2::smallint, time '20:15', (select fecha from tst.ctx))$$,
                     'horario_invalido', 'turno fijo fuera de la grilla');
select tst.ok((select count(*) filter (where motivo = 'conflicto')
                     from public.previsualizar_turno_fijo(2::smallint, 2::smallint, time '20:00', (select fecha from tst.ctx))) = 1,
                  'vista previa marca el martes con reserva como conflicto');
insert into tst.res select 'tf', public.crear_turno_fijo(2::smallint, 2::smallint, time '20:00', 'Grupo de Juan', '+5493415550005', 'grupo@test.com',
                               true, 30000, (select fecha from tst.ctx), null, null);
select tst.ok((select (j ->> 'conflictos')::int = 1 from tst.tf), 'alta: 1 fecha en conflicto queda como excepción');
select tst.ok((select (j ->> 'fechas_creadas')::int = (select count(*) from tst.ctx c, generate_series(c.fecha + 7, public.hoy_local() + 28, interval '7 days')) from tst.tf), 'alta: genera las fechas libres hasta el horizonte de 28 días');
select tst.ok((select generar_turnos_fijos from public.generar_turnos_fijos()) = 0, 'generar es idempotente');
select tst.ok(not exists (select 1 from public.notificaciones n join public.reservas r on r.id = n.reserva_id
                               where r.origen = 'fijo' and n.tipo = 'confirmacion'), 'las fechas fijas no mandan confirmación');
select tst.ok((select count(*) from public.notificaciones n join public.reservas r on r.id = n.reserva_id
                    where r.origen = 'fijo' and n.tipo = 'recordatorio') = (select (j ->> 'fechas_creadas')::int from tst.tf),
                  'con avisos: un recordatorio por fecha');

select public.saltear_fecha_fija((select (j ->> 'id')::bigint from tst.tf), (select fecha from tst.ctx) + 7, 'no vienen');
select tst.como_anon();
select tst.ok((select estado from public.disponibilidad((select fecha from tst.ctx) + 7) where cancha_id = 2 and inicio = (select t20 from tst.ctx) + interval '7 days') = 'libre',
                  'saltear libera el horario');
select tst.como_admin();
select tst.ok(not exists (select 1 from public.notificaciones n join public.reservas r on r.id = n.reserva_id
                               where r.turno_fijo_id = (select (j ->> 'id')::bigint from tst.tf) and n.tipo = 'cancelacion'),
                  'saltear no manda mail de cancelación');
select tst.ok((select public.reactivar_fecha_fija((select (j ->> 'id')::bigint from tst.tf), (select fecha from tst.ctx) + 7)) = 'reactivada',
                  'reactivar una fecha salteada');
select tst.como_anon();
select tst.ok((select estado from public.disponibilidad((select fecha from tst.ctx) + 7) where cancha_id = 2 and inicio = (select t20 from tst.ctx) + interval '7 days') = 'ocupado',
                  'la fecha reactivada vuelve a estar ocupada');
select tst.como_admin();
select tst.ok((select public.dar_de_baja_turno_fijo((select (j ->> 'id')::bigint from tst.tf), (select fecha from tst.ctx) + 14)) >= 1,
                  'dar de baja cancela las fechas futuras');
select tst.ok(not exists (select 1 from public.reservas
                               where turno_fijo_id = (select (j ->> 'id')::bigint from tst.tf) and estado = 'confirmada'
                                 and inicio >= (select t20 from tst.ctx) + interval '14 days'),
                  'no quedan fechas fijas confirmadas después de la baja');

\echo '# Todo OK'
rollback;
