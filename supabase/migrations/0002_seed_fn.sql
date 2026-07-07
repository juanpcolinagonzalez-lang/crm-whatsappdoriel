-- ═══════════════════════════════════════════════════════════════════════
-- 0002_seed_fn.sql — Inicialización de una organización nueva.
-- Los LABELS quedan editables desde el panel; el 'role' es el invariante.
-- Llamar una vez al dar de alta la org (onboarding).
-- ═══════════════════════════════════════════════════════════════════════

create or replace function seed_organization_defaults(
  p_org uuid,
  p_brand text default 'la marca',
  p_agent_name text default 'Asistente'
) returns void
  language plpgsql security definer set search_path = public as $$
begin
  -- Config del negocio (fila única)
  insert into business_config (organization_id, agent_name, brand_name)
  values (p_org, p_agent_name, p_brand)
  on conflict (organization_id) do nothing;

  -- Columnas del Kanban por defecto (label editable, role estable, orden = avance)
  insert into pipeline_stages (organization_id, label, role, position, expire_after_days)
  values
    (p_org, 'Nuevo',           'new',             0,  30),
    (p_org, 'Preguntón',       'engaged',         1,  30),
    (p_org, 'Interesado',      'interested',      2,  21),
    (p_org, 'Pago pendiente',  'payment_pending', 3,  7),
    (p_org, 'Vendido',         'sold',            4,  null),
    (p_org, 'Post-venta',      'post_sale',       5,  null),
    (p_org, 'Cliente feliz',   'happy',           6,  null),
    (p_org, 'Perdido / Frío',  'lost',            7,  null)
  on conflict (organization_id, position) do nothing;
end $$;
