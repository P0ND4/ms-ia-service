#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

normalize_env() {
	printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

TARGET_ENV="${ENVIRONMENT:-${APP_ENV:-${NODE_ENV:-${DBOX_ENV:-development}}}}"
TARGET_ENV="$(normalize_env "$TARGET_ENV")"

case "$TARGET_ENV" in
	prod|production|staging)
		echo "Environment detected: $TARGET_ENV -> running production setup"
		exec bash ./setup-prod.sh
		;;
	*)
		echo "Environment detected: $TARGET_ENV -> running development setup"
		exec bash ./setup-dev.sh
		;;
esac
