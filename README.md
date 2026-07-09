# Kora - Smart Finance 🚀

Kora es una suite de gestión financiera personal diseñada para ser inteligente, visual y colaborativa.

## Características principales
- **Gestión Multi-moneda**: Soporte para ARS y USD con tipos de cambio manuales (Oficial/Blue).
- **Control de Cuentas**: Seguimiento de Débito, Crédito, Inversiones y Efectivo.
- **Gastos Compartidos**: Registro de gastos personales y de pareja, con reparto ajustable (predeterminado 50/50).
- **Cierre Mensual**: Liquidación de cuentas a fin de mes con historial de cierres (quién pagó cuánto, % aplicado y monto a transferir).
- **Multi-usuario**: Cada miembro de la pareja ingresa con su propio usuario (Google OAuth o perfil con PIN).
- **Kora AI**: Integración con n8n para consultas inteligentes sobre tus finanzas.
- **Sincronización Cloud**: Conexión con Google Sheets como base de datos persistente, con cola offline.

## Tecnologías
- React 19
- Tailwind CSS 4 (compilado en build, sin CDN)
- Lucide React (Iconos)
- Recharts (Gráficos)
- Vite (Build Tool)

## Instalación
1. Clona el repositorio.
2. Instala dependencias: `npm install`
3. Inicia el servidor de desarrollo: `npm run dev`

## Configuración de Google Sheets
Hay dos modos de conexión:

1. **API directa (recomendado)**: en la pantalla de configuración inicial ingresa tu *Client ID* de Google OAuth y el *Spreadsheet ID*. Cada usuario inicia sesión con su cuenta de Google.
2. **Apps Script (legacy)**: despliega el archivo `backend.gs` incluido en este proyecto como una Web App en Google Apps Script y pega la URL resultante en la sección de Ajustes de Kora.

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
