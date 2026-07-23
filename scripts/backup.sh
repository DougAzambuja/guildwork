#!/bin/bash
# Backup automatizado do MongoDB — GuildWork
# Gera dump com timestamp, registra log estruturado e mantém apenas os últimos 7 backups.

set -euo pipefail

MONGO_HOST="${MONGO_HOST:-localhost}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_DB="${MONGO_DB:-guildwork}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
LOG_FILE="${BACKUP_DIR}/backup.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="guildwork_backup_${TIMESTAMP}.gz"
ARCHIVE_PATH="${BACKUP_DIR}/${ARCHIVE_NAME}"

mkdir -p "${BACKUP_DIR}"

START_TIME=$(date +%s%3N)

log() {
    local level="$1"
    local message="$2"
    local extra="${3:-}"
    echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"${level}\",\"message\":\"${message}\"${extra}}" | tee -a "${LOG_FILE}"
}

log "info" "Iniciando backup" ",\"host\":\"${MONGO_HOST}\",\"db\":\"${MONGO_DB}\""

mongodump \
    --host="${MONGO_HOST}:${MONGO_PORT}" \
    --db="${MONGO_DB}" \
    --archive="${ARCHIVE_PATH}" \
    --gzip \
    --quiet

EXIT_CODE=$?
END_TIME=$(date +%s%3N)
DURATION=$(( END_TIME - START_TIME ))

if [ ${EXIT_CODE} -ne 0 ]; then
    log "error" "Backup falhou" ",\"exit_code\":${EXIT_CODE},\"duration_ms\":${DURATION}"
    exit 1
fi

FILE_SIZE=$(du -sh "${ARCHIVE_PATH}" | cut -f1)

log "info" "Backup concluído com sucesso" \
    ",\"file\":\"${ARCHIVE_NAME}\",\"size\":\"${FILE_SIZE}\",\"duration_ms\":${DURATION}"

# Manter apenas os últimos 7 backups
BACKUP_COUNT=$(ls "${BACKUP_DIR}"/*.gz 2>/dev/null | wc -l)
if [ "${BACKUP_COUNT}" -gt 7 ]; then
    ls -t "${BACKUP_DIR}"/*.gz | tail -n +8 | while read OLD_FILE; do
        rm -f "${OLD_FILE}"
        log "info" "Backup antigo removido" ",\"file\":\"$(basename ${OLD_FILE})\""
    done
fi
