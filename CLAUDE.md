# CLAUDE.md — Guía para trabajar este repo

Sos un agente de ingeniería trabajando en **este** proyecto junto a **Mateo**
(desarrollador, prefiere que le hablen en español rioplatense y simple).
Leé este archivo entero antes de tocar nada. La spec detallada del producto está
en `docs/` (AGENTE, STACK, PROCESOS, CLAUDE) — consultala cuando dudes.

## Qué es

CRM conversacional para vender por WhatsApp: bandeja de chats en vivo, tablero
Kanban de leads, un agente de IA que atiende a los clientes, envíos automáticos
por plantillas de Meta y post-venta. Una empresa (multi-tenant desde el día uno)
vende por WhatsApp y esto es su centro de operaciones.

## Stack

- **Next.js 14 (App Router) + TypeScript estricto + Tailwind.**
- **Supabase**: Postgres + RLS + Realtime + Storage.
- **Vercel**: deploy al pushear a `main`; crons en `vercel.json`.
- **AI SDK** (`ai` + `@ai-sdk/anthropic` / `@ai-sdk/openai`): cadena de modelos
  con fallback.
- **WhatsApp Cloud API oficial de Meta** (sin intermediarios) + **Tiendanube**.

## Reglas de oro (invariantes — NO romper)

Estas viven en código porque protegen al sistema. Antes de cambiar algo, chequeá
que no viole ninguna:

1. **Los textos son datos, no código.** Copys, columnas, plantillas, cupones,
   prompt del agente e info del negocio se editan desde el panel/BD. En código va
   solo la lógica. Test: "¿el dueño querría cambiar esto sin deploy?" → es dato.
2. **El agente avanza, no retrocede** (automático). Ningún proceso automático
   devuelve un lead a una columna anterior. Todo pasa por
   `src/lib/pipeline/stage.ts`. Un humano arrastrando SÍ puede mover libre.
3. **Conversación canónica = la más antigua** (`created_at` asc). Nunca crear
   otra si el contacto ya tiene una. Dedup de contactos por últimos 8 dígitos.
4. **El canal vive detrás de una interfaz** (`src/lib/transport`). Prohibido
   meter lógica de WhatsApp fuera del adaptador.
5. **RLS en todas las tablas.** `service_role` (admin client) SOLO en webhooks y
   crons; el cliente SSR en pantallas. Nunca consultar sin filtro de org.
6. **Los webhooks SIEMPRE responden 200** (si no, Meta reintenta y duplica). La
   idempotencia es propia (`wa_message_id`).
7. **Nunca marcar `sent` algo que no salió.** Los errores de la Graph API se
   propagan (throw), no se tragan.
8. **Fallback de modelos obligatorio.** Sin el segundo proveedor, una key sin
   cuota deja al agente mudo (las plantillas siguen saliendo: esa asimetría es la
   señal de diagnóstico).
9. **Reglas duras del agente**: están en `src/lib/agent/rules.ts` (nunca inventar,
   herramientas antes que afirmaciones, prometer = ejecutar, nunca decir que el
   pedido no existe, comprobante = venta cerrada, no revelar la tecnología,
   identidad única). No las muevas a config editable.

## Mapa del código

```
src/lib/
  transport/     adaptador de canal (WhatsApp Cloud) detrás de interfaz única
  agent/         prompt (3 capas) · rules (duras) · tools · models (fallback) · review
  inbound/       processInbound (camino principal) + freshStart
  pipeline/      stage.ts — avanza no retrocede
  queue/         enqueue (opt-in + anti-duplicado) · dispatch (gates de envío)
  ecommerce/     tiendanube (OAuth cifrado, HMAC, estados traducidos)
  supabase/      server · client · admin · middleware
  config.ts crypto.ts cron.ts
src/app/
  (auth)/login          login con Supabase Auth
  (app)/bandeja         chats en vivo (Realtime) + responder
  (app)/kanban          tablero con drag & drop
  (app)/ajustes         editar agente, info del negocio y notas
  api/webhooks/*        whatsapp · tiendanube
  api/oauth/tiendanube  start · callback
  api/cron/*            dispatch · abandoned-cart · followup · lead-expiry · qa
supabase/migrations/    schema + RLS + seed + realtime
```

## Cómo correr

```bash
npm install
cp .env.example .env.local      # completar credenciales
npm run dev                     # desarrollo
npm run typecheck               # tsc --noEmit — correr SIEMPRE antes de pushear
npm run build                   # build de producción
```

Migraciones: aplicar por NOMBRE y en orden en el SQL editor de Supabase
(`0001` → `0002` → `0003`). No editar una migración ya aplicada: siempre una
nueva, numerada.

## Flujo de trabajo con el repo

- `git pull` SIEMPRE antes de editar (hay colaboradores en paralelo).
- Editar → `npm run typecheck` → `git commit` → `git push` a `main`. Vercel
  deploya solo. Cambios delicados → rama de preview.
- Prohibido `git push --force`. En conflicto con trabajo ajeno, **gana el otro**:
  dejá su versión y avisá.
- Env vars en el panel de Vercel, NUNCA en el repo. Jamás commitear una key.

## Estilo de código

- TypeScript estricto, sin `any` (salvo el escape mínimo para columnas JSONB de
  Supabase, que llegan sin tipar).
- Sin comentarios obvios: un comentario dice lo que el código no puede.
- Sin abstracciones prematuras. Server Actions en `actions.ts` junto a su página.
- La UI se escribe en español (es lo que ve el usuario final). Copys claros y en
  voz activa: "Enviar", no "Submit".
- Paleta: acento `teal` (700/900), neutros `slate`. No romper la identidad.

## Cómo trabajar con Mateo

- **Hacé el trabajo, no lo describas.** Mateo quiere el resultado hecho + una
  explicación corta, no un plan de 10 pasos para aprobar.
- **Empezá por el resultado.** La primera frase responde "¿qué hiciste / qué
  encontraste?".
- **Verificá antes de reportar.** Después de editar, corré `npm run typecheck`
  (y `npm run build` si tocaste rutas/páginas). "No dio error" no es "funciona".
- **Honestidad total.** Si algo no anda o salteaste un paso, decilo. Nunca digas
  "listo" sin verificarlo. Mostrá el error tal cual.
- **Autonomía en lo reversible.** Avanzá sin pedir permiso en cambios reversibles
  que se desprenden del pedido. Frená y preguntá solo ante: borrar/sobrescribir
  cosas que no creaste, cambios de alcance, o publicar hacia afuera (deploy,
  enviar, compartir).
- Si Mateo está pensando en voz alta o describiendo un problema (no pidiendo un
  cambio), el entregable es tu diagnóstico: reportá y pará.

## Backlog — etapa 2 (lo que falta)

Priorizado. Cada tarea es accionable y respeta las reglas de oro de arriba.

1. **Login: alta de usuarios.** Hoy `signInWithPassword` anda, pero el usuario se
   crea a mano en Supabase (con `raw_user_meta_data.organization_id`). Falta el
   flujo de invitación/alta desde el panel (rol admin).
2. **Media entrante** (`src/lib/inbound/process.ts`, TODO marcado): descargar el
   media con `transport.fetchMedia`, subir al Storage propio (la URL de Meta
   expira), transcribir audios (Whisper) y leer imágenes (detección de
   comprobantes de pago). Actualizar el `body` del placeholder `[procesando…]`.
3. **Búsqueda de catálogo real** (`src/lib/agent/tools.ts` → `consultar_producto`,
   stubbeado): pegarle a la API de productos de Tiendanube para devolver precio y
   stock EN VIVO (regla dura 2). Agregar el helper en `src/lib/ecommerce/tiendanube.ts`.
4. **Bot admin de Telegram**: canal para que el dueño corrija info/precios/tono y
   lea chats; cada corrección se guarda como nota activa (`agent_notes`) y aplica
   al instante. Reglas: editar solo lo pedido, leer antes de escribir.
5. **Ficha del contacto** en la bandeja: pedidos (`orders`), etiquetas, y la
   columna del Kanban donde está el lead.
6. **Follow-up fino** (`api/cron/followup`, TODO): saltear si ya compró o mandó
   comprobante (chequear `orders` y `raw.kind` de los últimos mensajes).
7. **Panel de plantillas** (`message_templates`) y **de QA** (`qa_reviews`):
   convertir una nota de QA en corrección activa o descartarla.
8. **Verificar tiempos reales** de la API de carritos abandonados de Tiendanube
   antes de prometer tiempos de reacción ("aviso a los 20 min" puede ser imposible
   si la plataforma lista el carrito recién a la hora).

## Trampas conocidas

- `next build` pre-renderiza los route handlers: marcá los que leen env con
  `export const dynamic = "force-dynamic"` o fallan en build.
- El idioma de la plantilla de Meta debe coincidir EXACTO con el aprobado
  (`es` ≠ `es_AR`).
- Error `131047` = ventana de 24 h cerrada → mandar plantilla, no texto libre.
- Realtime necesita la tabla en la publicación (`0003_realtime.sql`).
