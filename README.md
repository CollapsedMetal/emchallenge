# EM Challenge

Servicio de extracción de datos fiscales que obtiene, normaliza y almacena datos de facturas desde múltiples proveedores de autoridades tributarias (Chile SII, México SAT). Construido con Express, colas Bull, PostgreSQL y Redis.

## Arquitectura

- **Express API** — Endpoints REST para ejecutar extracciones, gestionar agendamientos y consultar el estado de los jobs
- **Bull Queue** — Cola de trabajos respaldada por Redis con lógica de reintentos, soporte de prioridad y agendamiento cron
- **Workers** — Procesadores de jobs concurrentes (concurrencia: 10) que obtienen y normalizan datos fiscales
- **Providers** — Patrón de proveedor abstracto que soporta Chile SII y México SAT, con un modelo de factura normalizado
- **PostgreSQL** — Almacenamiento persistente para seguimiento de jobs y datos de facturas
- **Bull Board** — Interfaz web para monitoreo de colas en `/queues`

## Requisitos Previos

- Docker y Docker Compose

## Inicio Rápido

```bash
docker compose up --build
```

El servidor API inicia en el puerto **3000**.

## Endpoints de la API

### Extraer Datos Fiscales (una vez)

```bash
curl -X GET http://localhost:3000/extractFiscalData \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "org-666",
    "period": "2026-03",
    "options": { "provider_name": "chile_sii", "priority": "1" }
  }'
```

### Agregar Extracción Programada

```bash
curl -X POST http://localhost:3000/extractFiscalDataAddSchedule \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "org-666",
    "options": {
      "provider_name": "chile_sii",
      "priority": "1",
      "cron": "* * * * *",
      "timeZone": "America/Santiago"
    }
  }'
```

### Eliminar Extracción Programada

```bash
curl -X POST http://localhost:3000/extractFiscalDataRemoveSchedule \
  -H "Content-Type: application/json" \
  -d '{ "jobId": "<repeatable-job-id>" }'
```

### Gestión de Jobs

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/jobs/:id` | Obtener job por ID |
| GET | `/jobs/status/:status` | Listar jobs por estado (`?limit=100&offset=0`) |
| GET | `/jobs/queue/:queue` | Listar jobs por nombre de cola |
| GET | `/stats` | Estadísticas de jobs |
| GET | `/queues` | Interfaz Bull Board |

### Datos de Ejemplo

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/getFiscalDataSII` | Datos SII de ejemplo paginados (`?period=&rut_receptor=&page=1`) |
| POST | `/sii_authenticate` | Autenticación SII simulada |

## Base de Datos

El esquema de la tabla `jobs` se encuentra en [table_create.sql](table_create.sql).
