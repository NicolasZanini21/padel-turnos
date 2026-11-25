-- =====================================================================
-- BORRAR DATOS DE DEMO
-- ---------------------------------------------------------------------
-- Supabase → SQL Editor → New query → pegar todo → Run.
-- Borra solo lo marcado con [DEMO] por cargar-demo.sql.
-- Las reservas reales (las de la web y las que cargó el club) no se tocan.
-- =====================================================================

delete from public.reservas
 where notas_admin = '[DEMO]'
    or turno_fijo_id in (select id from public.turnos_fijos where notas = '[DEMO]');

delete from public.turnos_fijos where notas = '[DEMO]';

select 'Listo: se borraron los datos de demo' as resultado;
