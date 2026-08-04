# Kora - Smart Finance 🚀

Kora es una suite de gestión financiera personal diseñada para ser inteligente, visual y colaborativa.

## Características principales
- **Cuentas de usuario reales**: cada persona se registra con su email y contraseña. Sus transacciones, cuentas, categorías, presupuestos y cierres son 100% privados — ningún otro usuario puede verlos ni modificarlos.
- **Gestión Multi-moneda**: Soporte para ARS y USD con tipos de cambio manuales (Oficial/Blue).
- **Control de Cuentas**: Seguimiento de Débito, Crédito, Inversiones y Efectivo.
- **Gastos Compartidos (informativo y privado)**: podés marcar un gasto como "compartido" y anotar quién lo pagó (vos o tu pareja) para llevar la cuenta de cuánto le corresponde a cada uno y quién le debe a quién. Es una ayuda personal: la persona con la que compartís gastos no necesita cuenta en Kora y jamás ve esta información — solo vos.
- **Cierre Mensual**: Liquidación de gastos compartidos a fin de mes con historial de cierres.
- **Kora AI**: Integración con n8n para consultas inteligentes sobre tus finanzas.
- **Sincronización Cloud**: Google Sheets como base de datos, vía una API serverless con cuenta de servicio, con cola offline.

## Tecnologías
- React 19
- Tailwind CSS 4 (compilado en build, sin CDN)
- Lucide React (Iconos)
- Recharts (Gráficos)
- Vite (Build Tool)
- Funciones serverless de Vercel (`/api`) + `google-auth-library` (Google Sheets) + `jsonwebtoken` + `bcryptjs` (autenticación)

## Arquitectura
El navegador **no** habla directamente con Google ni guarda credenciales de Google. Toda la persistencia pasa por dos endpoints serverless:

- `POST /api/auth` — registro e inicio de sesión. Devuelve un token de sesión (JWT).
- `POST /api/sheets` — todas las demás operaciones (leer/guardar gastos, cuentas, etc.). Requiere `Authorization: Bearer <token>`.

```
Navegador ──POST /api/auth (login/registro)──▶ Función serverless (Vercel) ──▶ Google Sheets (hoja "Usuarios")
Navegador ──POST /api/sheets (Bearer <token>)──▶ Función serverless (Vercel) ──▶ Google Sheets API
                                                   (cuenta de servicio, env vars)
```

### Cómo se garantiza que cada usuario solo vea sus propios datos
1. Al registrarte o iniciar sesión, el servidor verifica tu contraseña (hasheada con `bcrypt`, nunca se guarda en texto plano) y te devuelve un **token JWT** firmado con `KORA_JWT_SECRET`, que identifica tu `userId`.
2. El navegador guarda ese token y lo manda en cada request a `/api/sheets` como `Authorization: Bearer <token>`.
3. El servidor (`api/_handler.ts`) valida la firma del token y extrae el `userId` **antes** de tocar la hoja de cálculo — el cliente nunca puede decirle al servidor "actuá como otro usuario".
4. Cada fila de las hojas `Transacciones`, `Cuentas`, `Categorias`, `Presupuestos` y `Cierres` tiene una columna `UserId`. Toda lectura (`getAppData`) filtra por tu `userId`, y toda escritura se sella con tu `userId` (`api/_sheetsCore.ts`). Si alguien intenta modificar o borrar una fila que no le pertenece, el servidor responde `403 FORBIDDEN`.
5. La clave privada de Google y el secreto de firma de sesiones viven solo en variables de entorno del servidor — nunca llegan al navegador.

## Instalación
1. Clona el repositorio.
2. Instala dependencias: `npm install`
3. Copia `.env.example` a `.env` y completá las credenciales (ver abajo).
4. Iniciá el servidor de desarrollo: `npm run dev` (sirve la app y los endpoints `/api/sheets` y `/api/auth`).

## Configuración paso a paso

### 1. Google Cloud Console (cuenta de servicio para Google Sheets)
Esto es lo que le permite al servidor leer y escribir en tu hoja de cálculo, sin que el navegador nunca tenga credenciales de Google.

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/) y creá un proyecto nuevo (o usá uno existente). Arriba a la izquierda, junto al logo de Google Cloud → *Seleccionar proyecto* → *Proyecto nuevo* → poné un nombre (ej. "Kora Finance") → *Crear*.
2. Con el proyecto seleccionado, ve a **APIs y servicios → Biblioteca**, buscá **"Google Sheets API"** y hacé clic en **Habilitar**.
3. Ve a **APIs y servicios → Credenciales → + Crear credenciales → Cuenta de servicio**.
   - Nombre: por ejemplo `kora-bot`.
   - Continuá sin asignar ningún rol a nivel de proyecto (no es necesario) y hacé clic en **Listo**.
4. En la lista de cuentas de servicio, hacé clic en la que acabás de crear → pestaña **Claves** → **Agregar clave → Crear clave nueva → tipo JSON** → **Crear**. Se descarga un archivo `.json`: guardalo, de ahí vas a sacar `client_email` y `private_key`.
5. Copiá el valor de `client_email` del JSON (algo como `kora-bot@tu-proyecto.iam.gserviceaccount.com`) — es el `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
6. Copiá el valor completo de `private_key` del JSON (incluye `-----BEGIN PRIVATE KEY-----` ... `-----END PRIVATE KEY-----`) — es el `GOOGLE_PRIVATE_KEY`.
7. Creá una hoja de cálculo nueva en [Google Sheets](https://sheets.google.com) (puede estar vacía, Kora crea las pestañas que necesita sola).
8. Copiá el ID de la hoja de la URL: `https://docs.google.com/spreadsheets/d/`**`ESTE-ES-EL-ID`**`/edit` — es el `GOOGLE_SHEET_ID`.
9. **Importante**: hacé clic en **Compartir** en la hoja de cálculo y compartila con el email de la cuenta de servicio (paso 5), con rol **Editor**. Sin este paso, la app no va a poder leer ni escribir nada.

### 2. Secreto de sesiones (login)
Kora necesita una clave para firmar los tokens de sesión de los usuarios. Generá una cadena aleatoria larga, por ejemplo con:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Ese valor es tu `KORA_JWT_SECRET`. Guardalo en un lugar seguro: si lo perdés o lo cambiás, todas las sesiones activas se invalidan (los usuarios deben volver a iniciar sesión), pero ningún dato se pierde.

### 3. Vercel (deploy y variables de entorno)
1. Subí este repositorio a GitHub/GitLab/Bitbucket (o usá `vercel` desde la CLI).
2. En [vercel.com](https://vercel.com/), hacé clic en **Add New → Project** e importá el repositorio.
3. Vercel detecta automáticamente que es un proyecto Vite (build command `npm run build`, output `dist` — ya configurado en `vercel.json`). No hace falta tocar nada ahí.
4. Antes de darle **Deploy**, entrá a **Environment Variables** (o después, en el proyecto ya creado: **Settings → Environment Variables**) y agregá:

   | Variable | Valor |
   |---|---|
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | El `client_email` del paso 1.5 |
   | `GOOGLE_PRIVATE_KEY` | El `private_key` del paso 1.6 (podés pegarlo con saltos de línea reales) |
   | `GOOGLE_SHEET_ID` | El ID de la hoja del paso 1.8 |
   | `KORA_JWT_SECRET` | La cadena aleatoria del paso 2 |

   Marcá las 4 para los entornos que uses (Production, Preview, Development).
5. Hacé clic en **Deploy**. Cuando termine, la app va a estar disponible en la URL que te da Vercel, ya lista para que los usuarios se registren.

### Desarrollo local
Para local, en vez de configurar las variables en Vercel, copiá `.env.example` a `.env` en la raíz del repo y completá los mismos 4 valores. `npm run dev` los lee automáticamente (ver `vite.config.ts`).

### Hojas utilizadas
La app crea automáticamente estas hojas en el spreadsheet:

| Hoja | Contenido |
|---|---|
| `Transacciones` | Movimientos (gastos, ingresos, transferencias, inversiones), cada uno con su `UserId` |
| `Cuentas` | Cuentas y saldos, cada una con su `UserId` |
| `Categorias` | Categorías de gasto por usuario |
| `Presupuestos` | Límite mensual por categoría, por usuario |
| `Usuarios` | Cuentas registradas: ID, Nombre, Email, contraseña hasheada (`bcrypt`), color de avatar y fecha de registro |
| `Cierres` | Historial de cierres mensuales de gastos compartidos, por usuario |
| `Config` | Configuración personal (ej. nombre de tu pareja, % de reparto), con clave interna `<UserId>::<clave>` |

Ningún endpoint expone el contenido de `Usuarios` (ni siquiera la contraseña hasheada) al cliente: solo se usa server-side para autenticar.

> El archivo `backend.gs` (Google Apps Script) quedó como referencia histórica de un backend alternativo previo a la cuenta de servicio; no se usa ni está actualizado al esquema actual con `UserId`.

## Cierre mensual de gastos compartidos
En la vista **Gastos Pareja**:
1. En **Ajustes → Gastos Compartidos** definí el nombre de la persona con quien compartís gastos (es solo una etiqueta para tus propios registros, no una cuenta).
2. Ajustá el reparto de aportes con el control deslizante (predeterminado 50/50).
3. Kora calcula cuánto le corresponde a cada uno y quién debe transferir a quién, usando únicamente tus propios movimientos marcados como compartidos.
4. Con **"Cerrar el mes y saldar"** se marcan los gastos como saldados y se registra el cierre, visible luego en el historial.
