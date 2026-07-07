# docs/ — Spec de arquitectura (referencia)

Acá va la especificación detallada del producto. Copiá tus cuatro archivos a esta
carpeta con estos nombres exactos (el `CLAUDE.md` de la raíz los referencia):

- `AGENTE.md` — reglas del agente de IA (arquitectura del conocimiento, reglas
  duras, estilo, acciones internas, ciclo de mejora).
- `STACK.md` — stack técnico + WhatsApp Cloud API (webhook, envío, ventana de
  24 h, plantillas, media, ecos, cola de envíos).
- `PROCESOS.md` — los procesos del sistema (mensaje entrante, envíos por gatillo,
  seguimiento, vencimiento de leads, QA nocturno, deploy, testing, incidentes).
- `CLAUDE.md` — reglas generales del CRM (los tres tipos de estado, pipeline,
  transporte, conversación canónica, configurabilidad, base de datos, roles).

Estos documentos son la **fuente de verdad** del comportamiento esperado. Ante una
duda de diseño, ganan ellos. El `CLAUDE.md` de la raíz es la guía operativa
(cómo trabajar el repo); estos son el "qué y por qué".
