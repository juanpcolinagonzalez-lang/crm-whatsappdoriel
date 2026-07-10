-- 0004_urgent_leads.sql — Prioridad para reclamos urgentes en post-venta.
-- El agente marca is_urgent = true cuando abrir_postventa detecta palabras
-- clave de urgencia real (roto, estafa, reclamo, etc). El Kanban ordena
-- primero los leads urgentes dentro de cada columna.

alter table leads add column if not exists is_urgent boolean not null default false;

create index if not exists leads_is_urgent_idx on leads (organization_id, is_urgent);
