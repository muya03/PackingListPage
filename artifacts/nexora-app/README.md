# NEXORA CERAMICA — Generador de Packing Lists
## Guía de despliegue en Hostinger

Esta aplicación es un **SPA estático** — no necesita servidor, base de datos ni backend. Se construye una vez en tu ordenador y los ficheros resultantes se suben al hosting.

---

## Lo que necesitas instalado

- **Node.js** v18 o superior → https://nodejs.org (descarga la versión LTS)
- **pnpm** → `npm install -g pnpm`

Comprueba que están disponibles:
```
node --version
pnpm --version
```

---

## Paso 1 — Descargar el proyecto desde Replit

1. En Replit haz clic en el menú **···** (esquina superior derecha).
2. Elige **"Download as zip"**.
3. Extrae el ZIP en tu escritorio. Quedará una carpeta, por ejemplo: `PackingList`.

---

## Paso 2 — Abrir la terminal en la carpeta correcta

Abre la terminal y navega a la carpeta raíz del proyecto (donde está el fichero `pnpm-workspace.yaml`):

```bash
cd ~/Desktop/PackingList
```

> Sustituye `PackingList` por el nombre exacto de tu carpeta.

---

## Paso 3 — Borrar node_modules e instalar dependencias

El ZIP incluye `node_modules` de Linux que no son compatibles con Mac. Hay que borrarlos y reinstalar:

```bash
rm -rf node_modules
pnpm install
```

Tardará unos minutos la primera vez.

---

## Paso 4 — Entrar en la carpeta de la aplicación

```bash
cd artifacts/nexora-app
```

Comprueba que estás en el sitio correcto con:
```bash
ls
```
Deberías ver ficheros como `package.json`, `vite.config.deploy.ts`, `src/`, etc.

---

## Paso 5 — Construir la aplicación

Ejecuta este comando (estando dentro de `artifacts/nexora-app`):

```bash
pnpm exec vite build --config vite.config.deploy.ts
```

Cuando termine correctamente verás algo así:
```
✓ built in 15s
dist-deploy/index.html         2.4 kB
dist-deploy/assets/index.js  890.0 kB
```

Los ficheros listos para subir estarán en:
```
artifacts/nexora-app/dist-deploy/
```

---

## Paso 6 — Crear el fichero `.htaccess`

Crea un fichero de texto dentro de `dist-deploy/` llamado exactamente **`.htaccess`** (con el punto delante) con este contenido:

```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [QSA,L]
```

La carpeta `dist-deploy/` debe quedar así:
```
dist-deploy/
├── .htaccess        ← créalo manualmente
├── index.html
└── assets/
    ├── index-[hash].js
    └── index-[hash].css
```

---

## Paso 7 — Subir a Hostinger

1. Entra en tu panel: **hPanel** → https://hpanel.hostinger.com
2. Ve a **Files → File Manager**.
3. Abre la carpeta `public_html`.
4. Comprime el contenido de `dist-deploy/` en un ZIP (selecciona los ficheros de dentro, no la carpeta en sí).
5. En Hostinger sube el ZIP con el botón **Upload**.
6. Haz clic derecho sobre el ZIP → **Extract** → extrae directamente en `public_html`.
7. Borra el ZIP.

La estructura final en `public_html` debe ser:
```
public_html/
├── .htaccess
├── index.html
└── assets/
```

---

## Paso 8 — Verificar

Abre `https://tudominio.com` en el navegador. Debe aparecer la interfaz NEXORA con el formulario de clave API.

---

## Resumen de comandos (todos juntos)

```bash
# 1. Entra en la carpeta del proyecto
cd ~/Desktop/PackingList

# 2. Borra node_modules de Linux e instala para Mac
rm -rf node_modules
pnpm install

# 3. Ve a la carpeta de la aplicación
cd artifacts/nexora-app

# 4. Construye
pnpm exec vite build --config vite.config.deploy.ts

# 5. Los ficheros están en:
#    artifacts/nexora-app/dist-deploy/
```

---

## Solución de errores frecuentes

**`@rollup/rollup-darwin-x64` not found**
```bash
# Vuelve a la raíz del proyecto y borra node_modules
cd ~/Desktop/PackingList
rm -rf node_modules
pnpm install
```

**`Command "vite" not found`**
Asegúrate de estar dentro de `artifacts/nexora-app` antes de ejecutar el build:
```bash
cd ~/Desktop/PackingList/artifacts/nexora-app
pnpm exec vite build --config vite.config.deploy.ts
```

**`npx` descargó una versión incorrecta de vite**
No uses `npx vite`. Usa siempre `pnpm exec vite` desde dentro de `artifacts/nexora-app`.

**La página carga en blanco en Hostinger**
- Comprueba que `index.html` está directamente en `public_html` y no en una subcarpeta.
- Activa "Show Hidden Files" en el File Manager y verifica que `.htaccess` está presente.

**Error 500 en Hostinger**
El módulo `mod_rewrite` está desactivado. Contacta con el soporte de Hostinger para activarlo (en la mayoría de planes está activo por defecto).

---

## Actualizar la aplicación en el futuro

```bash
cd ~/Desktop/PackingList        # o vuelve a descargar el ZIP actualizado
rm -rf node_modules
pnpm install
cd artifacts/nexora-app
pnpm exec vite build --config vite.config.deploy.ts
```

Luego sube el nuevo contenido de `dist-deploy/` a Hostinger, sobreescribiendo los ficheros anteriores.

---

*Plataforma interna de automatización logística — NEXORA CERAMICA S.L.*
