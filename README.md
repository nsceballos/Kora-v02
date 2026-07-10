# Kora - Smart Finance 🚀

Kora es una suite de gestión financiera personal diseñada para ser inteligente, visual y colaborativa.

## Características principales
- **Gestión Multi-moneda**: Soporte para ARS y USD con tipos de cambio manuales (Oficial/Blue).
- **Control de Cuentas**: Seguimiento de Débito, Crédito, Inversiones y Efectivo.
- **Gastos Compartidos**: Registro de gastos personales y de pareja, con reparto ajustable (predeterminado 50/50).
- **Cierre Mensual**: Liquidación de cuentas a fin de mes con historial de cierres (quién pagó cuánto, % aplicado y monto a transferir).
- **Multi-usuario**: Cada miembro de la pareja ingresa con su propio perfil (con PIN opcional).
- **Kora AI**: Integración con n8n para consultas inteligentes sobre tus finanzas.
- **Sincronización Cloud**: Google Sheets como base de datos, vía una API serverless con cuenta de servicio, con cola offline.

## Tecnologías
- React 19
- Tailwind CSS 4 (compilado en build, sin CDN)
- Lucide React (Iconos)
- Recharts (Gráficos)
- Vite (Build Tool)
- Funciones serverless de Vercel (`/api`) + `google-auth-library`

## Arquitectura
El navegador **no** habla directamente con Google ni guarda credenciales. Toda la persistencia pasa por un único endpoint serverless `POST /api/sheets`, que se autentica con una **cuenta de servicio** de Google usando variables de entorno. La clave privada nunca llega al cliente.

```
Navegador ──POST /api/sheets──▶ Función serverless (Vercel) ──▶ Google Sheets API
                                 (cuenta de servicio, env vars)
```

## Instalación
1. Clona el repositorio.
2. Instala dependencias: `npm install`
3. Copia `.env.example` a `.env` y completa las credenciales (ver abajo).
4. Inicia el servidor de desarrollo: `npm run dev` (sirve la app y el endpoint `/api/sheets`).

## Configuración de Google Sheets (cuenta de servicio)
1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto y habilita la **Google Sheets API**.
2. Crea una **cuenta de servicio** y genera una clave JSON.
3. Crea una hoja de cálculo de Google Sheets y **compártela con el email de la cuenta de servicio** (rol *Editor*).
4. Configura estas variables de entorno (en Vercel: *Project → Settings → Environment Variables*; en local: archivo `.env`):

| Variable | Descripción |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` del JSON de la cuenta de servicio |
| `GOOGLE_PRIVATE_KEY` | `private_key` del JSON (con `\n` reales o escapados) |
| `GOOGLE_SHEET_ID` | ID de la hoja (la parte de la URL entre `/d/` y `/edit`) |
| `KORA_ACCESS_TOKEN` | *(opcional)* código de acceso compartido; si se define, la app pide desbloquear al abrir |

No hay que configurar nada desde la interfaz de la app: al abrir, se conecta directamente con las credenciales del servidor.

> El archivo `backend.gs` (Google Apps Script) se conserva solo como referencia de un backend alternativo; no es necesario con la cuenta de servicio.

### Hojas utilizadas
La app crea automáticamente estas hojas en el spreadsheet:

| Hoja | Contenido |
|---|---|
| `Transacciones` | Movimientos (gastos, ingresos, transferencias, inversiones) |
| `Cuentas` | Cuentas y saldos |
| `Categorias` | Categorías de gasto |
| `Presupuestos` | Límite mensual por categoría |
| `Usuarios` | Usuarios de la pareja (perfil, color, PIN) |
| `Cierres` | Historial de cierres mensuales de gastos compartidos |
| `Config` | Configuración compartida (ej. `split_percents`, el % de aporte de cada uno) |

## Cierre mensual de gastos compartidos
En la vista **Gastos Pareja**:
1. Ajusta el reparto de aportes con el control deslizante (predeterminado 50/50, sincronizado entre ambos usuarios).
2. Kora calcula cuánto le corresponde a cada uno y quién debe transferir a quién.
3. Con **"Cerrar el mes y saldar"** se marcan los gastos como saldados y se registra el cierre en la hoja `Cierres`, visible luego en el historial.
