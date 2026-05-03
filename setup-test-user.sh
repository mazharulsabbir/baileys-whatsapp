#!/bin/bash

#
# Quick Setup Script for Test User
# Creates a user with active subscription for testing WhatsApp connection
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Test User for WhatsApp Testing${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if docker-compose is running
if ! docker-compose ps | grep -q "Up"; then
    echo -e "${RED}ERROR: Docker Compose services are not running${NC}"
    echo -e "${YELLOW}Start services with: docker-compose up -d${NC}"
    exit 1
fi

# Get email and password
read -p "Enter test email (default: test@example.com): " EMAIL
EMAIL=${EMAIL:-test@example.com}

read -s -p "Enter password (default: testpass123): " PASSWORD
echo
PASSWORD=${PASSWORD:-testpass123}

echo -e "\n${YELLOW}Creating test user and entitlement...${NC}"

# Create user and entitlement via database
docker-compose exec -T db psql -U app app << EOF
-- Create or update user
INSERT INTO "User" (id, email, password, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '${EMAIL}',
  '\$2b\$10\$rKJ8K9Z9Z9Z9Z9Z9Z9Z9ZeYj7R7R7R7R7R7R7R7R7R7R7R', -- hashed password placeholder
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING
RETURNING id;

-- Get user ID
\set user_id (SELECT id FROM "User" WHERE email = '${EMAIL}')

-- Create active entitlement
INSERT INTO "Entitlement" ("userId", "planSlug", status, "validUntil", "createdAt", "updatedAt")
VALUES (
  :'user_id',
  'premium',
  'active',
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
)
ON CONFLICT ("userId") DO UPDATE SET
  status = 'active',
  "validUntil" = NOW() + INTERVAL '30 days',
  "updatedAt" = NOW();

-- Show result
SELECT
  u.id,
  u.email,
  e."planSlug",
  e.status,
  e."validUntil"
FROM "User" u
LEFT JOIN "Entitlement" e ON e."userId" = u.id
WHERE u.email = '${EMAIL}';
EOF

echo -e "${GREEN}✓${NC} User and entitlement created"

# Register user via API (to get proper password hash)
echo -e "\n${YELLOW}Registering user via API...${NC}"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" || echo '{}')

if echo "$RESPONSE" | grep -q "error"; then
  ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
  if echo "$ERROR" | grep -q -i "already"; then
    echo -e "${YELLOW}⚠${NC} User already exists (expected if running multiple times)"
  else
    echo -e "${RED}⚠${NC} API registration returned: $ERROR"
  fi
else
  echo -e "${GREEN}✓${NC} User registered successfully"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Test Credentials:${NC}"
echo -e "Email: ${EMAIL}"
echo -e "Password: ${PASSWORD}"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "1. Open http://localhost:3000/dashboard"
echo -e "2. Login with the credentials above"
echo -e "3. Click 'Connect / refresh QR'"
echo -e "4. Scan the QR code with WhatsApp"

echo -e "\n${YELLOW}Debug Endpoint:${NC}"
echo -e "http://localhost:3000/api/debug/whatsapp-status"
echo -e "(Visit while logged in to see detailed connection status)"

echo -e "\n${YELLOW}Health Check:${NC}"
echo -e "curl http://localhost:3000/api/health?detailed=true"

echo -e "\n${GREEN}Done!${NC}"
