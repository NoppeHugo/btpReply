#!/usr/bin/env bash
# Backup quotidien de la base Postgres (F11 audit).
# À installer en cron sur le VPS :  0 2 * * * /opt/btpreply/scripts/backup-db.sh
#
# ⚠️ Un backup qui reste sur le même disque ne protège pas d'une perte du VPS :
# synchroniser BACKUP_DIR vers un stockage externe (Hetzner Storage Box via
# rclone/rsync, ou S3 compatible) une fois ce script en place.

set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/btpreply}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/btpreply}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

POSTGRES_USER="${POSTGRES_USER:-btpreply}"
POSTGRES_DB="${POSTGRES_DB:-btpreply}"

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y-%m-%d_%H%M%S)"
TARGET="$BACKUP_DIR/btpreply_$STAMP.sql.gz"

cd "$COMPOSE_DIR"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$TARGET"

# Vérification minimale : un dump vide = problème.
if [ ! -s "$TARGET" ]; then
  echo "ERREUR: backup vide ($TARGET)" >&2
  exit 1
fi

# Rotation
find "$BACKUP_DIR" -name "btpreply_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

echo "Backup OK: $TARGET ($(du -h "$TARGET" | cut -f1))"
