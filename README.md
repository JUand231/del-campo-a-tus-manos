# 🌾 Del Campo a Tus Manos — Plataforma Web Agrícola

![CI](https://github.com/JUand231/del-campo-a-tus-manos/actions/workflows/ci.yml/badge.svg)

Plataforma de comercio justo que conecta directamente a campesinos productores con personas, familias y restaurantes sin intermediarios, garantizando transparencia de origen, precios justos y alimentos frescos cosechados el mismo día.

> **Proyecto ADSO - SENA**  
> Desarrollado bajo la especificación estricta de `PRD.md`, `TRD.md`, `PLAN.md`, `RULES.md`, `AGENTS.md`, `USER_FLOW.md` y el sistema de diseño visual `DESIGN.md`.

---

## 🏛️ 1. Arquitectura y Stack Tecnológico

- **Frontend:** SPA modular basada en HTML5 semántico, CSS3 con tokens de `DESIGN.md`, Tailwind CSS y JavaScript Vanilla. Diseñado para un área táctil mínima de 44×44 px (`touch-target-min`) y navegación adaptada a teléfonos móviles de campo y escritorio.
- **Backend:** API REST desacoplada en Node.js + Express con arquitectura limpia por capas (Controladores, Servicios, Repositorios/Modelos, Middlewares de Seguridad y RBAC). Recuperación por OTP (tabla `password_reset_otp`) y CI en GitHub Actions.
- **Base de Datos:** **MySQL 8+** (con InnoDB y soporte transaccional completo). Se incluye conector nativo `mysql2` y scripts Flyway estándar (`V1__init.sql`, `V2__seed_data.sql` y `V3__password_reset_otp.sql`), además de un fallback resiliente en memoria para evaluación inmediata sin fricción si MySQL no estuviese activo localmente.
- **Seguridad (OWASP Top 10):** Hashing con `bcrypt` (prohibido MD5/SHA1), autenticación con JWT en cookie HttpOnly (`SameSite=Lax`), RBAC (`/admin/**`, escritura de productos), sanitización contra XSS y SQL Injection, rate limiting en `/api/auth/login` y `/api/pedidos`, y cabeceras de seguridad CSP/HSTS.
- **Límites de Alcance del MVP:** `MensajePedido` implementado en Fase 2 (RF-10); pasarelas de pago externas y rastreo GPS fuera del MVP.

---

## 🚀 2. Instrucciones para Ejecutar Localmente

### Requisitos Previos:
- **Node.js** v18 o superior instalado.
- (Opcional recomendado) **MySQL 8+** (vía XAMPP, WAMP, Docker o servicio local en el puerto 3306).

### Paso 1: Configurar Variables de Entorno
En la carpeta `backend/` ya se encuentra configurado el archivo `.env`. Si deseas ajustar tus credenciales de MySQL:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=del_campo_a_tus_manos
```

### Paso 2: Crear e Inicializar la Base de Datos MySQL (Opcional si usas MySQL)
Si tienes el servicio MySQL activo, puedes inicializar la base de datos de 2 formas:
1. **Opción A (Línea de comandos):**
   ```bash
   mysql -u root -p < backend/database/schema_mysql.sql
   ```
2. **Opción B (Script automático):**
   ```bash
   cd backend
   npm run init-db
   ```
*Nota:* Si no inicias MySQL, el backend activará automáticamente su **modo resiliente en memoria** con los mismos datos semilla para permitir evaluar todas las vistas y flujos sin bloquear la ejecución.

### Paso 3: Instalar Dependencias y Arrancar el Servidor
```bash
cd backend
npm install
npm start
```

### Paso 4: Abrir la Aplicación en el Navegador
Abre tu navegador web e ingresa a:
👉 **`http://localhost:3000`**

---

## 🧪 3. Ejecución de la Suite de Pruebas (TRD §4)

El proyecto incluye la automatización de las **11 pruebas de negocio obligatorias** descritas en la sección §4 del TRD:

```bash
cd backend
npm test
```

### Casos Validados:
1. `RF-01`: Rechazo de registro con correo duplicado o campos obligatorios vacíos.
2. `RF-02`: Rechazo de publicación de producto con precio o stock menor o igual a cero.
3. `RF-03`: El filtro/búsqueda de catálogo excluye productos sin stock disponible (`cantidad_disponible > 0`).
4. `RF-04`: Validación atómica de stock antes de confirmar un pedido.
5. `RF-04`: Prohibición estricta de auto-compra para productores.
6. `RF-05`: Prohibición de saltos de estado inválidos (`Pendiente` → `En Proceso` → `Entregado`).
7. `RF-06`: Restitución automática de stock al cancelar un pedido en estado `Pendiente`.
8. `RF-06`: Bloqueo de cancelación en estados `En Proceso` y `Entregado`.
9. `RF-07`: Persistencia del estado del pedido ante fallo en el envío de correo (asíncrono no bloqueante).
10. `RF-08, RF-09`: Bloqueo de rutas `/admin/**` para roles no autorizados.
11. `RF-08`: Un usuario desactivado por el administrador no puede iniciar sesión.

---

## 👥 4. Cuentas de Prueba Preconfiguradas

Para facilitar la evaluación de los diferentes roles y flujos descritos en `USER_FLOW.md`, la base de datos cuenta con usuarios semilla (la contraseña para todos es **`Password123!`**):

| Rol | Correo Electrónico | Contraseña | Descripción / Alcance |
|---|---|---|---|
| **Administrador** | `admin@campo.com` | `Password123!` | Panel de administración global, métricas en tiempo real y moderación de cuentas/productos (RF-08, RF-09). |
| **Productor Agrícola** | `carlos.campesino@campo.com` | `Password123!` | Finca Bella Vista (Boyacá). Publicar cosechas, ver inventario y avanzar estados de pedidos recibidos (RF-02, RF-05). |
| **Compradora** | `comprador@campo.com` | `Password123!` | Compradora en Bogotá. Catálogo interactivo, compras directas y seguimiento/cancelación en "Mis Pedidos" (RF-03, RF-04, RF-06). |
| **Usuario Inactivo** | `bloqueado@campo.com` | `Password123!` | Cuenta desactivada para verificar el rechazo de inicio de sesión de RF-08. |

*Tip:* En la ventana de inicio de sesión hay botones de acceso rápido (**⚡ Demo Fill**) para iniciar con cualquiera de estos perfiles en un solo clic.

---

## 🏭 5. ¿Qué Falta para Producción? (Production Readiness Audit)

Para llevar la plataforma desde este MVP funcional hacia un entorno de producción masivo de nivel bancario/empresarial, se deben completar los siguientes ítems de infraestructura y operaciones:

1. **Certificados SSL/TLS (HTTPS):**
   - Configurar un proxy inverso (Nginx / Cloudflare) con certificados Let's Encrypt para forzar HTTPS estricto y HSTS (`SSL-HTTPS`).
   - Runbook mínimo Nginx (D10): redirigir 80→443, terminar TLS en el proxy y reenviar al Node local. La app ya envía `Strict-Transport-Security` cuando `NODE_ENV=production`, asume `trust proxy` y solo emite cookies `Secure` en producción (sin HTTPS el navegador las rechaza: no omitir este paso).
   ```nginx
   server {
       listen 80;
       server_name tu-dominio.co;
       return 301 https://$host$request_uri;
   }
   server {
       listen 443 ssl;
       server_name tu-dominio.co;
       ssl_certificate /etc/letsencrypt/live/tu-dominio.co/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/tu-dominio.co/privkey.pem;
       add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   - Checklist de arranque en producción: `NODE_ENV=production`, `JWT_SECRET` propio ≥32 chars (la app aborta sin él), `CORS_ORIGIN` con el dominio exacto, MySQL alcanzable (la app aborta sin BD).
2. **Servicio SMTP Transaccional Real:**
   - Reemplazar el mock/Mailtrap con un proveedor dedicado como Amazon SES, SendGrid o Mailgun, con registros SPF, DKIM y DMARC configurados para evitar que los correos de cambio de estado (RF-07) caigan en spam.
3. **Almacenamiento de Archivos en la Nube (Object Storage):**
   - Migrar la subida de fotografías de cosechas desde URLs/disco local hacia buckets S3 compatibles (AWS S3, Google Cloud Storage o Cloudinary) con compresión automática a formato WebP/AVIF (`IMG-WEBP-LAZY`).
4. **Infraestructura de Base de Datos en la Nube:**
   - Desplegar MySQL en una instancia administrada (ej. AWS RDS o PlanetScale) con réplica de lectura para consultas de métricas de administración (RF-09), backups automáticos diarios y pooler de conexiones (ProxySQL).
5. **Pipeline de CI/CD Declarativo:**
   - Formalizar GitHub Actions o GitLab CI que ejecute automáticamente `npm test`, linters y análisis estático de vulnerabilidades (OWASP dependency-check) en cada Pull Request antes de fusionar a la rama `main`.
6. **Manejo de Sesiones Distribuidas:**
   - En caso de escalar horizontalmente a múltiples réplicas del servidor Node.js, utilizar Redis para el almacenamiento de tokens revocados y sesiones distribuidas.
7. **Monitoreo y Observabilidad:**
   - Integrar herramientas APM como Datadog, New Relic o Sentry para trazabilidad de excepciones en tiempo real y alertas tempranas de latencia.
