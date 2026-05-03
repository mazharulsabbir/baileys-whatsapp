#!/bin/bash

#
# Production Deployment Script
# Baileys WhatsApp API with Odoo ChatRoom Integration
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Baileys WhatsApp API - Production Deploy${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}ERROR: .env.production file not found${NC}"
    echo -e "${YELLOW}Copy .env.production.example to .env.production and configure it${NC}"
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Validate required environment variables
REQUIRED_VARS=(
    "DATABASE_URL"
    "AUTH_SECRET"
    "NEXT_PUBLIC_APP_URL"
    "ODOO_BASE_URL"
)

echo -e "\n${YELLOW}Validating environment variables...${NC}"
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}ERROR: Required environment variable $var is not set${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} $var is set"
done

# Create required directories
echo -e "\n${YELLOW}Creating required directories...${NC}"
mkdir -p sessions
mkdir -p wa-media-cache
mkdir -p logs/webhook-dlq
mkdir -p backups
echo -e "${GREEN}✓${NC} Directories created"

# Pull latest changes (if using git deployment)
if [ -d ".git" ]; then
    echo -e "\n${YELLOW}Pulling latest changes from git...${NC}"
    git pull origin master
    echo -e "${GREEN}✓${NC} Code updated"
fi

# Build Docker images
echo -e "\n${YELLOW}Building Docker images...${NC}"
docker-compose -f docker-compose.production.yml build --no-cache
echo -e "${GREEN}✓${NC} Images built"

# Stop existing containers
echo -e "\n${YELLOW}Stopping existing containers...${NC}"
docker-compose -f docker-compose.production.yml down
echo -e "${GREEN}✓${NC} Containers stopped"

# Start database first
echo -e "\n${YELLOW}Starting database...${NC}"
docker-compose -f docker-compose.production.yml up -d db
echo -e "${GREEN}✓${NC} Database started"

# Wait for database to be ready
echo -e "\n${YELLOW}Waiting for database to be ready...${NC}"
sleep 10

# Run database migrations
echo -e "\n${YELLOW}Running database migrations...${NC}"
docker-compose -f docker-compose.production.yml run --rm web npx prisma migrate deploy
echo -e "${GREEN}✓${NC} Migrations completed"

# Start all services
echo -e "\n${YELLOW}Starting all services...${NC}"
docker-compose -f docker-compose.production.yml up -d
echo -e "${GREEN}✓${NC} Services started"

# Wait for health check
echo -e "\n${YELLOW}Waiting for application to be healthy...${NC}"
sleep 15

# Check health endpoint
HEALTH_URL="${NEXT_PUBLIC_APP_URL}/api/health"
if curl -f -s "$HEALTH_URL" > /dev/null; then
    echo -e "${GREEN}✓${NC} Application is healthy"
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "\nApplication URL: ${NEXT_PUBLIC_APP_URL}"
    echo -e "Health Check: ${HEALTH_URL}"
    echo -e "\nView logs: docker-compose -f docker-compose.production.yml logs -f"
else
    echo -e "${RED}WARNING: Health check failed${NC}"
    echo -e "${YELLOW}Check logs: docker-compose -f docker-compose.production.yml logs${NC}"
    exit 1
fi

# Show container status
echo -e "\n${YELLOW}Container Status:${NC}"
docker-compose -f docker-compose.production.yml ps

# Cleanup old images
echo -e "\n${YELLOW}Cleaning up old images...${NC}"
docker image prune -f
echo -e "${GREEN}✓${NC} Cleanup completed"

echo -e "\n${GREEN}Deployment complete!${NC}"
