# IA Service

Servicio de orquestacion de agentes IA para uso interno entre microservicios.

## Alcance
- Ejecucion de agentes en modo sincronico y streaming.
- Seleccion de proveedor/modelo con fallback.
- Guardrails de entrada y salida.
- Memoria de sesion.
- Trazabilidad de ejecuciones.
- Metricas de uso y costo estimado por tenant.

## Stack
- NestJS
- MongoDB
- Swagger
- Jest (unit + e2e)
- Docker / Docker Compose

## Endpoints base
- `GET /api/v1/ia/health`
- `POST /api/v1/ia/execute`
- `POST /api/v1/ia/execute/stream`
- `GET /api/v1/ia/metrics/:tenantId`

## Variables de entorno
Variables principales:
- `PORT`
- `NODE_ENV`
- `MONGO_URI`
- `MONGO_DB_NAME`
- `IA_TENANT_CONFIG_PATH`
- `IA_SESSION_MEMORY_LIMIT`
- `IA_GUARDRAIL_INPUT_BLOCKLIST`
- `IA_GUARDRAIL_OUTPUT_BLOCKLIST`
- `IA_SIMULATE_PROVIDER_FAILURES`
- `IA_DEFAULT_INPUT_COST_PER_1K_TOKENS_USD`
- `IA_DEFAULT_OUTPUT_COST_PER_1K_TOKENS_USD`

Usa `.env.example` como base:
```bash
cp .env.example .env
```

## Inicio rapido (desarrollo)
1. Preparar entorno y configuracion bootstrap.
```bash
pnpm setup:dev
```

2. Alternativa manual.
```bash
cp .env.example .env
cp src/app/bootstrap/tenant-agents.config.example.json src/app/bootstrap/tenant-agents.config.json
pnpm install
pnpm start:dev
```

## Scripts principales
- `pnpm setup`
- `pnpm setup:dev`
- `pnpm setup:prod`
- `pnpm start:dev`
- `pnpm build`
- `pnpm test`
- `pnpm test:unit`
- `pnpm test:unit:cov`
- `pnpm test:e2e`

## Docker
Despliegue con stack local (`ia-service` + `mongo`):
```bash
docker compose up -d --build
```

Notas:
- El servicio expone `3000`.
- Mongo se conecta por red interna de Docker.
- El archivo `tenant-agents.config.json` se monta como volumen de solo lectura.

## Pruebas
```bash
pnpm test:unit
pnpm test:unit:cov
pnpm test:e2e
```

## Documentacion operativa
Ver guia operativa en:
- [docs/OPERACION_PROYECTO.md](docs/OPERACION_PROYECTO.md)
