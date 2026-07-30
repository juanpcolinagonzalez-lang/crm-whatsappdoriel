-- 0005_knowledge.sql — Base de conocimiento de productos que consulta el agente.
-- Dos niveles: lineas de producto y productos. Es la fuente de verdad interna
-- (regla dura 1: si no esta aca, el agente no lo inventa). Si hay ecommerce
-- conectado, consultar_producto complementa con precio/stock EN VIVO de
-- Tiendanube, pero la EXISTENCIA del producto la decide esta tabla.

create table product_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create index on product_lines (organization_id);

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_line_id uuid not null references product_lines(id) on delete cascade,
  name text not null,
  description text,
  colors text,
  link text,
  price numeric,
  created_at timestamptz not null default now()
);
create index on products (organization_id);
create index on products (product_line_id);

alter table product_lines enable row level security;
alter table products enable row level security;

create policy org_isolation on product_lines for all
  using (organization_id = auth_org_id())
  with check (organization_id = auth_org_id());

create policy org_isolation on products for all
  using (organization_id = auth_org_id())
  with check (organization_id = auth_org_id());
