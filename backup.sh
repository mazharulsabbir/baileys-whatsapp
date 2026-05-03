#!/bin/bash

#
# Backup Script
# Backs up database, sessions, and media files
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Baileys WhatsApp API - Backup${NC}"
echo -e "${GREEN}========================================${NC}"

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo -e "${RED}ERROR: .env.production not found${NC}"
    exit 1
fi

# Backup directory
BACKUP_ROOT="${BACKUP_PATH:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

echo -e "\n${YELLOW}Creating backup directory: ${BACKUP_DIR}${NC}"
mkdir -p "${BACKUP_DIR}"

# Backup database
echo -e "\n${YELLOW}Backing up database...${NC}"
docker-compose -f docker-compose.production.yml exec -T db pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} | gzip > "${BACKUP_DIR}/database.sql.gz"
echo -e "${GREEN}✓${NC} Database backed up: ${BACKUP_DIR}/database.sql.gz"

# Backup sessions
if [ -d "./sessions" ]; then
    echo -e "\n${YELLOW}Backing up WhatsApp sessions...${NC}"
    tar -czf "${BACKUP_DIR}/sessions.tar.gz" -C . sessions
    echo -e "${GREEN}✓${NC} Sessions backed up: ${BACKUP_DIR}/sessions.tar.gz"
fi

# Backup media cache
if [ -d "./wa-media-cache" ]; then
    echo -e "\n${YELLOW}Backing up media cache...${NC}"
    tar -czf "${BACKUP_DIR}/media.tar.gz" -C . wa-media-cache
    echo -e "${GREEN}✓${NC} Media backed up: ${BACKUP_DIR}/media.tar.gz"
fi

# Backup webhook DLQ logs
if [ -d "./logs/webhook-dlq" ]; then
    echo -e "\n${YELLOW}Backing up webhook DLQ logs...${NC}"
    tar -czf "${BACKUP_DIR}/webhook-dlq.tar.gz" -C . logs/webhook-dlq
    echo -e "${GREEN}✓${NC} DLQ logs backed up: ${BACKUP_DIR}/webhook-dlq.tar.gz"
fi

# Create backup manifest
echo -e "\n${YELLOW}Creating backup manifest...${NC}"
cat > "${BACKUP_DIR}/manifest.txt" << EOF
Backup Created: $(date)
Database: ${POSTGRES_DB}
Application URL: ${NEXT_PUBLIC_APP_URL}
Odoo URL: ${ODOO_BASE_URL}

Files:
$(ls -lh "${BACKUP_DIR}")
EOF
echo -e "${GREEN}✓${NC} Manifest created"

# Calculate backup size
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Backup completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Location: ${BACKUP_DIR}"
echo -e "Size: ${BACKUP_SIZE}"

# Cleanup old backups
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
echo -e "\n${YELLOW}Cleaning up backups older than ${RETENTION_DAYS} days...${NC}"
find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} \;
echo -e "${GREEN}✓${NC} Cleanup completed"

echo -e "\n${GREEN}Backup complete!${NC}"
