-- ═══════════════════════════════════════════════════════════════════════
-- 0001_init.sql — Schema base del CRM conversacional
-- Multi-tenant desde el día uno (RLS por organization_id en TODAS las tablas).
-- Tres tipos de estado que NO se mezclan (ver CLAUDE.md):
--   · venta     -> pipeline_stages + leads      (el Kanban)
--   · logístico -> orders                        (dato, NO columna)
--   · ciclo     -> tags                          (segmento, NO tablero)
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- Organizaciones y usuarios
-- ─────────────────────────────────────────────────────────────
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create type user_role as enum ('admin', 'asesor');

create table profiles (
  id              uuid primary key references auth.users on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  email           text unique,
  full_name       text,
  role            user_role not null default 'asesor',
  created_at      timestamptz not null default now()
);

-- Devuelve la org del usuario autenticado. Base de TODA la RLS.
create or replace function auth_org_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid()
$$;

-- ─────────────────────────────────────────────────────────────
-- Configuración del negocio (los textos son DATOS, no código)
-- Fila única por organización: prompt base + info del negocio (JSON =
-- única fuente de verdad de las políticas) + llaves operativas.
-- ─────────────────────────────────────────────────────────────
create table business_config (
  organization_id uuid primary key references organizations(id) on delete cascade,
  agent_name      text not null default 'Asistente',   -- UN nombre humano propio
  brand_name      text not null default 'la marca',
  wa_phone_number_id text unique,                        -- mapea el webhook -> org
  base_prompt     text not null default '',             -- identidad, tono, estilo
  business_info   jsonb not null default '{}'::jsonb,    -- pagos, envíos, precios ref, políticas
  followup_enabled boolean not null default true,        -- llave global de seguimiento
  updated_at      timestamptz not null default now()
);

-- Notas / correcciones del dueño. TODAS las activas se inyectan al prompt.
create table agent_notes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  body            text not null,
  active          boolean not null default true,
  source          text not null default 'owner',   -- 'owner' | 'qa'
  created_at      timestamptz not null default now()
);
create index on agent_notes (organization_id) where active;

-- ─────────────────────────────────────────────────────────────
-- Kanban: estado de VENTA. Único tablero que se mueve.
-- 'role' es el invariante que usa el código (label es editable).
-- ─────────────────────────────────────────────────────────────
create type stage_role as enum (
  'new', 'engaged', 'interested', 'payment_pending',
  'sold', 'post_sale', 'happy', 'lost'
);

create table pipeline_stages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  label           text not null,                 -- editable desde el panel
  role            stage_role,                    -- semántica estable (puede ser null en columnas custom)
  position        integer not null,              -- orden: define "avanza, no retrocede"
  expire_after_days integer,                     -- higiene del Kanban (null = no vence)
  created_at      timestamptz not null default now(),
  unique (organization_id, position)
);

-- ─────────────────────────────────────────────────────────────
-- Contactos y conversaciones
-- Dedup de contactos por últimos dígitos del teléfono.
-- Conversación canónica = la MÁS ANTIGUA (created_at asc).
-- ─────────────────────────────────────────────────────────────
create table contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  phone           text not null,                 -- E.164, solo dígitos
  phone_tail      text not null,                 -- últimos 8 dígitos, para dedup
  profile_name    text,                          -- nombre del perfil de WhatsApp
  opt_in          boolean not null default false, -- consentimiento para iniciar contacto
  created_at      timestamptz not null default now(),
  unique (organization_id, phone_tail)
);

create table conversations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  channel         text not null default 'whatsapp',
  bot_paused_until timestamptz,                   -- pausa humana (eco / intervención)
  closed          boolean not null default false,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz
);
create index on conversations (contact_id, created_at);

create type message_sender as enum ('customer', 'bot', 'human');

create table messages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender          message_sender not null,
  body            text,                          -- texto o placeholder "[procesando…]"
  media_url       text,                          -- media ya subida a Storage propio
  media_type      text,
  -- raw.kind = 'marketing' | 'followup' marca los envíos automáticos:
  -- el agente los ignora para freshStart y el QA no se los atribuye.
  raw             jsonb not null default '{}'::jsonb,
  wa_message_id   text,                          -- id de Meta, para idempotencia/dedup de ecos
  created_at      timestamptz not null default now()
);
create index on messages (conversation_id, created_at);
create index on messages (organization_id, wa_message_id);

-- ─────────────────────────────────────────────────────────────
-- Leads (una tarjeta por contacto en el Kanban)
-- ─────────────────────────────────────────────────────────────
create table leads (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  stage_id        uuid not null references pipeline_stages(id),
  last_activity_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (organization_id, contact_id)
);
create index on leads (stage_id);

-- ─────────────────────────────────────────────────────────────
-- Tags: estado del CICLO DE VIDA. Segmento, NO tablero.
-- ─────────────────────────────────────────────────────────────
create table tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  unique (organization_id, name)
);

create table contact_tags (
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id     uuid not null references tags(id) on delete cascade,
  primary key (contact_id, tag_id)
);

-- ─────────────────────────────────────────────────────────────
-- Estado LOGÍSTICO: orders sincronizadas del ecommerce. NO es columna.
-- ─────────────────────────────────────────────────────────────
create table orders (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  contact_id         uuid references contacts(id) on delete set null,
  external_id        text not null,              -- id del pedido en la plataforma
  status_raw         text,                       -- string crudo de la plataforma (nunca se muestra crudo)
  payment_method     text,                       -- 'transfer'|'offline'|'card'|'gateway' (gate de "pago pendiente")
  total              numeric,
  currency           text,
  data               jsonb not null default '{}'::jsonb,
  updated_at         timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  unique (organization_id, external_id)
);
create index on orders (contact_id);

-- Conexión OAuth con el ecommerce. Token CIFRADO (AES-256-GCM).
create table ecommerce_connections (
  organization_id uuid primary key references organizations(id) on delete cascade,
  platform        text not null default 'tiendanube',
  store_id        text not null,
  access_token_enc text not null,               -- cifrado, nunca en claro
  connected_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Plantillas de Meta y cola de envíos automáticos
-- ─────────────────────────────────────────────────────────────
create type template_category as enum ('utility', 'marketing');

create table message_templates (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  trigger           text not null,              -- 'order_confirmed'|'shipped'|'abandoned_cart'|...
  meta_name         text not null,              -- name aprobado en Meta
  language          text not null,              -- EXACTO al aprobado (es ≠ es_AR)
  category          template_category not null,
  default_variables jsonb not null default '{}'::jsonb, -- valores fijos (ej. cupón)
  body              text not null,              -- copia legible que se registra en el chat
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (organization_id, trigger)
);

create type send_status as enum ('queued', 'sent', 'skipped', 'failed');

create table template_sends (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  contact_id       uuid not null references contacts(id) on delete cascade,
  template_id      uuid not null references message_templates(id),
  trigger          text not null,
  variables        jsonb not null default '{}'::jsonb,
  status           send_status not null default 'queued',
  send_after       timestamptz not null default now(),  -- espera acumulativa del flujo
  attempts         integer not null default 0,
  last_error       text,
  dedup_key        text not null,              -- gatillo+contacto, para anti-duplicado
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);
create index on template_sends (status, send_after);
-- Anti-duplicado: una fila viva por dedup_key dentro de la ventana.
create index on template_sends (organization_id, dedup_key, created_at);

-- ─────────────────────────────────────────────────────────────
-- QA nocturno: notas accionables por chat revisado
-- ─────────────────────────────────────────────────────────────
create table qa_reviews (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  conversation_id  uuid not null references conversations(id) on delete cascade,
  failure          text,                        -- "en qué falló"
  suggestion       text,                        -- "mejora sugerida"
  resolved         boolean not null default false,
  reviewed_at      timestamptz not null default now(),
  unique (organization_id, conversation_id, reviewed_at)
);

-- ═══════════════════════════════════════════════════════════════════════
-- RLS: activada en TODAS las tablas. Política uniforme por organization_id.
-- El service_role (webhooks/crons) bypassa RLS; el cliente SSR pasa por acá.
-- ═══════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','profiles','business_config','agent_notes','pipeline_stages',
    'contacts','conversations','messages','leads','tags','contact_tags','orders',
    'ecommerce_connections','message_templates','template_sends','qa_reviews'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- organizations / profiles: el usuario ve su propia org.
create policy org_self on organizations for all
  using (id = auth_org_id()) with check (id = auth_org_id());
create policy prof_self on profiles for all
  using (organization_id = auth_org_id()) with check (organization_id = auth_org_id());

-- Resto de tablas con columna organization_id: misma política.
do $$
declare t text;
begin
  foreach t in array array[
    'business_config','agent_notes','pipeline_stages','contacts','conversations',
    'messages','leads','tags','orders','ecommerce_connections',
    'message_templates','template_sends','qa_reviews'
  ] loop
    execute format(
      'create policy org_isolation on %I for all
         using (organization_id = auth_org_id())
         with check (organization_id = auth_org_id())', t);
  end loop;
end $$;

-- contact_tags no tiene organization_id: se resuelve por el contacto.
create policy org_isolation on contact_tags for all
  using (exists (select 1 from contacts c where c.id = contact_id and c.organization_id = auth_org_id()))
  with check (exists (select 1 from contacts c where c.id = contact_id and c.organization_id = auth_org_id()));

-- ─────────────────────────────────────────────────────────────
-- Trigger: al crear un usuario en auth, crear su profile.
-- La organización se pasa por raw_user_meta_data.organization_id
-- (el flujo de invitación/alta la resuelve).
-- ─────────────────────────────────────────────────────────────
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, organization_id, email, full_name, role)
  values (
    new.id,
    (new.raw_user_meta_data->>'organization_id')::uuid,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'asesor')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
