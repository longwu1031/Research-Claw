#!/usr/bin/env bash
# Backup Research-Claw workspace, config, and database
set -euo pipefail

cd "$(dirname "$0")/.."

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/research-claw-${TIMESTAMP}"

echo "=== Research-Claw Backup ==="
echo "Backup to: $BACKUP_DIR"

mkdir -p "$BACKUP_DIR"

# Workspace (bootstrap files)
[ -d workspace ] && cp -r workspace "$BACKUP_DIR/workspace" && echo "[OK] workspace/"

# Config
[ -d config ] && cp -r config "$BACKUP_DIR/config" && echo "[OK] config/"

# SQLite database (check both possible locations)
DB_FOUND=false
for DB_PATH in ".research-claw/library.db" "$HOME/.research-claw/library.db"; do
  if [ -f "$DB_PATH" ]; then
    mkdir -p "$BACKUP_DIR/db"
    cp "$DB_PATH" "$BACKUP_DIR/db/library.db"
    # Also backup WAL/SHM if they exist (active database)
    [ -f "${DB_PATH}-wal" ] && cp "${DB_PATH}-wal" "$BACKUP_DIR/db/library.db-wal"
    [ -f "${DB_PATH}-shm" ] && cp "${DB_PATH}-shm" "$BACKUP_DIR/db/library.db-shm"
    echo "[OK] database: $DB_PATH"
    DB_FOUND=true
    break
  fi
done
$DB_FOUND || echo "[SKIP] No database found"

# Custom skills
[ -d skills ] && [ "$(ls -A skills 2>/dev/null)" ] && \
  cp -r skills "$BACKUP_DIR/skills" && echo "[OK] skills/"

echo ""
echo "Backup complete: $BACKUP_DIR"
du -sh "$BACKUP_DIR" 2>/dev/null || ls -la "$BACKUP_DIR"
