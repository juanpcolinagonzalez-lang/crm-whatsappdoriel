# CRM WhatsApp

CRM conversacional para vender por WhatsApp: bandeja de chats, Kanban de leads,
agente de IA que atiende, envíos automáticos por plantillas de Meta y post-venta.
Stack: Next.js 14 (App Router) + TypeScript estricto + Tailwind + Supabase + Vercel,
con la **WhatsApp Cloud API oficial de Meta** (sin intermediarios) y **Tiendanube**
como ecommerce.

Este repo tiene el **esqueleto (etapa 1)** con toda la lógica de backend más la
**UI base (etapa 2)**: login, bandeja en vivo, tablero Kanban y ajustes. Lo que
todavía falta (media entrante, catálogo real, bot admin de Telegram) está listado
como backlog accionable en [`CLAUDE.md`](CLAUDE.md).

## Qué ya está hecho

- **Base de datos completa** con RLS multi-tenant (`supabase/migrations/`): los tres
  tipos de estado separados (venta = Kanban, logístico = orders, ciclo = tags).
- **Adaptador de transporte** de WhatsApp Cloud detrás de una interfaz única
  (`src/lib/transport/`). Cambiar de canal toca solo el adaptador.
- **Webhook de WhatsApp** (`/api/webhooks/whatsapp`): handshake GET, eventos POST,
  siempre responde 200, idempotencia por `wa_message_id`, manejo de ecos.
- **Agente de IA** (`src/lib/agent/`): prompt de 3 capas (config + notas + reglas
  duras), herramientas (consulta en vivo + acciones silenciosas del Kanban), cadena
  de modelos con **fallback** y reintentos, y **autorrevisión** del borrador.
- **Cola de envíos** (`src/lib/queue/`): encolar con opt-in + anti-duplicado; despacho
  con **gates de etapa y condición** justo antes de mandar.
- **Tiendanube** (`src/lib/ecommerce/`): OAuth con token cifrado (AES-256-GCM),
  webhook con validación HMAC, sync de pedidos y estados traducidos.
- **Crons** (`/api/cron/*`): despacho (5 min), carrito abandonado, seguimiento,
  vencimiento de leads, y QA nocturno. Protegidos con `CRON_SECRET`.
- **UI** (`src/app/(app)/`): login con Supabase Auth, bandeja de chats en vivo
  (Realtime) con caja de respuesta, tablero Kanban con drag & drop, y ajustes
  para editar el prompt del agente, la info del negocio y las notas del dueño.

## Setup paso a paso

### 1. Instalar

```bash
npm install
cp .env.example .env.local
```

### 2. Cargar las variables (`.env.local`)

Generá los secretos:

```bash
openssl rand -hex 32   # -> ENCRYPTION_KEY (32 bytes)
openssl rand -hex 24   # -> CRON_SECRET
```

Completá el resto con tus credenciales de Supabase, Meta y Tiendanube
(ya tenés Supabase + Meta creados). El `WHATSAPP_TOKEN` tiene que ser el
**token permanente de System User**, no el temporal (vence a las 24 h).

### 3. Correr las migraciones

En el **SQL editor** de Supabase, aplicá en orden:

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_seed_fn.sql
```

Después, creá tu organización y sembrá sus columnas por defecto:

```sql
insert into organizations (name) values ('ZW Labs') returning id;
-- con ese id:
select seed_organization_defaults('<ORG_ID>', 'Doriel Store', 'Sol');
-- vinculá tu número de WhatsApp a la org:
update business_config
  set wa_phone_number_id = '<TU_PHONE_NUMBER_ID>'
  where organization_id = '<ORG_ID>';
```

### 4. Levantar en local

```bash
npm run dev
```

### 5. Conectar el webhook de WhatsApp

En el panel de Meta (WhatsApp → Configuration → Webhook):

- **Callback URL**: `https://TU-DOMINIO/api/webhooks/whatsapp`
- **Verify token**: el mismo string que pusiste en `WHATSAPP_VERIFY_TOKEN`
- Suscribite al campo `messages`.

Para probar en local, exponé el puerto con un túnel (ngrok/cloudflared) y usá esa URL.

### 6. Conectar Tiendanube

Entrá logueado a `/api/oauth/tiendanube/start` — te manda a instalar la app y el
callback guarda el token cifrado. Configurá los webhooks de pedido en la app de
Tiendanube apuntando a `/api/webhooks/tiendanube`.

### 7. Deploy

```bash
git init && git add . && git commit -m "esqueleto CRM"
git push   # a tu repo -> Vercel deploya solo
```

Cargá las env vars en el panel de Vercel (production, no solo preview). Los crons
del `vercel.json` se activan solos.

## Comandos

```bash
npm run dev        # desarrollo
npm run typecheck  # tsc --noEmit (correr antes de cada push)
npm run build      # build de producción
```

## Estructura

```
src/
  app/
    (auth)/login              # login (placeholder UI)
    (app)/                    # dashboard protegido (bandeja, kanban, ajustes)
    api/webhooks/whatsapp     # recepción de WhatsApp
    api/webhooks/tiendanube   # pedidos del ecommerce
    api/oauth/tiendanube      # conexión OAuth
    api/cron/*                # procesos automáticos
  lib/
    transport/                # adaptador de canal (WhatsApp Cloud)
    agent/                    # prompt, reglas, herramientas, modelos, review
    inbound/                  # processInbound + freshStart
    pipeline/                 # stage.ts (avanza, no retrocede)
    queue/                    # encolar + despachar con gates
    ecommerce/                # Tiendanube
    supabase/                 # clientes server / client / admin / middleware
supabase/migrations/          # schema + RLS + seed
```

## Qué falta

El backlog completo y priorizado de la etapa 2 está en [`CLAUDE.md`](CLAUDE.md).
En resumen: alta de usuarios desde el panel, procesamiento de **media entrante**
(audios y comprobantes de pago), **búsqueda de catálogo** real de Tiendanube,
**bot admin de Telegram**, ficha del contacto, y afinar el follow-up.
