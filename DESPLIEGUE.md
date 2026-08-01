# Guía de despliegue — Nexora Ceramica · Generador de Packing Lists

Guía completa para poner en marcha la aplicación **en un Mac con Apple Silicon (M1/M2/M3/M4)**, tanto en local como para publicarla en un hosting.

Las instrucciones sirven igual en Mac con Intel, Linux y Windows; donde haya alguna diferencia se indica.

---

## Índice

- [Qué se despliega exactamente](#qué-se-despliega-exactamente)
- [1. Preparar el Mac](#1-preparar-el-mac)
- [2. Clonar e instalar](#2-clonar-e-instalar)
- [3. Ejecutar en local](#3-ejecutar-en-local)
- [4. Generar el build de producción](#4-generar-el-build-de-producción)
- [5. Publicar en un hosting (Hostinger u otro)](#5-publicar-en-un-hosting-hostinger-u-otro)
- [6. Backend de sesiones (opcional)](#6-backend-de-sesiones-opcional)
- [7. Clave de OpenAI (opcional)](#7-clave-de-openai-opcional)
- [8. Comprobación final](#8-comprobación-final)
- [9. Problemas frecuentes en Apple Silicon](#9-problemas-frecuentes-en-apple-silicon)
- [10. Actualizar una instalación ya desplegada](#10-actualizar-una-instalación-ya-desplegada)

---

## Qué se despliega exactamente

La aplicación es una **SPA totalmente estática**. El build produce un `index.html`, un `.js`, un `.css` y el worker de pdf.js. No hay servidor propio, no hay base de datos y no hay claves en el servidor:

- La lectura de los PDF y los Word ocurre **dentro del navegador del usuario**.
- La generación del PDF y del DOCX ocurre **dentro del navegador del usuario**.
- Los documentos que sube el usuario **nunca salen de su máquina**, salvo que pulse expresamente algo que use la IA (leer un escaneo o «Verificar con IA»), en cuyo caso van directamente a OpenAI con la clave del propio usuario.

Esto significa que cualquier hosting que sirva archivos estáticos vale: Hostinger, Netlify, Vercel, GitHub Pages, un bucket de S3, o el propio Mac.

El `api-server` con PostgreSQL es **opcional** y solo añade la función de guardar y recuperar sesiones con nombre.

**Navegadores:** Safari, Chrome, Firefox y Edge en sus versiones actuales. Toda la lectura de documentos y la generación del PDF ocurren en el navegador, así que conviene probar el despliegue en el navegador que se vaya a usar en la oficina.

---

## 1. Preparar el Mac

### 1.1 Herramientas de línea de comandos de Xcode

```bash
xcode-select --install
```

Si ya están instaladas dirá `command line tools are already installed`, que es correcto.

### 1.2 Homebrew

Si no lo tienes:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> En Apple Silicon, Homebrew se instala en `/opt/homebrew` (no en `/usr/local`). El propio instalador te dirá al final que añadas esto a tu `~/.zprofile`:
> ```bash
> echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
> eval "$(/opt/homebrew/bin/brew shellenv)"
> ```

### 1.3 Node.js con nvm

El repositorio incluye un archivo `.nvmrc`, así que basta con:

```bash
brew install nvm
mkdir -p ~/.nvm
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
source ~/.zshrc
```

Y después, ya dentro de la carpeta del proyecto (paso 2):

```bash
nvm install    # lee .nvmrc e instala la versión indicada (24)
nvm use
```

> **Importante:** instala Node **nativo arm64**, no bajo Rosetta. Compruébalo con:
> ```bash
> node -p "process.arch"   # debe imprimir: arm64
> ```
> Si imprime `x64` estás en una terminal ejecutándose bajo Rosetta. Cierra esa terminal, busca Terminal/iTerm en Finder → *Obtener información* → desmarca *Abrir con Rosetta*, y vuelve a instalar Node.

### 1.4 pnpm

El repositorio **obliga a usar pnpm** — hay un script `preinstall` que bloquea npm y yarn.

```bash
npm install -g pnpm
```

Comprueba las versiones:

```bash
node --version    # v24.x.x
pnpm --version    # 10.x
node -p "process.arch"  # arm64
```

---

## 2. Clonar e instalar

```bash
git clone https://github.com/muya03/PackingListPage.git
cd PackingListPage

nvm use          # usa la versión de .nvmrc
pnpm install
```

Debería terminar en menos de un minuto sin errores.

> **Nota histórica:** las versiones anteriores del repositorio bloqueaban en `pnpm-workspace.yaml` todos los binarios nativos que no fueran Linux x64, y había que borrar a mano las líneas con `darwin` antes de instalar. **Eso ya no hace falta**: el `pnpm-lock.yaml` incluye los binarios de `darwin-arm64` (rollup, esbuild, lightningcss y @tailwindcss/oxide) y pnpm elige automáticamente los de tu plataforma.

---

## 3. Ejecutar en local

```bash
pnpm --filter @workspace/nexora-app run dev
```

Abre `http://localhost:3000`.

Si necesitas otro puerto o servir la app desde una subcarpeta:

```bash
PORT=4000 BASE_PATH=/ pnpm --filter @workspace/nexora-app run dev
```

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor de desarrollo |
| `BASE_PATH` | `/` | Ruta base. Cámbiala solo si la app se sirve desde una subcarpeta, p. ej. `/packinglist/` |

Ambas son **opcionales**: sin ellas la app arranca con los valores por defecto.

### Prueba rápida de que funciona

1. Arrastra un packing list o una factura en PDF de un proveedor.
2. Pulsa **Extraer datos**.
3. Debe aparecer arriba a la derecha un recuadro verde: **«Lectura directa del PDF (sin IA)»**, con el número de líneas, las columnas reconocidas y un porcentaje de fiabilidad.
4. Pulsa **Generar PDF · Vertical**: se descarga el packing list con el modelo de NEXORA.

Si eso funciona, todo está bien instalado. No hace falta ninguna clave de API.

---

## 4. Generar el build de producción

```bash
pnpm --filter @workspace/nexora-app run build
```

El resultado queda en `artifacts/nexora-app/dist/public/`:

```
artifacts/nexora-app/dist/public/
├── index.html
└── assets/
    ├── index-XXXXXXXX.js          ← la aplicación
    ├── index-XXXXXXXX.css         ← los estilos
    └── pdf.worker.min-XXXXXXXX.mjs ← el lector de PDF (obligatorio)
```

> ⚠️ **El archivo `pdf.worker.min-*.mjs` es imprescindible.** Es el que lee los PDF sin IA. Si al subir los archivos se queda por el camino, la aplicación cargará pero fallará al extraer datos de cualquier PDF. Sube siempre la carpeta `assets/` entera.

### Si vas a servir desde una subcarpeta

Si la app no va a vivir en la raíz del dominio sino en, por ejemplo, `https://tudominio.com/packinglist/`:

```bash
BASE_PATH=/packinglist/ pnpm --filter @workspace/nexora-app run build
```

Las barras inicial y final son obligatorias.

### Comprobar el build antes de subirlo

```bash
pnpm --filter @workspace/nexora-app run serve
```

Levanta `http://localhost:3000` sirviendo exactamente los archivos que vas a subir. Repite la prueba rápida del punto 3.

---

## 5. Publicar en un hosting (Hostinger u otro)

### 5.1 Localizar la carpeta

En el panel de Hostinger (hPanel) → **Hosting** → tu plan → **Administrador de archivos**.

- Dominio principal → `public_html/`
- Subdominio → `public_html/tusubdominio.tudominio.com/`

Borra el contenido que haya (suele venir un `index.html` de bienvenida).

### 5.2 Subir los archivos

Sube el **contenido** de `artifacts/nexora-app/dist/public/`, no la carpeta en sí. Es decir: el `index.html` y la carpeta `assets/` deben quedar directamente en la raíz del dominio o subdominio.

Desde el Mac tienes dos opciones:

**Administrador de archivos de Hostinger** — cómodo para una vez. Comprime primero para no subir archivo a archivo:

```bash
cd artifacts/nexora-app/dist/public
zip -r ../../../../packinglist.zip .
```

Sube `packinglist.zip` y usa la opción *Extraer* del propio administrador. Borra el zip después.

**FTP con rsync o FileZilla** — mejor si vas a actualizar a menudo. Los datos de conexión están en hPanel → **Archivos** → **Cuentas FTP**.

### 5.3 Crear el archivo `.htaccess`

**Este paso es obligatorio en Apache/Hostinger.** Sin él, recargar la página o entrar directamente a una ruta da un 404, porque el servidor busca un archivo físico que no existe: todo el enrutado ocurre en el navegador.

Crea un archivo `.htaccess` en la raíz del dominio o subdominio con:

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

En el administrador de archivos: **Nuevo archivo** → nombre `.htaccess` → pega el contenido → guardar.

> La línea `AddType` evita que algunos servidores manden los archivos `.mjs` como texto plano, lo que impediría cargar el lector de PDF.

### 5.4 Otros hostings

| Hosting | Qué hacer |
|---|---|
| **Netlify / Vercel** | Arrastra `dist/public` o conecta el repositorio. Comando de build: `pnpm --filter @workspace/nexora-app run build`; carpeta de publicación: `artifacts/nexora-app/dist/public`. El *fallback* a `index.html` ya viene configurado. |
| **GitHub Pages** | Compila con `BASE_PATH=/PackingListPage/` y publica `dist/public`. Añade un archivo `.nojekyll` vacío. |
| **Nginx propio** | `location / { try_files $uri /index.html; }` y `types { text/javascript mjs; }` |

---

## 6. Backend de sesiones (opcional)

Solo si quieres guardar sesiones con nombre y recuperarlas después. **La aplicación funciona entera sin esto.**

Necesitas una base de datos PostgreSQL. Para empezar sirve el plan gratuito de [Neon](https://neon.tech) o [Supabase](https://supabase.com).

```bash
# Configura la conexión (la leen tanto el api-server como drizzle-kit)
echo "DATABASE_URL=postgresql://usuario:contraseña@host:5432/nexora" \
  > artifacts/api-server/.env

# Crea las tablas
DATABASE_URL="postgresql://usuario:contraseña@host:5432/nexora" \
  pnpm --filter @workspace/db run push

# Arranca el servidor
pnpm --filter @workspace/api-server run dev
```

El servidor queda en `http://localhost:8080` y expone `/api/sessions`.

> **Cómo lo localiza el frontend.** La app llama a `/api` **en su mismo origen** — no hay ninguna variable de entorno para apuntar a otro host. Es decir: el `api-server` tiene que estar detrás del mismo dominio que la web, en la ruta `/api`, mediante un proxy inverso. Si lo alojas en otro dominio tendrás que añadir ese proxy (o modificar `API_BASE` en `src/components/SessionsPanel.tsx`).

Para producción, el `api-server` es un proceso Node y **no puede correr en un hosting compartido de solo-estáticos como el de Hostinger**. Necesitarás un VPS, Railway, Render, Fly.io o similar, más el proxy inverso descrito arriba. Si no necesitas guardar sesiones, sáltate todo este apartado: la aplicación es completa sin él.

---

## 7. Clave de OpenAI (opcional)

La aplicación **no necesita ninguna clave** para su uso normal: los PDF digitales y los Word se leen en el navegador.

La clave solo hace falta para dos cosas:

1. **Documentos escaneados o fotos** — no tienen texto que leer, así que hay que mirar los píxeles.
2. **El botón «Verificar con IA»** — contrasta la tabla extraída con el texto del documento y señala discrepancias.

Cada usuario introduce su propia clave en el panel **Clave de API OpenAI (opcional)** de la barra lateral. Se guarda en el `localStorage` de su navegador y **no pasa por ningún servidor tuyo**: la petición va del navegador a OpenAI directamente.

No configures ninguna clave en el servidor ni en el build.

---

## 8. Comprobación final

Después de desplegar, entra en la URL pública y comprueba:

- [ ] La página carga con la cabecera negra de NEXORA y la línea dorada.
- [ ] Recargar con **⌘R** estando en la página no da 404 *(si falla: revisa el `.htaccess`)*.
- [ ] Al subir un PDF de proveedor y pulsar **Extraer datos** aparece «Lectura directa del PDF (sin IA)» *(si falla: revisa que se haya subido `pdf.worker.min-*.mjs`)*.
- [ ] El recuadro de incidencias dice «Totales verificados contra el documento».
- [ ] **Generar PDF · Vertical** descarga el packing list con el modelo de NEXORA.
- [ ] **Generar PDF · Horizontal** y **Packing List (DOCX)** también descargan.

Si algo falla, abre la consola del navegador (**⌥⌘I** en Safari o Chrome) y mira los errores en rojo.

---

## 9. Problemas frecuentes en Apple Silicon

### `Cannot find module @rollup/rollup-darwin-arm64`

**Causa:** un `pnpm-lock.yaml` antiguo, generado cuando el repositorio bloqueaba los binarios que no fueran de Linux.

**Solución:** asegúrate de estar en la última versión de `main` y reinstala desde cero:

```bash
git pull
rm -rf node_modules artifacts/*/node_modules lib/*/node_modules scripts/node_modules
pnpm install
```

El mismo procedimiento vale si el error menciona `lightningcss-darwin-arm64`, `@tailwindcss/oxide-darwin-arm64` o `@esbuild/darwin-arm64`.

### `Use pnpm instead`

Has ejecutado `npm install` o `yarn install`. El repositorio los bloquea a propósito. Usa `pnpm install`.

### El build o el dev server usan la arquitectura equivocada

```bash
node -p "process.arch"   # tiene que decir arm64
```

Si dice `x64`, tu terminal corre bajo Rosetta y Node ha instalado los binarios de Intel. Desactiva Rosetta en la terminal (Finder → app → *Obtener información* → desmarcar *Abrir con Rosetta*), reinstala Node con `nvm install 24 --reinstall-packages-from=current` y vuelve a hacer `pnpm install` desde cero.

### `PORT environment variable is required`

Es un error de versiones antiguas. En la versión actual `PORT` y `BASE_PATH` son opcionales. Actualiza el repositorio con `git pull`.

### La app carga pero no extrae nada de los PDF

Casi siempre falta el archivo `pdf.worker.min-*.mjs` de la carpeta `assets/`, o el servidor lo sirve con el tipo MIME equivocado. Revisa el paso 5.3.

### Safari: `undefined is not a function (near '...value of readableStream...')`

**Causa:** una versión anterior de la app leía el PDF con `getTextContent()` de pdf.js, que internamente usa `for await (… of readableStream)`. Safari no implementa la iteración asíncrona de `ReadableStream`, así que ese `for await` fallaba y no se extraía nada. En Chrome y Firefox no se notaba porque ambos sí la implementan.

**Solución:** actualiza la aplicación (`git pull`) y vuelve a compilar y subir el build. La versión actual lee el mismo flujo con `getReader()`, que funciona en todos los navegadores.

---

### `EACCES` al instalar pnpm globalmente

No uses `sudo`. Configura un prefijo propio para npm:

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
npm install -g pnpm
```

---

## 10. Actualizar una instalación ya desplegada

```bash
cd PackingListPage
git pull
nvm use
pnpm install          # solo si han cambiado las dependencias
pnpm --filter @workspace/nexora-app run build
```

Y vuelve a subir el contenido de `artifacts/nexora-app/dist/public/` al hosting, reemplazando lo anterior.

> Los nombres de los archivos de `assets/` incluyen un hash que cambia en cada build. **Borra el contenido antiguo de `assets/` antes de subir el nuevo**, o se irán acumulando versiones viejas. El `.htaccess` no se toca.
