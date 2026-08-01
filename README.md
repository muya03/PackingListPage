# Nexora Ceramica — Generador de Packing Lists

Aplicación web SPA (Single Page Application) desarrollada para **NEXORA CERAMICA S.L.** que automatiza la creación de documentos logísticos (packing lists) a partir de facturas y packing lists de proveedores.

El usuario sube el documento (PDF, Word, TXT/CSV o una imagen) y **la app lo lee directamente en el navegador, sin IA**: localiza la cabecera de la tabla, mapea cada columna del proveedor a las columnas de NEXORA y transcribe las líneas. A continuación **comprueba sus propias sumas contra los totales que el documento imprime**, de forma que la extracción se valida sola. El resultado es una tabla editable que se exporta como el packing list oficial de NEXORA en PDF (vertical u horizontal) o en Word.

La IA (OpenAI) queda reservada a lo que la lectura directa no puede hacer:

1. **Escaneos y fotos** — un documento sin capa de texto no se puede leer sin mirar los píxeles.
2. **Verificación bajo demanda** — el botón «Verificar con IA» contrasta la tabla extraída con el texto del documento y señala discrepancias.
3. **Rescate** — si no se reconoce ninguna tabla, se puede reintentar enviando solo el texto (mucho más barato que enviar el archivo).

Sin clave de OpenAI la aplicación funciona de principio a fin con documentos digitales.

---

## Índice

- [Qué hace la aplicación](#qué-hace-la-aplicación)
- [Tecnologías utilizadas](#tecnologías-utilizadas)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Requisitos previos](#requisitos-previos)
- [Instalación y ejecución local](#instalación-y-ejecución-local)
- [Build de producción](#build-de-producción)
- [Despliegue en Hostinger](#despliegue-en-hostinger)
- [Variables de entorno](#variables-de-entorno)
- [Problemas conocidos y soluciones](#problemas-conocidos-y-soluciones)

---

## Qué hace la aplicación

1. **Subida del documento** — el usuario arrastra hasta 3 archivos (PDF, DOCX, TXT/CSV o imagen) y les asigna un rol (packing list, factura…).
2. **Lectura directa, sin IA** — la app extrae el texto con sus coordenadas (pdf.js para PDF, XML de OOXML para Word), detecta la fila de cabecera, convierte cada encabezado reconocido en una banda de columna y lee las líneas cayendo cada dato en su banda.
3. **Reconstrucción de la expedición** — agrupa las líneas por contenedor (incluidas las celdas combinadas de los packing lists), resuelve el formato numérico (`1.545,00` vs `1,545.00`) y completa con las reglas de NEXORA solo aquellas columnas que el documento no trae (m² → piezas, palets A-Frame, pesos).
4. **Autoverificación** — compara sus sumas con los totales impresos en el documento y muestra una fiabilidad y una lista de incidencias. Si cuadran, no hace falta ninguna IA.
5. **Tabla editable** — el usuario puede editar cualquier celda; los totales del pie se recalculan en tiempo real.
6. **Generación** — el packing list se genera con el modelo oficial de NEXORA en **PDF vertical**, **PDF horizontal** o **DOCX**.
7. **Sesiones guardadas** — opcionalmente, las sesiones se pueden guardar y recuperar desde una base de datos PostgreSQL (requiere el `api-server`).

> La clave API de OpenAI es **opcional**. La introduce el propio usuario en la interfaz y se almacena en `localStorage`. No pasa por ningún servidor propio.

---

## Tecnologías utilizadas

### Frontend (`artifacts/nexora-app`)

| Tecnología | Versión | Uso |
|---|---|---|
| React | 19.1.0 | UI |
| Vite | 7.x | Bundler y dev server |
| TypeScript | 5.9 | Tipado estático |
| Tailwind CSS | v4 | Estilos |
| Shadcn UI | — | Componentes de interfaz |
| TanStack Table | v8 | Tabla editable con agregadores |
| pdf.js (`pdfjs-dist`) | 6.x | Lectura del texto y las coordenadas del PDF, en el navegador |
| PizZip | 3.x | Descompresión del DOCX para leer `word/document.xml` |
| OpenAI (fetch) | — | Solo escaneos, verificación y rescate (client-side) |
| Zod | 3.25 | Validación de esquemas |
| `docx` | v9+ (ESM) | Generación programática de DOCX |
| `@react-pdf/renderer` | — | Exportación PDF vectorial |
| `file-saver` | — | Descarga de archivos en el navegador |
| `wouter` | 3.x | Enrutamiento ligero |

### Backend (`artifacts/api-server`) — opcional

| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | 24 | Runtime |
| Express | 5 | API REST |
| PostgreSQL | — | Base de datos |
| Drizzle ORM | 0.45 | ORM y migraciones |

### Tooling del monorepo

| Herramienta | Uso |
|---|---|
| pnpm workspaces | Gestión del monorepo |
| pnpm | Gestor de paquetes (obligatorio, no npm ni yarn) |
| TypeScript project references | Typecheck cruzado entre paquetes |

---

## Estructura del repositorio

```
PackingListPage/
├── artifacts/
│   ├── nexora-app/          # Frontend React + Vite
│   │   ├── src/
│   │   │   ├── components/  # PackingTable, UploadZone, ExtractionReport, SettingsPanel…
│   │   │   ├── services/
│   │   │   │   ├── extraction/   # Motor de lectura sin IA (ver más abajo)
│   │   │   │   ├── aiService.ts  # OpenAI: escaneos y verificación
│   │   │   │   └── calculationsService.ts
│   │   │   ├── types/       # packing.ts (Zod schema + tipos)
│   │   │   └── utils/       # exportPdf.tsx, exportDocx.ts, nexoraPdfTheme.ts, packingGroups.ts
│   │   ├── vite.config.ts
│   │   └── .env             # Variables locales (ver sección Variables de entorno)
│   └── api-server/          # Backend Express + PostgreSQL (opcional)
│       └── src/
│           └── routes/sessions.ts
├── lib/
│   ├── db/src/schema/       # Schema Drizzle (packing_sessions)
│   └── api-spec/            # openapi.yaml
├── package.json             # Scripts raíz del workspace
├── pnpm-workspace.yaml      # Configuración del monorepo
└── tsconfig.json
```

---

## Motor de extracción sin IA

Todo el trabajo normal ocurre en `artifacts/nexora-app/src/services/extraction/`, sin ninguna llamada de red:

| Archivo | Responsabilidad |
|---|---|
| `readPdf.ts` | pdf.js: texto de cada página con sus coordenadas; detecta si el PDF es un escaneo |
| `readDocx.ts` | Descomprime el DOCX y recorre `word/document.xml`: recupera las tablas tal cual, incluidas las anidadas |
| `lines.ts` | Agrupa los fragmentos de texto en líneas y une los que un PDF partió a mitad de palabra |
| `fields.ts` | Diccionario de columnas: traduce los encabezados del proveedor (ES/EN/IT) a las columnas de NEXORA |
| `table.ts` | Localiza la fila de cabecera, convierte cada encabezado en una banda de x y lee las filas |
| `numbers.ts` | Detecta el formato numérico del documento y parsea `1.545,00`, `1,545.00`, `855.75`… |
| `metaFields.ts` | Cabecera del documento: nº de factura, cliente, VAT, contenedor, partida arancelaria… |
| `buildRows.ts` | Construye las líneas de NEXORA, reparte las celdas combinadas por contenedor y aplica las reglas cerámicas a lo que falte |
| `validate.ts` | Contrasta las sumas con los totales impresos y calcula la fiabilidad |

**Puntos clave del diseño**

- **El encabezado manda.** Una vez reconocida la cabecera, el documento es una rejilla: cada dato cae en la banda de su columna. Los encabezados que no usamos (`Length (m)`, `Height (m)`…) también reservan su banda, para que sus valores no contaminen la columna vecina.
- **Celdas combinadas.** En un packing list, el contenedor se imprime una vez centrado sobre las líneas que agrupa. La posición de esa celda codifica cuántas líneas abarca, y `buildRows.ts` resuelve esa geometría para devolver cada línea a su contenedor.
- **Nada se inventa.** Una columna que el documento imprime es la verdad, aunque una celda esté vacía. Solo se calculan con las fórmulas de NEXORA las columnas que el documento no trae, y siempre se avisa de cuáles han sido.
- **Se valida solo.** Los totales impresos son la referencia: si cuadran, la extracción es correcta y no hace falta IA.

---

## Requisitos previos

- **Node.js v24** exactamente (recomendado: usar [nvm](https://github.com/nvm-sh/nvm) para gestionar versiones)
- **pnpm** como gestor de paquetes (el repositorio lo impone y bloquea npm/yarn)
- **Git**

```bash
# Instalar pnpm si no lo tienes
npm install -g pnpm

# Verificar versiones
node --version   # debe ser v24.x.x
pnpm --version
```

> ⚠️ El backend (`api-server`) requiere además una instancia de **PostgreSQL** accesible. Para desarrollo local puedes usar [Neon](https://neon.tech) o [Supabase](https://supabase.com) (ambos tienen tier gratuito).

---

## Instalación y ejecución local

### 1. Clonar el repositorio

```bash
git clone https://github.com/muya03/PackingListPage.git
cd PackingListPage
```

### 2. Eliminar binarios de plataforma bloqueados (solo la primera vez)

El `pnpm-workspace.yaml` original fue generado en un entorno Linux x64 e incluye overrides que excluyen los binarios nativos de macOS (`darwin-arm64`, `darwin-x64`) y otros sistemas. Si trabajas en **Mac con Apple Silicon (M1/M2/M3/M4)**, debes eliminar esas líneas del bloque `overrides` en `pnpm-workspace.yaml` antes de instalar:

Líneas a eliminar (todas las que contengan `darwin`):
```yaml
# Eliminar estas líneas del bloque overrides:
rollup>@rollup/rollup-darwin-arm64: '-'
rollup>@rollup/rollup-darwin-x64: '-'
'@tailwindcss/oxide>@tailwindcss/oxide-darwin-arm64': '-'
'@tailwindcss/oxide>@tailwindcss/oxide-darwin-x64': '-'
lightningcss>lightningcss-darwin-arm64: '-'
lightningcss>lightningcss-darwin-x64: '-'
esbuild>@esbuild/darwin-arm64: '-'
esbuild>@esbuild/darwin-x64: '-'
```

Si trabajas en **Windows** elimina los `win32`, y en **Linux x64** no necesitas tocar nada.

### 3. Instalar dependencias

```bash
pnpm install
```

### 4. Configurar variables de entorno del frontend

El `vite.config.ts` del frontend requiere `PORT` y `BASE_PATH`. La forma más sencilla es modificar el archivo para que use valores por defecto:

Abre `artifacts/nexora-app/vite.config.ts` y reemplaza las validaciones estrictas del inicio:

```typescript
// Antes (lanza error si no se proporcionan):
const rawPort = process.env.PORT;
if (!rawPort) { throw new Error(...) }
const port = Number(rawPort);
const basePath = process.env.BASE_PATH;
if (!basePath) { throw new Error(...) }

// Después (usa valores por defecto):
const port = Number(process.env.PORT ?? "3000");
const basePath = process.env.BASE_PATH ?? "/";
```

### 5. Arrancar el frontend

```bash
pnpm --filter @workspace/nexora-app run dev
```

La app estará disponible en `http://localhost:3000`.

### 6. Arrancar el backend (opcional)

Solo necesario si quieres usar la funcionalidad de guardar y recuperar sesiones:

```bash
# Crear archivo de entorno para el api-server
echo "DATABASE_URL=postgresql://usuario:contraseña@host:5432/nexora" \
  > artifacts/api-server/.env

# Arrancar el servidor
pnpm --filter @workspace/api-server run dev
```

El API server se levanta en `http://localhost:8080`.

---

## Build de producción

```bash
pnpm --filter @workspace/nexora-app run build
```

Los archivos estáticos se generan en:

```
artifacts/nexora-app/dist/public/
├── index.html
└── assets/
    ├── index-XXXXXX.js
    ├── index-XXXXXX.css
    └── ...
```

> Estos son los únicos archivos que hay que subir al hosting.

---

## Despliegue en Hostinger (subdominio)

### Paso 1 — Acceder al File Manager

En el panel de Hostinger (hPanel) → **Hosting** → tu plan → **File Manager**.

### Paso 2 — Localizar la carpeta del subdominio

Los subdominios tienen su propia carpeta dentro de `public_html/`:

```
public_html/
  tusubdominio.tudominio.com/   ← entra aquí
```

Borra el contenido existente (suele haber un `index.html` de placeholder).

### Paso 3 — Subir los archivos

Sube el **contenido** de `artifacts/nexora-app/dist/public/` (no la carpeta `dist/` ni `public/` en sí, sino lo que hay dentro: `index.html` y la carpeta `assets/`).

Puedes hacerlo por:

- **File Manager de Hostinger** → botón Upload → selecciona todos los archivos.
- **FTP con FileZilla** → más rápido para muchos archivos. Datos de conexión en hPanel → FTP Accounts.

### Paso 4 — Crear el archivo `.htaccess`

**Este paso es obligatorio.** Sin él, cualquier recarga de página o acceso directo a una ruta dará error 404, porque el servidor buscará archivos físicos que no existen (todo lo gestiona el router de React en el cliente).

Crea un archivo llamado `.htaccess` en la raíz del subdominio con este contenido:

```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

En el File Manager de Hostinger: botón **New File** → nombre `.htaccess` → pega el contenido → guardar.

### Paso 5 — Verificar

Abre `https://tusubdominio.tudominio.com` en el navegador. La app debería cargar correctamente.

---

## Variables de entorno

### Frontend (`artifacts/nexora-app`)

| Variable | Valor local | Valor producción | Descripción |
|---|---|---|---|
| `PORT` | `3000` | No aplica (lo gestiona el hosting) | Puerto del dev server |
| `BASE_PATH` | `/` | `/` | Ruta base de la app |
| `VITE_API_URL` | `http://localhost:8080` | `https://tuapi.tudominio.com` | URL del api-server (solo si usas sesiones) |

### Backend (`artifacts/api-server`)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Connection string de PostgreSQL. Ej: `postgresql://user:pass@host:5432/dbname` |
| `PORT` | Puerto del servidor (por defecto 8080) |
| `NODE_ENV` | `development` o `production` |

> La **clave API de OpenAI** no se configura en el servidor — la introduce cada usuario en la interfaz de la app y se guarda en su propio `localStorage`.

---

## Problemas conocidos y soluciones

### 1. Error: `Cannot find module @rollup/rollup-darwin-arm64`

**Causa:** el `pnpm-workspace.yaml` excluye los binarios nativos de macOS porque fue generado en Linux x64.

**Solución:** eliminar las líneas con `darwin` del bloque `overrides` en `pnpm-workspace.yaml`, borrar `node_modules` y `pnpm-lock.yaml`, y reinstalar.

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

### 2. Error: `PORT environment variable is required but was not provided`

**Causa:** el `vite.config.ts` original lanza excepciones si no se pasan `PORT` y `BASE_PATH` como variables de entorno del proceso. Vite no carga el `.env` para variables sin prefijo `VITE_`.

**Solución A (recomendada):** modificar `vite.config.ts` para usar valores por defecto:
```typescript
const port = Number(process.env.PORT ?? "3000");
const basePath = process.env.BASE_PATH ?? "/";
```

**Solución B (temporal):** pasar las variables inline:
```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/nexora-app run dev
```

---

### 3. Página en blanco o error 404 al recargar en producción

**Causa:** el servidor web intenta encontrar un archivo físico para la ruta solicitada (ej. `/sessions`), que no existe — todo el enrutamiento es client-side.

**Solución:** crear el archivo `.htaccess` descrito en el paso 4 del despliegue.

---

### 4. Error al instalar con `npm install` o `yarn install`

**Causa:** el `package.json` raíz tiene un script `preinstall` que bloquea explícitamente cualquier gestor que no sea pnpm.

**Solución:** usar siempre `pnpm install`.

---

### 5. Build falla con errores de TypeScript

**Causa:** el script `build` de la raíz ejecuta `typecheck` antes de compilar.

**Solución:** ejecutar el build directamente desde el paquete del frontend, saltándose el typecheck global:

```bash
cd artifacts/nexora-app
pnpm run build
```

---

### 6. `@react-pdf/renderer` — no usar hooks dentro de `<Document>`

`@react-pdf/renderer` usa su propio reconciliador de React, incompatible con hooks estándar. No uses `useState`, `useEffect` u otros hooks dentro de componentes `<Document>`, `<Page>`, etc.

---

### 7. Paquete `docx` v9+ y ESM

La librería `docx` en versión 9 o superior usa ESM puro. Si el build de Vite falla con errores de módulos relacionados con `docx`, asegúrate de que no está en la lista `external` del `vite.config.ts`.

---

## Arquitectura de decisiones clave

- **IA 100% client-side:** las llamadas a OpenAI se hacen desde el navegador con la clave del usuario. No hay proxy de backend, no hay coste de servidor para la IA.
- **Structured Outputs:** se usa `response_format: { type: "json_schema" }` de OpenAI para garantizar respuestas JSON deterministas.
- **Lógica de negocio duplicada intencionalmente:** el prompt de IA y `calculationsService.ts` aplican las mismas reglas de conversión. Esto asegura consistencia cuando el usuario edita celdas manualmente tras la extracción.
- **Backend opcional:** la app es completamente funcional sin el `api-server`. Las sesiones son la única funcionalidad que lo requiere.
