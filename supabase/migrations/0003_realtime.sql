-- ═══════════════════════════════════════════════════════════════════════
-- 0003_realtime.sql — Habilita Realtime para que la bandeja se actualice en
-- vivo (mensajes nuevos y movimientos de leads) por canal autenticado.
-- ═══════════════════════════════════════════════════════════════════════

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table leads;
