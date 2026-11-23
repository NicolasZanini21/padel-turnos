-- =====================================================================
-- Sistema de turnos Global Padel Center: esquema inicial
-- Fuente: diseno_tecnico_v1.md, secciones 2 y 2.1
-- Todas las horas se guardan en UTC (timestamptz). La zona del club,
-- America/Argentina/Buenos_Aires, está fija en el código.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensiones
-- ---------------------------------------------------------------------
create extension if not exists btree_gist with schema extensions;  -- "=" sobre smallint en la exclusion constraint
create extension if not exists citext     with schema extensions;  -- mails sin distinguir mayúsculas
create extension if not exists pgcrypto   with schema extensions;  -- gen_random_bytes

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.estado_reserva      as enum ('pendiente_pago', 'confirmada', 'cancelada', 'vencida');
create type public.origen_reserva      as enum ('web', 'admin', 'fijo');
create type public.actor               as enum ('usuario', 'admin', 'sistema');
create type public.tipo_notificacion   as enum ('confirmacion', 'recordatorio', 'cancelacion');
create type public.estado_notificacion as enum ('pendiente', 'enviando', 'enviada', 'descartada', 'fallida');
create type public.tipo_excepcion_fijo as enum ('salteo', 'cierre', 'conflicto');

-- ---------------------------------------------------------------------
-- Configuración (una sola fila)
-- ---------------------------------------------------------------------
create table public.config (
  id                           boolean primary key default true check (id),
  nombre_club                  text not null default 'Global Padel Center',
  whatsapp_numero              text not null check (whatsapp_numero ~ '^[1-9][0-9]{7,14}$'),  -- formato wa.me
  ventana_gracia               interval not null default '2 hours',
  dias_max_anticipacion        int not null default 14 check (dias_max_anticipacion between 1 and 90),
  anticipacion_minima          interval not null default '0 minutes',
  limite_cancelacion_usuario   interval not null default '3 hours',
  max_pendientes_por_telefono  int not null default 2 check (max_pendientes_por_telefono between 1 and 10),
  actualizado_en               timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Canchas
-- ---------------------------------------------------------------------
create table public.canchas (
  id      smallint generated always as identity primary key,
  nombre  text not null unique,
  orden   smallint not null default 0,
  activa  boolean not null default true
);

-- ---------------------------------------------------------------------
-- Horario semanal y excepciones
-- ---------------------------------------------------------------------
create table public.franjas_semanales (
  id              bigint generated always as identity primary key,
  dia_semana      smallint not null check (dia_semana between 1 and 7),   -- ISO: 1 = lunes ... 7 = domingo
  apertura        time not null,
  cierre          time not null,                                          -- si cierre <= apertura, es del día siguiente
  duracion_turno  interval not null default '90 minutes'
                  check (duracion_turno between '30 minutes' and '3 hours'),
  precio_ars      numeric(10,2) check (precio_ars is null or precio_ars >= 0)
);
create index on public.franjas_semanales (dia_semana);

create table public.dias_especiales (
  fecha           date primary key,
  cerrado         boolean not null default true,
  apertura        time,
  cierre          time,
  duracion_turno  interval check (duracion_turno is null or duracion_turno between '30 minutes' and '3 hours'),
  precio_ars      numeric(10,2),
  motivo          text,
  check (cerrado or (apertura is not null and cierre is not null and duracion_turno is not null))
);

create table public.bloqueos (
  id         bigint generated always as identity primary key,
  cancha_id  smallint references public.canchas(id) on delete cascade,   -- null = todas las canchas
  rango      tstzrange not null check (not isempty(rango)),
  motivo     text not null check (char_length(motivo) between 2 and 200),
  creado_en  timestamptz not null default now()
);
create index on public.bloqueos using gist (rango);

-- ---------------------------------------------------------------------
-- Turnos fijos
-- ---------------------------------------------------------------------
create table public.turnos_fijos (
  id               bigint generated always as identity primary key,
  cancha_id        smallint not null references public.canchas(id),
  dia_semana       smallint not null check (dia_semana between 1 and 7),
  hora_inicio      time not null,
  duracion         interval not null default '90 minutes',
  nombre           text not null check (char_length(nombre) between 2 and 80),
  telefono         text not null check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  email            extensions.citext check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  avisos_por_mail  boolean not null default false,
  precio_ars       numeric(10,2),
  vigente_desde    date not null,
  vigente_hasta    date,
  generado_hasta   date,
  notas            text,
  creado_en        timestamptz not null default now(),
  dado_de_baja_en  timestamptz,
  check (vigente_hasta is null or vigente_hasta >= vigente_desde - 1),
  check (not avisos_por_mail or email is not null)
);
create index on public.turnos_fijos (dia_semana) where dado_de_baja_en is null;

create table public.turno_fijo_excepciones (
  turno_fijo_id  bigint not null references public.turnos_fijos(id) on delete cascade,
  fecha          date not null,
  tipo           public.tipo_excepcion_fijo not null,
  detalle        text,
  creada_en      timestamptz not null default now(),
  primary key (turno_fijo_id, fecha)
);

-- ---------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------
create table public.reservas (
  id                  uuid primary key default gen_random_uuid(),
  cancha_id           smallint not null references public.canchas(id),
  inicio              timestamptz not null,
  fin                 timestamptz not null,
  rango               tstzrange generated always as (tstzrange(inicio, fin, '[)')) stored,

  nombre              text not null check (char_length(nombre) between 2 and 80),
  telefono            text not null check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  email               extensions.citext check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  estado              public.estado_reserva not null default 'pendiente_pago',
  origen              public.origen_reserva not null default 'web',
  turno_fijo_id       bigint references public.turnos_fijos(id),
  precio_ars          numeric(10,2),
  token_gestion       text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),

  creada_en           timestamptz not null default now(),
  vence_en            timestamptz,
  confirmada_en       timestamptz,
  vencida_en          timestamptz,
  cancelada_en        timestamptz,
  cancelada_por       public.actor,
  motivo_cancelacion  text,
  notas_admin         text,

  constraint fin_despues_de_inicio check (fin > inicio),
  constraint pendiente_tiene_vencimiento check (estado <> 'pendiente_pago' or vence_en is not null),
  constraint web_tiene_email check (origen <> 'web' or email is not null),
  constraint fijo_coherente check ((origen = 'fijo') = (turno_fijo_id is not null)),
  constraint una_reserva_por_fecha_fija unique (turno_fijo_id, inicio),

  -- La garantía central: nunca dos reservas activas superpuestas en la misma cancha
  constraint sin_superposicion exclude using gist (cancha_id with =, rango with &&)
    where (estado in ('pendiente_pago', 'confirmada'))
);

create index reservas_estado_inicio  on public.reservas (estado, inicio);
create index reservas_inicio         on public.reservas (inicio);
create index reservas_pendientes_vto on public.reservas (vence_en) where estado = 'pendiente_pago';
create index reservas_tel_pendientes on public.reservas (telefono) where estado = 'pendiente_pago';

-- ---------------------------------------------------------------------
-- Outbox de mails
-- ---------------------------------------------------------------------
create table public.notificaciones (
  id            bigint generated always as identity primary key,
  reserva_id    uuid not null references public.reservas(id) on delete cascade,
  tipo          public.tipo_notificacion not null,
  estado        public.estado_notificacion not null default 'pendiente',
  enviar_desde  timestamptz not null default now(),
  intentos      smallint not null default 0,
  reclamada_en  timestamptz,
  enviada_en    timestamptz,
  proveedor_id  text,
  ultimo_error  text,
  creada_en     timestamptz not null default now(),
  unique (reserva_id, tipo)
);
create index notificaciones_listas on public.notificaciones (enviar_desde) where estado = 'pendiente';

-- ---------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      extensions.citext not null unique,
  creado_en  timestamptz not null default now()
);

create function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Corta si quien llama no es admin. Dentro de una función security definer current_user
-- es el dueño, así que el rol real se lee del JWT que pone PostgREST. Los jobs (pg_cron)
-- y la service_role no traen rol anon/authenticated y pasan.
create function public.exigir_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rol text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role');
begin
  if public.es_admin() then
    return;
  end if;
  if (select auth.uid()) is not null or v_rol in ('anon', 'authenticated') then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;
end;
$$;

-- =====================================================================
-- Utilidades de fecha
-- =====================================================================
create function public.hoy_local() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- Turnos del día operativo (incluye los que terminan después de medianoche)
create function public.slots_del_dia(p_fecha date)
returns table (inicio timestamptz, fin timestamptz, precio_ars numeric)
language sql stable set search_path = '' as $$
  with franjas as (
    select d.apertura, d.cierre, d.duracion_turno, d.precio_ars
      from public.dias_especiales d
     where d.fecha = p_fecha and not d.cerrado
    union all
    select f.apertura, f.cierre, f.duracion_turno, f.precio_ars
      from public.franjas_semanales f
     where f.dia_semana = extract(isodow from p_fecha)
       and not exists (select 1 from public.dias_especiales d where d.fecha = p_fecha)
  ), limites as (
    select p_fecha + apertura as desde_local,
           p_fecha + cierre + case when cierre <= apertura then interval '1 day' else interval '0' end as hasta_local,
           duracion_turno, precio_ars
      from franjas
  )
  select s at time zone 'America/Argentina/Buenos_Aires',
         (s + l.duracion_turno) at time zone 'America/Argentina/Buenos_Aires',
         l.precio_ars
    from limites l,
         lateral generate_series(l.desde_local, l.hasta_local - l.duracion_turno, l.duracion_turno) as s
   order by 1;
$$;

-- ¿hora_inicio coincide con un turno de la grilla semanal de ese día? Devuelve la duración del turno.
create function public.duracion_en_grilla_semanal(p_dia_semana smallint, p_hora time)
returns interval
language sql stable set search_path = '' as $$
  select f.duracion_turno
    from public.franjas_semanales f,
         lateral generate_series(
           date '2000-01-03' + f.apertura,
           date '2000-01-03' + f.cierre
             + case when f.cierre <= f.apertura then interval '1 day' else interval '0' end
             - f.duracion_turno,
           f.duracion_turno) as s
   where f.dia_semana = p_dia_semana
     and s::time = p_hora
   limit 1;
$$;

-- =====================================================================
-- Máquina de estados de reservas
-- =====================================================================
create function public.reservas_antes_de_insertar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.origen = 'web' then
    new.estado := 'pendiente_pago';
  end if;
  if new.estado = 'confirmada' then
    new.confirmada_en := coalesce(new.confirmada_en, now());
    new.vence_en := null;
  elsif new.estado <> 'pendiente_pago' then
    raise exception 'transicion_invalida' using detail = 'una reserva nueva solo puede nacer pendiente o confirmada';
  end if;
  return new;
end;
$$;

create function public.reservas_antes_de_actualizar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.cancha_id <> old.cancha_id or new.inicio <> old.inicio or new.fin <> old.fin
     or new.origen <> old.origen or new.turno_fijo_id is distinct from old.turno_fijo_id
     or new.token_gestion <> old.token_gestion or new.creada_en <> old.creada_en then
    raise exception 'campo_inmutable' using detail = 'para mover un turno, cancelalo y creá otro';
  end if;

  if new.estado = old.estado then
    return new;   -- cambios de contacto o de notas
  end if;

  if old.estado = 'pendiente_pago' and new.estado = 'confirmada'
     or old.estado = 'vencida' and new.estado = 'confirmada' then
    new.confirmada_en := now();
    new.vence_en := null;
  elsif old.estado = 'cancelada' and new.estado = 'confirmada' and old.origen = 'fijo' then
    -- Reactivar una fecha de turno fijo salteada o cancelada (reactivar_fecha_fija)
    new.confirmada_en := now();
    new.cancelada_en := null;
    new.cancelada_por := null;
    new.motivo_cancelacion := null;
  elsif old.estado in ('pendiente_pago', 'confirmada') and new.estado = 'cancelada' then
    new.cancelada_en := now();
    new.cancelada_por := coalesce(new.cancelada_por, 'admin');
  elsif old.estado = 'pendiente_pago' and new.estado = 'vencida' then
    new.vencida_en := now();
  else
    raise exception 'transicion_invalida' using detail = format('%s -> %s', old.estado, new.estado);
  end if;
  return new;
end;
$$;

create trigger reservas_10_insert before insert on public.reservas
  for each row execute function public.reservas_antes_de_insertar();
create trigger reservas_10_update before update on public.reservas
  for each row execute function public.reservas_antes_de_actualizar();

-- Alimenta el outbox de mails (security definer: el admin no escribe en notificaciones)
create function public.reservas_encolar_notificaciones() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_avisos boolean := true;
  v_paso_a_confirmada boolean;
begin
  if new.origen = 'fijo' then
    select tf.avisos_por_mail into v_avisos from public.turnos_fijos tf where tf.id = new.turno_fijo_id;
  end if;

  v_paso_a_confirmada := new.estado = 'confirmada'
    and (tg_op = 'INSERT' or old.estado <> 'confirmada');

  if v_paso_a_confirmada and new.email is not null then
    if new.origen <> 'fijo' then
      insert into public.notificaciones (reserva_id, tipo)
      values (new.id, 'confirmacion')
      on conflict (reserva_id, tipo) do nothing;
    end if;
    if (new.origen <> 'fijo' or v_avisos) and new.inicio - now() > interval '5 hours' then
      insert into public.notificaciones (reserva_id, tipo, enviar_desde)
      values (new.id, 'recordatorio', new.inicio - interval '5 hours')
      on conflict (reserva_id, tipo) do nothing;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.estado in ('cancelada', 'vencida') and old.estado <> new.estado then
    update public.notificaciones
       set estado = 'descartada'
     where reserva_id = new.id and estado = 'pendiente';

    if new.estado = 'cancelada' and new.email is not null and new.inicio > now() then
      if new.origen = 'fijo' then
        if v_avisos and new.cancelada_por = 'admin'
           and coalesce(new.motivo_cancelacion, '') not in ('salteo', 'baja_turno_fijo') then
          insert into public.notificaciones (reserva_id, tipo) values (new.id, 'cancelacion')
          on conflict (reserva_id, tipo) do nothing;
        end if;
      elsif new.cancelada_por = 'admin' or old.estado = 'confirmada' then
        insert into public.notificaciones (reserva_id, tipo) values (new.id, 'cancelacion')
        on conflict (reserva_id, tipo) do nothing;
      end if;
    end if;
  end if;

  return null;
end;
$$;

create trigger reservas_20_notificaciones after insert or update of estado on public.reservas
  for each row execute function public.reservas_encolar_notificaciones();

-- =====================================================================
-- Funciones públicas (las únicas que puede usar el jugador)
-- =====================================================================
create function public.config_publica() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'nombre_club', c.nombre_club,
    'whatsapp_numero', c.whatsapp_numero,
    'dias_max_anticipacion', c.dias_max_anticipacion,
    'ventana_gracia_minutos', extract(epoch from c.ventana_gracia)::int / 60,
    'limite_cancelacion_minutos', extract(epoch from c.limite_cancelacion_usuario)::int / 60,
    'hoy', public.hoy_local())
  from public.config c;
$$;

create function public.disponibilidad(p_fecha date)
returns table (cancha_id smallint, cancha text, inicio timestamptz, fin timestamptz, precio_ars numeric, estado text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nombre, s.inicio, s.fin, s.precio_ars,
         case
           when s.inicio < now() + cfg.anticipacion_minima then 'no_disponible'
           when exists (select 1 from public.bloqueos b
                         where b.rango && tstzrange(s.inicio, s.fin, '[)')
                           and (b.cancha_id is null or b.cancha_id = c.id)) then 'no_disponible'
           when exists (select 1 from public.reservas r
                         where r.cancha_id = c.id
                           and r.rango && tstzrange(s.inicio, s.fin, '[)')
                           and (r.estado = 'confirmada'
                                or (r.estado = 'pendiente_pago' and r.vence_en > now()))) then 'ocupado'
           else 'libre'
         end
    from public.config cfg
   cross join public.slots_del_dia(p_fecha) s
   cross join public.canchas c
   where c.activa
     and p_fecha between public.hoy_local() and public.hoy_local() + cfg.dias_max_anticipacion
   order by c.orden, c.id, s.inicio;
$$;

create function public.crear_reserva(
  p_cancha_id smallint,
  p_inicio    timestamptz,
  p_nombre    text,
  p_telefono  text,
  p_email     text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cfg        public.config;
  v_fecha      date := (p_inicio at time zone 'America/Argentina/Buenos_Aires')::date;
  v_dia_op     date;
  v_fin        timestamptz;
  v_precio     numeric;
  v_reserva    public.reservas;
begin
  select * into strict v_cfg from public.config;

  if not exists (select 1 from public.canchas where id = p_cancha_id and activa) then
    raise exception 'cancha_inactiva';
  end if;

  -- El turno tiene que existir en la grilla del día o del día anterior (después de medianoche)
  select s.fin, s.precio_ars, s.dia into v_fin, v_precio, v_dia_op
    from (select x.*, v_fecha as dia from public.slots_del_dia(v_fecha) x
          union all
          select y.*, v_fecha - 1 from public.slots_del_dia(v_fecha - 1) y) s
   where s.inicio = p_inicio
   order by s.dia desc
   limit 1;
  if not found then
    raise exception 'horario_invalido';
  end if;

  if p_inicio < now() + v_cfg.anticipacion_minima
     or v_dia_op > public.hoy_local() + v_cfg.dias_max_anticipacion then
    raise exception 'fuera_de_rango';
  end if;

  if exists (select 1 from public.bloqueos b
              where b.rango && tstzrange(p_inicio, v_fin, '[)')
                and (b.cancha_id is null or b.cancha_id = p_cancha_id)) then
    raise exception 'horario_ocupado';
  end if;

  -- Serializa por teléfono para que el límite de pendientes no se pueda saltear en paralelo
  perform pg_advisory_xact_lock(hashtext('reserva-tel:' || p_telefono));
  if (select count(*) from public.reservas
       where telefono = p_telefono and estado = 'pendiente_pago' and vence_en > now())
     >= v_cfg.max_pendientes_por_telefono then
    raise exception 'demasiadas_pendientes';
  end if;

  -- Libera en el acto las pendientes ya vencidas que ocupan ese horario
  update public.reservas
     set estado = 'vencida'
   where cancha_id = p_cancha_id
     and estado = 'pendiente_pago'
     and vence_en <= now()
     and rango && tstzrange(p_inicio, v_fin, '[)');

  begin
    insert into public.reservas (cancha_id, inicio, fin, nombre, telefono, email, origen, precio_ars, vence_en)
    values (p_cancha_id, p_inicio, v_fin, btrim(p_nombre), p_telefono, nullif(btrim(p_email), ''),
            'web', v_precio, least(now() + v_cfg.ventana_gracia, p_inicio))
    returning * into v_reserva;
  exception
    when exclusion_violation then
      raise exception 'horario_ocupado';
    when check_violation then
      raise exception 'datos_invalidos';
  end;

  return jsonb_build_object(
    'id', v_reserva.id,
    'token_gestion', v_reserva.token_gestion,
    'inicio', v_reserva.inicio,
    'fin', v_reserva.fin,
    'vence_en', v_reserva.vence_en);
end;
$$;

create function public.ver_reserva(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'cancha', c.nombre,
    'inicio', r.inicio,
    'fin', r.fin,
    'estado', case when r.estado = 'pendiente_pago' and r.vence_en <= now() then 'vencida'
                   else r.estado::text end,
    'nombre', r.nombre,
    'vence_en', r.vence_en,
    'precio_ars', r.precio_ars,
    'origen', r.origen,
    'cancelada_por', r.cancelada_por,
    'puede_cancelar',
      (r.estado = 'pendiente_pago' and r.vence_en > now() and r.inicio > now())
      or (r.estado = 'confirmada' and r.inicio - now() >= cfg.limite_cancelacion_usuario))
  from public.reservas r
  join public.canchas c on c.id = r.cancha_id
  cross join public.config cfg
  where r.token_gestion = p_token;
$$;

create function public.cancelar_reserva(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cfg public.config;
  v_r   public.reservas;
begin
  select * into strict v_cfg from public.config;
  select * into v_r from public.reservas where token_gestion = p_token for update;
  if not found then
    raise exception 'no_encontrada';
  end if;

  if v_r.estado = 'cancelada' then
    raise exception 'ya_cancelada';
  end if;
  if v_r.estado = 'vencida' or (v_r.estado = 'pendiente_pago' and v_r.vence_en <= now()) then
    raise exception 'vencida';
  end if;
  if v_r.inicio <= now() then
    raise exception 'fuera_de_plazo';
  end if;
  -- Una pendiente se puede soltar siempre; una confirmada, solo hasta el límite
  if v_r.estado = 'confirmada' and v_r.inicio - now() < v_cfg.limite_cancelacion_usuario then
    raise exception 'fuera_de_plazo';
  end if;

  update public.reservas
     set estado = 'cancelada', cancelada_por = 'usuario', motivo_cancelacion = 'cancelada_por_usuario'
   where id = v_r.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- =====================================================================
-- Turnos fijos (solo admin)
-- =====================================================================
create function public.generar_turnos_fijos(p_hasta date default null, p_turno_fijo_id bigint default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_hoy     date := public.hoy_local();
  v_hasta   date;
  v_desde   date;
  v_limite  date;
  v_f       date;
  v_inicio  timestamptz;
  v_fin     timestamptz;
  v_choque  uuid;
  v_creadas int := 0;
  v_n       int;
  tf        public.turnos_fijos;
begin
  perform public.exigir_admin();
  v_hasta := coalesce(p_hasta, v_hoy + (select dias_max_anticipacion from public.config) + 14);

  for tf in
    select * from public.turnos_fijos t
     where t.dado_de_baja_en is null
       and (t.vigente_hasta is null or t.vigente_hasta >= v_hoy)
       and (p_turno_fijo_id is null or t.id = p_turno_fijo_id)
     for update
  loop
    v_desde  := greatest(tf.vigente_desde, coalesce(tf.generado_hasta + 1, tf.vigente_desde), v_hoy);
    v_limite := least(coalesce(tf.vigente_hasta, v_hasta), v_hasta);
    continue when v_desde > v_limite;

    v_f := v_desde + ((tf.dia_semana - extract(isodow from v_desde)::int + 7) % 7);
    while v_f <= v_limite loop
      v_inicio := (v_f + tf.hora_inicio) at time zone 'America/Argentina/Buenos_Aires';
      v_fin    := v_inicio + tf.duracion;

      if v_inicio > now()
         and not exists (select 1 from public.turno_fijo_excepciones e
                          where e.turno_fijo_id = tf.id and e.fecha = v_f) then
        if exists (select 1 from public.dias_especiales d where d.fecha = v_f and d.cerrado)
           or exists (select 1 from public.bloqueos b
                       where b.rango && tstzrange(v_inicio, v_fin, '[)')
                         and (b.cancha_id is null or b.cancha_id = tf.cancha_id)) then
          insert into public.turno_fijo_excepciones (turno_fijo_id, fecha, tipo, detalle)
          values (tf.id, v_f, 'cierre', 'club cerrado o bloqueo')
          on conflict do nothing;
        else
          begin
            insert into public.reservas (cancha_id, inicio, fin, nombre, telefono, email,
                                         estado, origen, turno_fijo_id, precio_ars)
            values (tf.cancha_id, v_inicio, v_fin, tf.nombre, tf.telefono, tf.email,
                    'confirmada', 'fijo', tf.id, tf.precio_ars)
            on conflict (turno_fijo_id, inicio) do nothing;
            get diagnostics v_n = row_count;
            v_creadas := v_creadas + v_n;
          exception when exclusion_violation then
            select r.id into v_choque from public.reservas r
             where r.cancha_id = tf.cancha_id
               and r.estado in ('pendiente_pago', 'confirmada')
               and r.rango && tstzrange(v_inicio, v_fin, '[)')
             limit 1;
            insert into public.turno_fijo_excepciones (turno_fijo_id, fecha, tipo, detalle)
            values (tf.id, v_f, 'conflicto', v_choque::text)
            on conflict do nothing;
          end;
        end if;
      end if;
      v_f := v_f + 7;
    end loop;

    update public.turnos_fijos
       set generado_hasta = greatest(coalesce(generado_hasta, v_limite), v_limite)
     where id = tf.id;
  end loop;

  return v_creadas;
end;
$$;

-- Vista previa antes de dar de alta: próximas fechas y con qué chocan. No escribe nada.
create function public.previsualizar_turno_fijo(
  p_cancha_id     smallint,
  p_dia_semana    smallint,
  p_hora_inicio   time,
  p_vigente_desde date,
  p_semanas       int default 8
) returns table (fecha date, inicio timestamptz, fin timestamptz, motivo text,
                 conflicto_reserva_id uuid, conflicto_nombre text, conflicto_estado text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  v_dur   interval;
  v_desde date := greatest(p_vigente_desde, public.hoy_local());
  v_f     date;
begin
  perform public.exigir_admin();
  v_dur := public.duracion_en_grilla_semanal(p_dia_semana, p_hora_inicio);
  if v_dur is null then
    raise exception 'horario_invalido' using detail = 'la hora no coincide con un turno de la grilla de ese día';
  end if;

  v_f := v_desde + ((p_dia_semana - extract(isodow from v_desde)::int + 7) % 7);
  for i in 1..p_semanas loop
    fecha  := v_f;
    inicio := (v_f + p_hora_inicio) at time zone 'America/Argentina/Buenos_Aires';
    fin    := inicio + v_dur;
    motivo := null; conflicto_reserva_id := null; conflicto_nombre := null; conflicto_estado := null;

    if exists (select 1 from public.dias_especiales d where d.fecha = v_f and d.cerrado) then
      motivo := 'club_cerrado';
    elsif exists (select 1 from public.bloqueos b
                   where b.rango && tstzrange(inicio, fin, '[)')
                     and (b.cancha_id is null or b.cancha_id = p_cancha_id)) then
      motivo := 'bloqueo';
    else
      select r.id, r.nombre, r.estado::text
        into conflicto_reserva_id, conflicto_nombre, conflicto_estado
        from public.reservas r
       where r.cancha_id = p_cancha_id
         and r.rango && tstzrange(inicio, fin, '[)')
         and (r.estado = 'confirmada' or (r.estado = 'pendiente_pago' and r.vence_en > now()))
       limit 1;
      if conflicto_reserva_id is not null then
        motivo := 'conflicto';
      end if;
    end if;

    return next;
    v_f := v_f + 7;
  end loop;
end;
$$;

create function public.crear_turno_fijo(
  p_cancha_id       smallint,
  p_dia_semana      smallint,
  p_hora_inicio     time,
  p_nombre          text,
  p_telefono        text,
  p_email           text,
  p_avisos_por_mail boolean,
  p_precio_ars      numeric,
  p_vigente_desde   date,
  p_vigente_hasta   date,
  p_notas           text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_dur interval;
  v_id  bigint;
  v_n   int;
  v_conflictos int;
begin
  perform public.exigir_admin();
  v_dur := public.duracion_en_grilla_semanal(p_dia_semana, p_hora_inicio);
  if v_dur is null then
    raise exception 'horario_invalido';
  end if;

  insert into public.turnos_fijos (cancha_id, dia_semana, hora_inicio, duracion, nombre, telefono, email,
                                   avisos_por_mail, precio_ars, vigente_desde, vigente_hasta, notas)
  values (p_cancha_id, p_dia_semana, p_hora_inicio, v_dur, btrim(p_nombre), p_telefono,
          nullif(btrim(p_email), ''), p_avisos_por_mail, p_precio_ars, p_vigente_desde, p_vigente_hasta,
          nullif(btrim(p_notas), ''))
  returning id into v_id;

  v_n := public.generar_turnos_fijos(null, v_id);
  select count(*) into v_conflictos from public.turno_fijo_excepciones
   where turno_fijo_id = v_id and tipo = 'conflicto';

  return jsonb_build_object('id', v_id, 'fechas_creadas', v_n, 'conflictos', v_conflictos);
end;
$$;

create function public.saltear_fecha_fija(p_turno_fijo_id bigint, p_fecha date, p_motivo text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_r public.reservas;
begin
  perform public.exigir_admin();
  select r.* into v_r from public.reservas r
   where r.turno_fijo_id = p_turno_fijo_id
     and (r.inicio at time zone 'America/Argentina/Buenos_Aires')::date = p_fecha
   for update;

  if found then
    if v_r.estado = 'confirmada' then
      update public.reservas
         set estado = 'cancelada', cancelada_por = 'admin', motivo_cancelacion = 'salteo',
             notas_admin = coalesce(nullif(btrim(p_motivo), ''), notas_admin)
       where id = v_r.id;
    end if;
  else
    insert into public.turno_fijo_excepciones (turno_fijo_id, fecha, tipo, detalle)
    values (p_turno_fijo_id, p_fecha, 'salteo', nullif(btrim(p_motivo), ''))
    on conflict (turno_fijo_id, fecha) do update set tipo = 'salteo', detalle = excluded.detalle;
  end if;
end;
$$;

-- Reactiva una fecha salteada o en conflicto: borra la excepción y, si la reserva estaba
-- cancelada por salteo, crea una nueva para esa fecha (si el horario sigue libre).
create function public.reactivar_fecha_fija(p_turno_fijo_id bigint, p_fecha date)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  tf       public.turnos_fijos;
  v_inicio timestamptz;
  v_activa boolean;
begin
  perform public.exigir_admin();
  select * into strict tf from public.turnos_fijos where id = p_turno_fijo_id;
  delete from public.turno_fijo_excepciones where turno_fijo_id = tf.id and fecha = p_fecha;

  v_inicio := (p_fecha + tf.hora_inicio) at time zone 'America/Argentina/Buenos_Aires';
  select exists (select 1 from public.reservas
                  where turno_fijo_id = tf.id and inicio = v_inicio and estado = 'confirmada')
    into v_activa;
  if v_activa then
    return 'ya_activa';
  end if;

  -- Si la fecha ya existe como fila cancelada, se la vuelve a confirmar (misma fila).
  -- Si en el medio otro tomó el horario, la exclusion constraint lo impide y queda en conflicto.
  if exists (select 1 from public.reservas where turno_fijo_id = tf.id and inicio = v_inicio) then
    begin
      update public.reservas
         set estado = 'confirmada', nombre = tf.nombre, telefono = tf.telefono, email = tf.email
       where turno_fijo_id = tf.id and inicio = v_inicio and estado = 'cancelada';
    exception when exclusion_violation then
      insert into public.turno_fijo_excepciones (turno_fijo_id, fecha, tipo, detalle)
      values (tf.id, p_fecha, 'conflicto', 'el horario ya fue reservado');
      return 'conflicto';
    end;
    -- El recordatorio descartado al saltear vuelve a quedar pendiente
    update public.notificaciones
       set estado = 'pendiente', enviar_desde = v_inicio - interval '5 hours', intentos = 0, ultimo_error = null
     where reserva_id = (select id from public.reservas where turno_fijo_id = tf.id and inicio = v_inicio)
       and tipo = 'recordatorio' and estado = 'descartada'
       and tf.avisos_por_mail and v_inicio - interval '5 hours' > now();
    return 'reactivada';
  end if;

  if tf.generado_hasta is not null and p_fecha <= tf.generado_hasta then
    update public.turnos_fijos set generado_hasta = p_fecha - 1 where id = tf.id;
  end if;
  perform public.generar_turnos_fijos(null, tf.id);

  if exists (select 1 from public.turno_fijo_excepciones
              where turno_fijo_id = tf.id and fecha = p_fecha and tipo = 'conflicto') then
    return 'conflicto';
  end if;
  return 'reactivada';
end;
$$;

create function public.dar_de_baja_turno_fijo(p_turno_fijo_id bigint, p_desde date)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  perform public.exigir_admin();
  update public.turnos_fijos
     set vigente_hasta = p_desde - 1,
         dado_de_baja_en = case when p_desde <= public.hoy_local() then now() else dado_de_baja_en end
   where id = p_turno_fijo_id;

  update public.reservas
     set estado = 'cancelada', cancelada_por = 'admin', motivo_cancelacion = 'baja_turno_fijo'
   where turno_fijo_id = p_turno_fijo_id
     and estado = 'confirmada'
     and (inicio at time zone 'America/Argentina/Buenos_Aires')::date >= p_desde
     and inicio > now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create function public.editar_contacto_turno_fijo(
  p_turno_fijo_id   bigint,
  p_nombre          text,
  p_telefono        text,
  p_email           text,
  p_avisos_por_mail boolean,
  p_notas           text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  update public.turnos_fijos
     set nombre = btrim(p_nombre), telefono = p_telefono, email = nullif(btrim(p_email), ''),
         avisos_por_mail = p_avisos_por_mail, notas = nullif(btrim(p_notas), '')
   where id = p_turno_fijo_id;

  update public.reservas
     set nombre = btrim(p_nombre), telefono = p_telefono, email = nullif(btrim(p_email), '')
   where turno_fijo_id = p_turno_fijo_id and inicio > now();
end;
$$;

-- =====================================================================
-- Worker de mails: reclamo atómico (solo service_role)
-- =====================================================================
create function public.reclamar_notificaciones(p_limite int default 20)
returns setof public.notificaciones
language sql security definer set search_path = '' as $$
  update public.notificaciones n
     set estado = 'enviando', reclamada_en = now(), intentos = n.intentos + 1
   where n.id in (
     select id from public.notificaciones
      where (estado = 'pendiente' and enviar_desde <= now())
         or (estado = 'enviando'  and reclamada_en < now() - interval '5 minutes')
      order by enviar_desde
      for update skip locked
      limit p_limite)
  returning n.*;
$$;

-- =====================================================================
-- Permisos sobre funciones
-- Supabase da EXECUTE a anon y authenticated por defecto: se revoca todo
-- y se habilita solo lo que corresponde.
-- =====================================================================
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.config_publica()                         to anon, authenticated;
grant execute on function public.disponibilidad(date)                     to anon, authenticated;
grant execute on function public.crear_reserva(smallint, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.ver_reserva(text)                        to anon, authenticated;
grant execute on function public.cancelar_reserva(text)                   to anon, authenticated;

grant execute on function public.es_admin()                               to authenticated;
grant execute on function public.hoy_local()                              to anon, authenticated;
grant execute on function public.slots_del_dia(date)                      to authenticated;
grant execute on function public.generar_turnos_fijos(date, bigint)       to authenticated;
grant execute on function public.previsualizar_turno_fijo(smallint, smallint, time, date, int) to authenticated;
grant execute on function public.crear_turno_fijo(smallint, smallint, time, text, text, text, boolean, numeric, date, date, text) to authenticated;
grant execute on function public.saltear_fecha_fija(bigint, date, text)   to authenticated;
grant execute on function public.reactivar_fecha_fija(bigint, date)       to authenticated;
grant execute on function public.dar_de_baja_turno_fijo(bigint, date)    to authenticated;
grant execute on function public.editar_contacto_turno_fijo(bigint, text, text, text, boolean, text) to authenticated;

grant execute on function public.reclamar_notificaciones(int)             to service_role;

-- Las funciones internas usadas por RLS y por las funciones de arriba tienen que poder
-- ejecutarse dentro de las políticas.
grant execute on function public.exigir_admin()                           to authenticated;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.config                 enable row level security;
alter table public.canchas                enable row level security;
alter table public.franjas_semanales      enable row level security;
alter table public.dias_especiales        enable row level security;
alter table public.bloqueos               enable row level security;
alter table public.reservas               enable row level security;
alter table public.notificaciones         enable row level security;
alter table public.admins                 enable row level security;
alter table public.turnos_fijos           enable row level security;
alter table public.turno_fijo_excepciones enable row level security;

-- anon no tiene ningún privilegio directo sobre tablas
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

create policy admin_all on public.config                 for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy admin_all on public.canchas                for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy admin_all on public.franjas_semanales      for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy admin_all on public.dias_especiales        for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy admin_all on public.bloqueos               for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy admin_all on public.turnos_fijos           for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy admin_all on public.turno_fijo_excepciones for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Reservas: el admin lee, crea (manuales) y actualiza. Nadie borra.
create policy admin_select on public.reservas for select to authenticated using (public.es_admin());
create policy admin_insert on public.reservas for insert to authenticated with check (public.es_admin() and origen = 'admin');
create policy admin_update on public.reservas for update to authenticated using (public.es_admin()) with check (public.es_admin());

create policy admin_select on public.notificaciones for select to authenticated using (public.es_admin());
create policy self_select  on public.admins         for select to authenticated using (user_id = (select auth.uid()));

-- Realtime para el panel (respeta RLS)
alter publication supabase_realtime add table public.reservas;
