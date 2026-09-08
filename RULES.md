# rules.md — Del Campo a Tus Manos
> Contrato de seguridad y calidad. Fuente: AGENTS.md (arquitectura/seguridad) + DESIGN.md (accesibilidad).

## 1. ARQUITECTURA Y CONTEXTO
- Nombre del proyecto: Del Campo a Tus Manos
- Enfoque: MVC desacoplado con API REST — Backend Java + Spring Boot (Web, Security, Data JPA); Frontend HTML5/CSS3/JS Vanilla + Bootstrap; MySQL + Flyway.
- Criterio de selección de reglas: Ciberseguridad OWASP Top 10 obligatoria al 100%, combinada solo con reglas de estructura web, diseño y rendimiento que aplican al alcance del MVP (RF-01 a RF-09). Se excluyen por completo SEO avanzado y Formularios/Conversión comercial (ver justificación al final).

## 2. REGLAS ACTIVADAS (28/68)

### Categoría 1 — Ciberseguridad y Bastionado (OWASP Top 10) · 10/10 ACTIVADA COMPLETA
- [X] `INPUT-VAL/SANITIZE`: Sanitización y validación estricta de todo input (Bean Validation/DTOs) contra SQL Injection, XSS y Command Injection — validado en backend siempre; el frontend replica la misma validación (ej. precio/stock ≤ 0) solo como feedback inmediato al usuario, nunca como única defensa.
- [X] `ENV-VARS/SECRETS`: Prohibido hardcodear credenciales o secretos; uso exclusivo de variables de entorno (.env) e inclusión obligatoria en `.gitignore`.
- [X] `HASH-CRYPT/BCRYPT`: Hashing de contraseñas exclusivamente con bcrypt + salting. Prohibido MD5, SHA1 o Argon2 (no está aprobado en este proyecto — evitar ambigüedad de nombres).
- [X] `AUTH-JWT/RBAC`: Autenticación y control de acceso por roles (RBAC) mediante middlewares Express + JWT en cookie HttpOnly (`/admin/**`, escritura de productos).
- [X] `CSP-HEADERS/SPRING-SECURITY`: Cabeceras de seguridad HTTP (CSP, X-Frame-Options, X-Content-Type-Options, HSTS) configuradas manualmente en Express (HSTS solo en producción tras proxy TLS).
- [X] `RATE-LIMIT/DDOS`: Rate limiting en endpoints críticos (`/api/auth/login`, `/api/pedidos`).
- [X] `CORS-POL/ORIGIN`: Política CORS restrictiva, sin comodines `*`, solo orígenes autorizados.
- [X] `FILE-SEC/UPLOAD-VAL`: Validación de imágenes de producto (MIME real, extensión, tamaño máximo), renombrado seguro fuera del directorio web directo. Nota MVP: sin endpoint de subida (fotos por URL con respaldo `onerror`); la regla aplica si se añade subida en Fase 2.
- [X] `ERR-MASK/LOG-SEC`: Sin stack traces ni detalles internos en producción; registro seguro vía SLF4J/Logback.
- [X] `CSRF-PROT`: Protección CSRF con cookie HttpOnly + SameSite=Lax (los mutadores son POST/PUT/DELETE; los GET son de solo lectura).

### Categoría 2 — Páginas y Estructura Web · 6/12
- [X] `GDPR/RGPD`: Política de privacidad (`/privacy`).
- [X] `T&C`: Términos y condiciones (`/terms`).
- [X] `HTTP-404`: Vista 404 personalizada.
- [X] `HTTP-5XX`: Vista de error de servidor genérica, sin datos sensibles.
- [X] `FAQ`: Preguntas frecuentes sobre compras y despachos (`/faq`).
- [X] `NAV-STICKY`: Menú superior fijo (catálogo, perfil, carrito).

### Categoría 3 — SEO e Indexación · 0/7 DESACTIVADA COMPLETA
*(sin activaciones — ver justificación)*

### Categoría 4 — Formularios y Conversión · 0/11 DESACTIVADA COMPLETA
*(sin activaciones — ver justificación)*

### Categoría 5 — Diseño y Adaptabilidad · 7/12
- [X] `RESPONSIVE-320-768-1024`: Interfaz adaptada a móvil de gama de entrada y escritorio.
- [X] `NAV-MOBILE`: Menú hamburguesa/drawer táctil.
- [X] `FAVICON-MULTIRES`: Iconografía institucional.
- [X] `LOGO-CLICKABLE`: Retorno al catálogo desde el logo.
- [X] `NO-HORIZONTAL-OVERFLOW`: Sin desbordamientos en smartphones.
- [X] `CONTENT-REAL`: Contenido 100% real en español, sin lorem ipsum ni enlaces vacíos.
- [X] `ALT-IMAGES`: Atributos `alt` obligatorios en fotos de producto (reubicada aquí desde SEO: es accesibilidad para usuarios con lectores de pantalla y fallback en conexiones lentas del campo, no una táctica de posicionamiento).

### Categoría 6 — Rendimiento, Animaciones y Redes · 5/16
- [X] `IMG-WEBP-LAZY`: Compresión WebP/AVIF + lazy load para conexiones móviles lentas.
- [X] `SSL-HTTPS`: Conexión cifrada obligatoria.
- [X] `HOVER-FOCUS-STATES`: Feedback visual con área táctil mínima 44×44 px.
- [X] `SKELETON-SCREENS`: Pantallas de carga esqueléticas en el catálogo.
- [X] `TRANSITIONS-0.2S`: Transiciones suaves sin penalizar rendimiento.

## 3. PROHIBICIONES Y MANDATOS ABSOLUTOS
- Prohibido exponer API keys o credenciales de BD en código fuente; solo variables de entorno.
- Todo input DEBE sanitizarse y validarse en backend antes de procesarse o persistirse.
- Prohibido hashing obsoleto (MD5, SHA1); solo bcrypt.
- Ocultar stack traces y detalles de infraestructura en producción; mensajes amables en español.
- Prohibido crear pasarelas de pago externas, GPS o cualquier feature fuera de RF-01 a RF-10 (`MensajePedido` autorizado únicamente dentro de RF-10, Fase 2).
- Descuento de stock (RF-04): transacción atómica (`db.withTransaction`), aislamiento `READ_COMMITTED` (InnoDB por defecto), bloqueo optimista (columna `version`) + `SELECT ... FOR UPDATE`.
- Ninguna tarea se da por completada sin ejecutar `npm test` y validar las 28 reglas activadas.

## 4. JUSTIFICACIÓN DE SELECCIÓN
**Reglas activadas: 28/68**

**¿Por qué se dejaron fuera 2 categorías completas?**
- **Categoría 3 (SEO e Indexación):** la plataforma es un circuito transaccional cerrado (compradores y productores ya registrados), no un canal de adquisición orgánica vía buscadores; el único ítem con valor real (`alt` en imágenes) se reclasificó como regla de **accesibilidad** en la Categoría 5, no de posicionamiento.
- **Categoría 4 (Formularios y Conversión):** no hay formularios públicos de captura de leads ni marketing agresivo (sin newsletter, sin popups, sin live chat); la única regla con peso real —validación en tiempo real de precio/stock— ya está cubierta como complemento frontend de `INPUT-VAL/SANITIZE` en la Categoría 1, evitando duplicar la misma regla en dos categorías.
