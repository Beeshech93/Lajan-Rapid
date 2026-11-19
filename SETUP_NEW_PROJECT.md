# Guía de Instalación y Despliegue para Nuevo Proyecto
## Lajan Rapid — Motor Fintech Multiempresa & White Label

Esta guía contiene todas las instrucciones necesarias para poner en marcha el proyecto desde cero en un nuevo entorno, servidor o repositorio.

---

## 🛠️ Requisitos Previos

- **Node.js**: Versión 20 o superior (o [Bun](https://bun.sh/) 1.1+)
- **NPM** o **Bun**
- Cuenta gratuita en [Supabase](https://supabase.com) (Base de datos PostgreSQL, Auth y Almacenamiento)
- Git

---

## 🚀 Paso 1: Clonar o Descomprimir el Proyecto

Si descargaste el archivo `.zip`:
```bash
unzip lajan-rapid-complete.zip -d mi-nuevo-proyecto
cd mi-nuevo-proyecto
```

Instala las dependencias del proyecto:
```bash
npm install
# o si usas bun:
bun install
```

---

## 🗄️ Paso 2: Configurar la Base de Datos en Supabase

1. Entra a tu [Dashboard de Supabase](https://supabase.com/dashboard) y crea un nuevo proyecto.
2. En el menú lateral izquierdo, entra a **SQL Editor**.
3. Haz clic en **New query**.
4. Abre el archivo incluido en el proyecto:
   `supabase/COMPLETE_DATABASE_SETUP.sql`
5. Copia todo su contenido, pégalo en el editor SQL de Supabase y presiona **Run**.

> Este script crea automáticamente:
> - Todas las tablas del sistema (`profiles`, `transfers`, `tenants`, `user_roles`, `admin_permissions`, `integration_credentials`, `topup_rates`, etc.).
> - Enums, disparadores (triggers) y funciones de auditoría.
> - Políticas de seguridad RLS (Row Level Security).
> - Buckets de almacenamiento público para logotipos, favicons e imágenes KYC (`whitelabel-assets`, `ad-banner`, `kyc-documents`).
> - La configuración base de la marca principal Lajan Rapid y marcas aliadas.

---

## 🔑 Paso 3: Configurar Variables de Entorno

Copia el archivo de plantilla `.env.example` a un archivo `.env`:

```bash
cp .env.example .env
```

Abre `.env` y completa tus credenciales de Supabase (se encuentran en **Project Settings > API**):

```env
# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_PROJECT_ID=tu-proyecto-id
SUPABASE_PUBLISHABLE_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PROJECT_ID=tu-proyecto-id
VITE_SUPABASE_PUBLISHABLE_KEY=tu-anon-key

# Pasarelas de Pago (Opcionales - se pueden configurar también en el panel admin)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...

MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_PUBLIC_KEY=APP_USR-...
VITE_MERCADOPAGO_PUBLIC_KEY=APP_USR-...

BAZIK_API_KEY=bzk_live_...
BAZIK_API_SECRET=...

DINGCONNECT_API_KEY=...
RESEND_API_KEY=re_...
```

---

## 💻 Paso 4: Ejecutar en Desarrollo

Para iniciar el servidor de desarrollo local con recarga rápida (HMR):

```bash
npm run dev
```

Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

## 👑 Paso 5: Asignar tu Primer Super Administrador

1. Regístrate en la aplicación desde el formulario de inicio de sesión (`/auth`).
2. Ve a tu panel de Supabase > **SQL Editor** y ejecuta:

```sql
-- Reemplaza con tu correo registrado para obtener permisos de Super Admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'tu_correo@ejemplo.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Dar permisos globales de Super Admin (sin restricción de marca)
INSERT INTO public.admin_permissions (user_id, is_super_admin, can_manage_white_label, can_manage_agents, can_approve_kyc, can_manage_transfers, can_manage_rates)
SELECT id, true, true, true, true, true, true
FROM auth.users
WHERE email = 'tu_correo@ejemplo.com'
ON CONFLICT (user_id) DO UPDATE SET is_super_admin = true;
```

3. Ahora visita [http://localhost:3000/admin](http://localhost:3000/admin) para acceder al panel de control completo.

---

## 🌐 Paso 6: Configuración del Sistema White Label

Desde `/admin` en la pestaña **White Label**:
1. **Crear Marca Aliada:** Define el nombre comercial, el dominio propio obligatorio (ej. `vippip.com`) y el slug.
2. **Subir Identidad Gráfica:** Sube en formato de imagen (.png, .svg, .ico) el **Logotipo**, **Favicon** e **Ícono de la App Móvil**; se guardarán en Supabase Storage con vista previa instantánea.
3. **Colores y Preset:** Elige combinaciones de colores (azul real, esmeralda, dorado, etc.) para personalizar la experiencia completa de esa empresa.
4. **Pasarelas y APIs Propias:** Cada empresa puede configurar sus credenciales individuales de Stripe, Mercado Pago, Bazik, DingConnect y Webhooks. Si no las activa, utilizará el pool compartido de Lajan Rapid.
5. **Asignación de Administradores:** Asigna usuarios administradores a cada marca con permisos específicos.

---

## 📦 Paso 7: Compilación y Despliegue para Producción

Para compilar el proyecto optimizado:

```bash
npm run build
```

El proyecto genera los artefactos listos en `.output/` y `dist/`.

### Opciones de Despliegue:
* **Cloudflare Workers / Pages:** Usa Nitro con preset Cloudflare (`wrangler deploy`).
* **Vercel:** Conecta tu repositorio de GitHub directamente; la configuración está lista en `vercel.json`.
* **Lovable:** El proyecto sincroniza directamente la rama `main` y publica el contenido de `dist/`.
* **VPS / Docker:** Ejecuta `.output/server/index.mjs` con Node.js (`node .output/server/index.mjs`).

---

## 📁 Estructura del Código

```
├── public/                 # Assets públicos, favicon, manifest PWA, service worker (sw.js)
├── src/
│   ├── components/         # Componentes React (UI, admin, calculadora, PWA, shell)
│   │   ├── admin/          # Paneles de control (WhiteLabelPanel, KycPanel, Rates, etc.)
│   │   └── ui/             # Componentes base Radix UI + Tailwind
│   ├── hooks/              # Custom React hooks (useBrand, useCorridors, useServicesConfig)
│   ├── integrations/       # Clientes de integración con Supabase (client y server)
│   ├── lib/                # Lógica del backend, server functions, cálculo de remesas
│   │   ├── brand-context.tsx       # Motor de personalización multi-tenant y SEO dinámico
│   │   ├── whitelabel.types.ts     # Tipado TypeScript del sistema White Label
│   │   ├── whitelabel.functions.ts # Funciones de servidor para persistencia de marcas
│   │   ├── remesa.ts               # Cálculos de comisiones y tipos de cambio
│   │   └── transfers.functions.ts  # Manejo de transferencias y dispersión
│   └── routes/             # Páginas y rutas con TanStack Router
│       ├── __root.tsx              # Raíz de la app, inyección SEO y PWA
│       ├── index.tsx               # Landing page principal
│       ├── _authenticated/         # Rutas protegidas (dashboard, enviar, admin, perfil)
│       └── auth.tsx                # Inicio de sesión y registro
├── supabase/
│   ├── COMPLETE_DATABASE_SETUP.sql # Script SQL completo de instalación
│   └── migrations/                 # Historial detallado de migraciones
├── .env.example            # Plantilla de variables de entorno
└── package.json            # Scripts y dependencias del proyecto
```
