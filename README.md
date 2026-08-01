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
- [Despliegue](#despliegue)
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

- **Node.js 24** — el repositorio incluye un `.nvmrc`, así que con [nvm](https://github.com/nvm-sh/nvm) basta con `nvm install && nvm use` dentro de la carpeta del proyecto
- **pnpm** como gestor de paquetes (el repositorio lo impone y bloquea npm/yarn)
- **Git**

```bash
# Instalar pnpm si no lo tienes
npm install -g pnpm

# Verificar versiones
node --version          # v24.x.x
pnpm --version          # 10.x
node -p "process.arch"  # en un Mac M1/M2/M3 debe decir: arm64
```

El proyecto funciona de forma nativa en **macOS Apple Silicon, macOS Intel, Linux y Windows**: el `pnpm-lock.yaml` incluye los binarios nativos de todas las plataformas y pnpm instala los que correspondan a la tuya.

> ⚠️ El backend (`api-server`) requiere además una instancia de **PostgreSQL** accesible. Para desarrollo local puedes usar [Neon](https://neon.tech) o [Supabase](https://supabase.com) (ambos tienen tier gratuito).

---

## Instalación y ejecución local

### 1. Clonar el repositorio

```bash
git clone https://github.com/muya03/PackingListPage.git
cd PackingListPage
```

### 2. Instalar dependencias

```bash
nvm use          # opcional: usa la versión de .nvmrc
pnpm install
```

No hay que editar ningún archivo antes de instalar. En versiones anteriores el `pnpm-workspace.yaml` bloqueaba todos los binarios nativos que no fueran de Linux x64 y había que borrar a mano las líneas con `darwin`; eso ya está corregido.

### 3. Arrancar el frontend

```bash
pnpm --filter @workspace/nexora-app run dev
```

La app estará disponible en `http://localhost:3000`. `PORT` y `BASE_PATH` son opcionales y solo hacen falta si quieres otro puerto o servir desde una subcarpeta:

```bash
PORT=4000 BASE_PATH=/packinglist/ pnpm --filter @workspace/nexora-app run dev
```

### 4. Arrancar el backend (opcional)

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
    ├── index-XXXXXXXX.js           ← la aplicación
    ├── index-XXXXXXXX.css          ← los estilos
    └── pdf.worker.min-XXXXXXXX.mjs ← el lector de PDF (obligatorio)
```

> Estos son los únicos archivos que hay que subir al hosting.
>
> ⚠️ El `pdf.worker.min-*.mjs` es el que lee los PDF sin IA. Si no se sube, la app carga pero no extrae nada. Sube siempre la carpeta `assets/` entera.

---

## Despliegue

La guía completa está en **[DESPLIEGUE.md](./DESPLIEGUE.md)**: preparación de un Mac con Apple Silicon, build, subida a Hostinger (u otro hosting estático), backend opcional y resolución de problemas.

En resumen: la aplicación es una SPA estática, así que basta con subir el contenido de `artifacts/nexora-app/dist/public/` a cualquier hosting de archivos estáticos y añadir un `.htaccess` que redirija todo a `index.html`:

```apache
Options -MultiViews
RewriteEngine On

# Un archivo que falte dentro de assets/ tiene que dar 404, no index.html.
# Sin esta línea, si assets/ no se ha subido el servidor devuelve el HTML en
# lugar del JavaScript y el navegador se queda en blanco sin decir por qué.
RewriteCond %{REQUEST_URI} ^/assets/
RewriteRule ^ - [L]

RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]

# El worker de pdf.js debe servirse como módulo JavaScript
AddType text/javascript .mjs
```

---

## Variables de entorno

### Frontend (`artifacts/nexora-app`)

Ambas son **opcionales**; sin ellas se usan los valores por defecto.

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto del dev server y del `preview` |
| `BASE_PATH` | `/` | Ruta base de la app. Cámbiala solo si se sirve desde una subcarpeta, p. ej. `/packinglist/` |

> El frontend llama al `api-server` en `/api` **de su mismo origen**; no hay ninguna variable para apuntar a otro host. Si alojas el backend en otro sitio, necesitarás un proxy inverso (o cambiar `API_BASE` en `src/components/SessionsPanel.tsx`).

### Backend (`artifacts/api-server`)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Connection string de PostgreSQL. Ej: `postgresql://user:pass@host:5432/dbname` |
| `PORT` | Puerto del servidor (por defecto 8080) |
| `NODE_ENV` | `development` o `production` |

> La **clave API de OpenAI** no se configura en el servidor ni en el build — es opcional y la introduce cada usuario en la interfaz de la app, que la guarda en su propio `localStorage`.

---

## Problemas conocidos y soluciones

### 1. Error: `Cannot find module @rollup/rollup-darwin-arm64` (o `lightningcss-darwin-arm64`, `@esbuild/darwin-arm64`…)

**Causa:** un `pnpm-lock.yaml` antiguo, de cuando el repositorio bloqueaba todos los binarios nativos que no fueran de Linux x64.

**Solución:** actualiza y reinstala desde cero.

```bash
git pull
rm -rf node_modules artifacts/*/node_modules lib/*/node_modules scripts/node_modules
pnpm install
```

Si además `node -p "process.arch"` dice `x64` en un Mac con Apple Silicon, tu terminal corre bajo Rosetta y Node ha instalado los binarios de Intel — ver [DESPLIEGUE.md](./DESPLIEGUE.md#9-problemas-frecuentes-en-apple-silicon).

---

### 2. Error: `PORT environment variable is required but was not provided`

**Causa:** una versión antigua del `vite.config.ts`, que exigía `PORT` y `BASE_PATH` como variables de proceso.

**Solución:** actualiza el repositorio (`git pull`). En la versión actual ambas son opcionales, con `3000` y `/` por defecto.

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

- **Determinista primero, IA al final:** la ruta normal es lectura offline del documento en el navegador. Al modelo solo se llega si el archivo no tiene capa de texto, si no se reconoce ninguna tabla, o si el operario pide una verificación.
- **El encabezado manda:** `fields.ts` guarda el diccionario de sinónimos ES/EN/IT; una vez reconocido un encabezado, su rango de x pasa a ser una banda y todo lo que cae debajo es dato. Los encabezados que no usamos también reservan banda, para que sus valores no contaminen la columna vecina.
- **Las celdas combinadas son geometría, no adivinanza:** una celda de contenedor que abarca k líneas se imprime en su punto medio, así que su posición codifica cuántas abarca. `buildRows.ts` resuelve esa recurrencia en vez de emparejar por cercanía, que se equivoca justo en los bordes de bloque.
- **Vacío no es cero:** `parseNumber` devuelve `null` para una celda en blanco y `0` para un cero impreso. Una columna que el documento trae nunca se recalcula; solo se aplican las fórmulas cerámicas a las que faltan del todo, y la app informa de cuáles.
- **Se valida sola:** `validate.ts` compara las sumas con los totales que el propio documento imprime. Que cuadren es la señal de que no hace falta IA; que no cuadren se reporta por columna y baja la fiabilidad.
- **Un modelo, dos renderizadores:** `nexoraPdfTheme.ts` y `packingGroups.ts` los comparten el exportador de PDF y el de DOCX, así que no pueden divergir. Todos los anchos son proporción de página: vertical y horizontal son el mismo documento reflowado.
- **IA 100% client-side:** cuando se usa, la llamada a OpenAI va del navegador del usuario con su propia clave. No hay proxy de backend ni coste de servidor.
- **Backend opcional:** la app es completamente funcional sin el `api-server`. Las sesiones guardadas son lo único que lo requiere.
