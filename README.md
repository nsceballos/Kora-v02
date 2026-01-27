# Kora - Smart Finance 🚀

Kora es una suite de gestión financiera personal diseñada para ser inteligente, visual y colaborativa.

## Características principales
- **Gestión Multi-moneda**: Soporte para ARS y USD con tipos de cambio manuales (Oficial/Blue).
- **Control de Cuentas**: Seguimiento de Débito, Crédito, Inversiones y Efectivo.
- **Gastos Compartidos**: Sistema de división 50/50 ideal para parejas.
- **Kora AI**: Integración con n8n para consultas inteligentes sobre tus finanzas.
- **Sincronización Cloud**: Conexión con Google Sheets como base de datos persistente.

## Tecnologías
- React 19
- Tailwind CSS
- Lucide React (Iconos)
- Recharts (Gráficos)
- Vite (Build Tool)

## Instalación
1. Clona el repositorio.
2. Instala dependencias: `npm install`
3. Inicia el servidor de desarrollo: `npm run dev`

## Configuración de Google Sheets
Para usar la persistencia, despliega el archivo `backend.gs` incluido en este proyecto como una Web App en Google Apps Script y pega la URL resultante en la sección de Ajustes de Kora.
