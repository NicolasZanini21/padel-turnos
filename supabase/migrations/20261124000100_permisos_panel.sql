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
