# Operacion del IA Service

## Objetivo
Estandarizar despliegue, operacion y soporte del `ia-service` en entornos internos.

## Dependencias
- MongoDB operativo.
- Archivo bootstrap de agentes:
  - `src/app/bootstrap/tenant-agents.config.json`
- Variables de entorno cargadas (`.env`).

## Puesta en marcha
### Desarrollo
```bash
pnpm setup:dev
```

### Produccion local con Docker Compose
```bash
pnpm setup:prod
```

## Verificacion inicial
1. Health check:
```bash
curl -s http://localhost:3000/api/v1/ia/health
```

2. Ejecucion sync:
```bash
curl -s -X POST http://localhost:3000/api/v1/ia/execute \
  -H 'content-type: application/json' \
  -d '{
    "tenantId":"acme",
    "agentId":"incident-summarizer",
    "goal":"Resume el incidente actual"
  }'
```

3. Metricas:
```bash
curl -s "http://localhost:3000/api/v1/ia/metrics/acme"
```

## Checklist de despliegue
- `.env` presente y consistente con entorno.
- `tenant-agents.config.json` versionado o montado correctamente.
- Conectividad a Mongo (`MONGO_URI`).
- Build y pruebas en verde:
  - `pnpm build`
  - `pnpm test:unit:cov`
  - `pnpm test:e2e`

## Troubleshooting rapido
### Error IA-2003
Causa: `MONGO_URI` ausente.
Accion: verificar `.env` y conectividad al host Mongo.

### Error IA-2001 / IA-2002
Causa: archivo bootstrap no existe o JSON invalido.
Accion: restaurar desde `tenant-agents.config.example.json` y validar JSON.

### Fallback agotado (IA-4000)
Causa: proveedores no disponibles o simulados en falla.
Accion: revisar `IA_SIMULATE_PROVIDER_FAILURES` y configuracion de `provider/fallbackProviders`.

## Seguridad operativa
- No exponer Mongo fuera de red interna sin necesidad.
- Mantener `tenant-agents.config.json` con permisos restringidos.
- Evitar incluir secretos reales en `goal/context`.
