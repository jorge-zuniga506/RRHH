# Garnier eNPS

Backend del sistema de medicion de clima organizacional con metodologia eNPS.

## Stack
- Node.js + Express
- SQL (MySQL/PostgreSQL via variables de conexion)
- REST API
- IA (Gemini) para analisis de respuestas abiertas
- Exportacion a Excel

## API
- `GET /api/health`
- `POST /api/enps/survey`
- `GET /api/enps/dashboard`
- `GET /api/enps/export/excel`

## Variables de entorno
Crear `.env`:

```env
PORT=3003
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=garnier_hr_suite
TOTAL_EMPLOYEES=0
GEMINI_API_KEY=
```

## Ejecutar
```bash
npm install
npm run dev
```
