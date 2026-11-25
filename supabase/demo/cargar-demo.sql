-- =====================================================================
-- DATOS DE DEMO: carga reservas y turnos fijos de ejemplo
-- ---------------------------------------------------------------------
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede correr varias veces: primero borra la demo anterior.
-- Para sacar todo: correr borrar-demo.sql.
--
-- · Todo queda marcado con [DEMO], así se borra sin tocar reservas reales.
-- · Las reservas de demo NO tienen mail: no se manda ningún correo.
-- · Respeta el horario que esté cargado en Configuración y no pisa
--   reservas reales ni bloqueos.
-- =====================================================================

-- 1. Limpiar una demo anterior
delete from public.reservas
 where notas_admin = '[DEMO]'
    or turno_fijo_id in (select id from public.turnos_fijos where notas = '[DEMO]');
delete from public.turnos_fijos where notas = '[DEMO]';

-- 2. Turnos fijos (los "de siempre" de cada semana), cerca de las 20 hs
do $$
declare
  v_hoy   date := public.hoy_local();
  v_fecha date;
  v_hora  time;
  v_dur   interval;
  v_id    bigint;
  f record;
begin
  for f in
    select * from (values
      (1::smallint, 2::smallint, time '20:00', 'Los Martes de Fede',   '+5493415550101'),
      (2::smallint, 4::smallint, time '21:30', 'Grupo Funes',          '+5493415550102'),
      (3::smallint, 1::smallint, time '18:30', 'Caro y amigas',        '+5493415550103'),
      (4::smallint, 3::smallint, time '20:00', 'Profe Matías (clase)', '+5493415550104')
    ) as t(cancha, dia, objetivo, nombre, telefono)
  loop
    continue when not exists (select 1 from public.canchas where id = f.cancha and activa);
    -- próxima fecha de ese día de la semana
    v_fecha := v_hoy + ((f.dia - extract(isodow from v_hoy)::int + 7) % 7);
    -- el turno de la grilla más cercano a la hora objetivo
    select (s.inicio at time zone 'America/Argentina/Buenos_Aires')::time, s.fin - s.inicio
      into v_hora, v_dur
      from public.slots_del_dia(v_fecha) s
     order by abs(extract(epoch from ((s.inicio at time zone 'America/Argentina/Buenos_Aires')::time - f.objetivo)))
     limit 1;
    continue when v_hora is null;

    insert into public.turnos_fijos (cancha_id, dia_semana, hora_inicio, duracion, nombre, telefono, vigente_desde, notas)
    values (f.cancha, f.dia, v_hora, v_dur, f.nombre, f.telefono, v_hoy, '[DEMO]')
    returning id into v_id;
    perform public.generar_turnos_fijos(null, v_id);
  end loop;
end $$;

-- 3. Reservas sueltas para los próximos 7 días
--    Más ocupado a la noche que a la mañana, como un club de verdad.
do $$
declare
  v_hoy    date := public.hoy_local();
  v_nombres text[] := array[
    'Martín Gómez','Lucía Fernández','Nicolás Pereyra','Sofía Romero','Juan Ignacio Díaz',
    'Valentina Acosta','Tomás Benítez','Camila Sosa','Agustín Medina','Florencia Ruiz',
    'Franco Herrera','Julieta Castro','Santiago Molina','Micaela Ortiz','Facundo Vera',
    'Rocío Giménez','Lautaro Ríos','Antonella Paz','Gonzalo Torres','Milagros Luna'];
  v_n      int := 0;
  v_pend   int := 0;
  v_prob   float;
  v_hora   int;
  s record;
  c record;
begin
  perform setseed(0.42);  -- siempre la misma "agenda" de demo
  for d in 0..6 loop
    for s in select * from public.slots_del_dia(v_hoy + d) order by inicio loop
      continue when s.inicio <= now() + interval '30 minutes';
      v_hora := extract(hour from s.inicio at time zone 'America/Argentina/Buenos_Aires')::int;
      v_prob := case
                  when v_hora >= 18 or v_hora < 2 then 0.75   -- noche: casi lleno
                  when v_hora >= 12 then 0.35                 -- tarde
                  else 0.15                                   -- mañana
                end
                + case when extract(isodow from v_hoy + d) >= 6 then 0.1 else 0 end;

      for c in select id from public.canchas where activa order by orden, id loop
        continue when random() > v_prob;
        -- no pisar reservas reales, turnos fijos ni bloqueos
        continue when exists (select 1 from public.reservas r
                               where r.cancha_id = c.id and r.estado in ('pendiente_pago','confirmada')
                                 and r.rango && tstzrange(s.inicio, s.fin, '[)'));
        continue when exists (select 1 from public.bloqueos b
                               where b.rango && tstzrange(s.inicio, s.fin, '[)')
                                 and (b.cancha_id is null or b.cancha_id = c.id));
        v_n := v_n + 1;
        if v_pend < 4 and d between 1 and 3 and random() < 0.15 then
          -- unas pocas "esperando pago" para mostrar en el panel
          v_pend := v_pend + 1;
          insert into public.reservas (cancha_id, inicio, fin, nombre, telefono, estado, origen, precio_ars, vence_en, notas_admin)
          values (c.id, s.inicio, s.fin, v_nombres[1 + (v_n % 20)], '+54934155502' || lpad((v_n % 100)::text, 2, '0'),
                  'pendiente_pago', 'admin', s.precio_ars, now() + interval '2 days', '[DEMO]');
        else
          insert into public.reservas (cancha_id, inicio, fin, nombre, telefono, estado, origen, precio_ars, notas_admin)
          values (c.id, s.inicio, s.fin, v_nombres[1 + (v_n % 20)], '+54934155502' || lpad((v_n % 100)::text, 2, '0'),
                  'confirmada', 'admin', s.precio_ars, '[DEMO]');
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- 4. Resumen
select
  (select count(*) from public.turnos_fijos where notas = '[DEMO]')                          as turnos_fijos_demo,
  (select count(*) from public.reservas r join public.turnos_fijos t on t.id = r.turno_fijo_id
    where t.notas = '[DEMO]')                                                                 as fechas_de_turnos_fijos,
  (select count(*) from public.reservas where notas_admin = '[DEMO]' and estado = 'confirmada')     as reservas_confirmadas,
  (select count(*) from public.reservas where notas_admin = '[DEMO]' and estado = 'pendiente_pago') as reservas_esperando_pago;
