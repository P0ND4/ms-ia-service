#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

compose_cmd() {
	if command -v docker-compose >/dev/null 2>&1; then
		echo "docker-compose"
		return
	fi

	if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
		echo "docker compose"
		return
	fi

	echo "ERROR: Docker Compose is not available (docker compose or docker-compose)." >&2
	exit 1
}

ensure_env_file() {
	if [[ -f .env ]]; then
		return
	fi

	if [[ -f .env.example ]]; then
		cp .env.example .env
		echo "Created .env from .env.example"
		return
	fi

	echo "ERROR: .env not found and .env.example is missing." >&2
	exit 1
}

ensure_tenant_config() {
	if [[ -f src/app/bootstrap/tenant-agents.config.json ]]; then
		return
	fi

	if [[ -f src/app/bootstrap/tenant-agents.config.example.json ]]; then
		cp src/app/bootstrap/tenant-agents.config.example.json src/app/bootstrap/tenant-agents.config.json
		echo "Created src/app/bootstrap/tenant-agents.config.json from tenant-agents.config.example.json"
		return
	fi

	echo "ERROR: tenant-agents.config.json not found and tenant-agents.config.example.json is missing." >&2
	exit 1
}

COMPOSE="$(compose_cmd)"

ensure_env_file
ensure_tenant_config

echo "Starting production stack (ia-service, mongo)..."
$COMPOSE up -d --build

echo "Production stack started successfully."
