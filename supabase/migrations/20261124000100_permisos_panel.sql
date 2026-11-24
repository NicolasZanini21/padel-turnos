-- Permisos de tabla para el panel del club (rol authenticated).
-- Los proyectos nuevos de Supabase ya no dan acceso automático a las tablas de public:
-- sin estos grants el panel recibe "permission denied" y muestra todo vacío.
-- La seguridad la sigue poniendo RLS: todas estas tablas solo dejan pasar a un admin (es_admin()).

grant usage on schema public to authenticated;

grant select, update                 on public.config                 to authenticated;
grant select, update                 on public.canchas                to authenticated;
grant select, insert, delete         on public.franjas_semanales      to authenticated;
grant select, insert, update, delete on public.dias_especiales        to authenticated;
grant select, insert, delete         on public.bloqueos               to authenticated;
grant select, insert, update         on public.reservas               to authenticated;
grant select                         on public.notificaciones         to authenticated;
grant select                         on public.admins                 to authenticated;
grant select, insert, update         on public.turnos_fijos           to authenticated;
grant select, insert, update, delete on public.turno_fijo_excepciones to authenticated;

-- Permisos para la función de mails (procesar-notificaciones), que usa la service role.
-- Sin estos grants reclama el mail, no puede leer la reserva y lo deja trabado en "enviando".
grant usage on schema public to service_role;
grant select                 on public.config         to service_role;
grant select                 on public.canchas        to service_role;
grant select                 on public.reservas       to service_role;
grant select, update         on public.notificaciones to service_role;
