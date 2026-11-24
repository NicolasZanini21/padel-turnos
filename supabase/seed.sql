-- Datos semilla. Los valores marcados [SUPUESTO] se cambian acá o desde /admin/configuracion.

-- WhatsApp del club (formato wa.me, solo dígitos)
insert into public.config (whatsapp_numero) values ('5493417560704')
on conflict (id) do nothing;

insert into public.canchas (nombre, orden)
values ('Cancha 1', 1), ('Cancha 2', 2), ('Cancha 3', 3), ('Cancha 4', 4)
on conflict (nombre) do nothing;

-- [SUPUESTO] lunes a viernes 08:00 a 00:30, sábado y domingo 09:00 a 00:00, turnos de 90 minutos
insert into public.franjas_semanales (dia_semana, apertura, cierre, duracion_turno)
select d, time '08:00', time '00:30', interval '90 minutes' from generate_series(1, 5) d
union all
select d, time '09:00', time '00:00', interval '90 minutes' from generate_series(6, 7) d;
