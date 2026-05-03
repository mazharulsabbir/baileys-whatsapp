# Baileys WhatsApp API - Deployment & Testing Guide

## Quick Links

- **[Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)** - Complete production setup
- **[QR Code Troubleshooting](./TROUBLESHOOTING_QR_STATUS.md)** - Fix QR/status issues
- **[Quick Start Testing](./QUICKSTART_WHATSAPP_TESTING.md)** - Fast setup for testing
- **[Odoo Integration](./ODOO_CONNECTOR_INTEGRATION.md)** - Odoo connector setup
- **[Implementation Complete](./IMPLEMENTATION_COMPLETE.md)** - Full feature documentation

---

## 🚀 Quick Start (Docker Compose)

```bash
# 1. Start services
docker-compose up -d

# 2. Wait for database
sleep 30

# 3. Create test user with subscription
docker-compose exec -T db psql -U app app << 'EOF'
DO $$
DECLARE v_user_id UUID;
BEGIN
  INSERT INTO "User" (id, email, password, "createdAt", "updatedAt")
  VALUES (gen_random_uuid(), 'test@example.com', '', NOW(), NOW())
  ON CONFLICT (email) DO NOTHING RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM "User" WHERE email = 'test@example.com';
  END IF;

  INSERT INTO "Entitlement" ("userId", "planSlug", status, "validUntil", "createdAt", "updatedAt")
  VALUES (v_user_id, 'premium', 'active', NOW() + INTERVAL '30 days', NOW(), NOW())
  ON CONFLICT ("userId") DO UPDATE SET status = 'active', "validUntil" = NOW() + INTERVAL '30 days';
END $$;
EOF

# 4. Register user (sets password)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# 5. Open dashboard
echo "✅ Open http://localhost:3000/dashboard"
echo "   Login: test@example.com / testpass123"
echo "   Click: Connect / refresh QR"
```

---

## 📋 System Overview

### Architecture

```
┌─────────────────────────────────────┐
│       Reverse Proxy (nginx)         │
│         HTTPS/SSL Termination       │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│     Docker Compose Network               │
│                                          │
│  ┌──────────────────┐  ┌──────────────┐ │
│  │  Web Container   │  │  PostgreSQL  │ │
│  │  (Next.js)       │──│  Database    │ │
│  │                  │  │              │ │
│  │ - WhatsApp API   │  └──────────────┘ │
│  │ - Webhook System │                   │
│  │ - Health Checks  │                   │
│  └────────┬─────────┘                   │
│           │                             │
│  Persistent Volumes:                    │
│  - sessions/ (WhatsApp auth)            │
│  - wa-media-cache/ (Media files)        │
│  - logs/webhook-dlq/ (Failed webhooks)  │
│  - backups/ (Automated backups)         │
└──────────────────────────────────────────┘
               │
               ▼
      ┌────────────────┐
      │ Odoo Instance  │
      │  ChatRoom/Acrux │
      └────────────────┘
```

### Key Features

✅ **Multi-tenant WhatsApp connections** via Baileys library
✅ **Odoo ChatRoom integration** with 100% API compatibility
✅ **Production-ready Docker setup** with health checks
✅ **Automated backups** with 30-day retention
✅ **Webhook delivery** with retry logic and DLQ
✅ **Enhanced monitoring** via health and debug endpoints
✅ **Media handling** with public URL generation
✅ **Payment integration** via SSLCommerz

---

## 🛠️ Development Setup

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+ (for local development)
- PostgreSQL 16 (via Docker)

### Local Development

```bash
# Clone repository
git clone https://github.com/your-org/baileys-whatsapp.git
cd baileys-whatsapp

# Install dependencies
npm install

# Setup database
docker-compose up -d db
cp .env.example .env
npx prisma migrate deploy

# Run development server
npm run dev

# Open http://localhost:3000
```

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose build web
docker-compose up -d
```

---

## 🔍 Troubleshooting

### Issue: QR Code Not Appearing

**Quick Fix:**
```bash
# Check debug endpoint (while logged in)
http://localhost:3000/api/debug/whatsapp-status

# Common cause: No active subscription
# Solution: Add entitlement (see Quick Start above)
```

**Full Guide:** [TROUBLESHOOTING_QR_STATUS.md](./TROUBLESHOOTING_QR_STATUS.md)

### Issue: Database Connection Fails

```bash
# Check database status
docker-compose exec db pg_isready -U app

# Restart database
docker-compose restart db

# Check logs
docker-compose logs db
```

### Issue: WhatsApp Won't Connect

```bash
# Check logs
docker-compose logs -f web | grep -i whatsapp

# Clear session and retry
rm -rf sessions/*
docker-compose restart web

# Check internet connectivity
docker-compose exec web curl -I https://web.whatsapp.com
```

### Issue: Webhook Delivery Fails

```bash
# Check DLQ logs
cat logs/webhook-dlq/*.json

# Verify Odoo is reachable
docker-compose exec web curl -I https://your-odoo.com

# Check environment variables
docker-compose exec web env | grep ODOO
```

---

## 📊 Monitoring & Health Checks

### Health Endpoints

**Basic Health Check:**
```bash
GET /api/health
```

Response:
```json
{
  "ok": true,
  "timestamp": "2024-01-15T10:00:00.000Z",
  "services": {
    "database": "up",
    "whatsapp": "up"
  }
}
```

**Detailed Health Check:**
```bash
GET /api/health?detailed=true
```

Response:
```json
{
  "ok": true,
  "timestamp": "2024-01-15T10:00:00.000Z",
  "services": {
    "database": "up",
    "whatsapp": "up"
  },
  "details": {
    "activeConnections": 5,
    "totalTenants": 5,
    "uptime": 86400,
    "version": "1.0.0"
  }
}
```

**Debug Status (Auth Required):**
```bash
GET /api/debug/whatsapp-status
```

### Monitoring Commands

```bash
# Container status
docker-compose ps

# Resource usage
docker stats

# Application logs
docker-compose logs -f web

# Database logs
docker-compose logs -f db

# Filter for errors
docker-compose logs -f | grep -i error

# Filter for WhatsApp events
docker-compose logs -f web | grep -i whatsapp

# Webhook deliveries
docker-compose logs -f web | grep -i webhook
```

---

## 🔐 Security Checklist

### Development

- [x] `.env` in `.gitignore`
- [x] Database password secured
- [x] Session data isolated per tenant
- [x] Rate limiting on authentication endpoints

### Production

- [ ] Strong `AUTH_SECRET` (32+ characters)
- [ ] Strong database password
- [ ] HTTPS enabled via reverse proxy
- [ ] SSL certificate installed and valid
- [ ] Firewall configured (allow HTTPS, block direct DB access)
- [ ] Environment variables secured
- [ ] Regular backups scheduled
- [ ] Webhook endpoints use authentication
- [ ] CORS properly configured
- [ ] Rate limiting enabled

---

## 🚢 Production Deployment

### Option 1: Automated Deployment

```bash
# Configure environment
cp .env.production.example .env.production
nano .env.production  # Edit configuration

# Deploy
chmod +x deploy.sh
./deploy.sh
```

### Option 2: Manual Deployment

```bash
# Build images
docker-compose -f docker-compose.production.yml build

# Start database
docker-compose -f docker-compose.production.yml up -d db

# Run migrations
docker-compose -f docker-compose.production.yml run --rm web npx prisma migrate deploy

# Start all services
docker-compose -f docker-compose.production.yml up -d

# Verify
curl https://your-domain.com/api/health
```

**Full Guide:** [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md)

---

## 🔄 Backup & Recovery

### Automated Backups

```bash
# Run backup
./backup.sh

# Schedule daily backups (cron)
0 2 * * * cd /path/to/baileys-whatsapp && ./backup.sh
```

### Manual Backup

```bash
# Database only
docker-compose exec -T db pg_dump -U app app | gzip > backup.sql.gz

# Sessions
tar -czf sessions_backup.tar.gz sessions/

# Media
tar -czf media_backup.tar.gz wa-media-cache/
```

### Restore from Backup

```bash
# Restore database
gunzip -c backup.sql.gz | docker-compose exec -T db psql -U app app

# Restore sessions
tar -xzf sessions_backup.tar.gz

# Restart services
docker-compose restart web
```

---

## 🔌 Odoo Integration

### Setup Connector in Odoo

1. **Install ChatRoom Module**
   - Apps → Search "WhatsApp ChatRoom" → Install

2. **Create Connector**
   - ChatRoom → Configuration → Connectors → Create
   - **Connector Type:** apichat.io
   - **API Endpoint:** `https://your-domain.com/api/odoo/gateway`
   - **Token:** (generated from dashboard)
   - **Account ID (UUID):** (generated from dashboard)
   - **Odoo URL:** `https://your-odoo.com`

3. **Test Connection**
   - Click "Test Connection" button
   - Verify status shows "Connected"

4. **Webhook Configuration**
   - Automatically configured: `https://your-odoo.com/acrux_webhook/whatsapp_connector/<uuid>`

**Full Guide:** [ODOO_CONNECTOR_INTEGRATION.md](./ODOO_CONNECTOR_INTEGRATION.md)

---

## 📚 API Documentation

### Gateway API Endpoints

Base URL: `/api/odoo/gateway`
Authentication: `Authorization: Bearer TOKEN` + `X-Client-Id: UUID`

**Supported Actions:**
- `send` - Send message
- `status_get` - Get connection status
- `contact_get` - Get contact info
- `contact_get_all` - List all contacts
- `whatsapp_number_get` - Validate phone numbers
- `template_get` - Get message templates
- `delete_message` - Delete message
- `msg_set_read` - Mark message as read
- `config_get` - Get configuration
- `config_set` - Update configuration
- `status_logout` - Logout/disconnect

### WhatsApp API Endpoints

**Connect:**
```bash
POST /api/whatsapp/connect
Authorization: Session cookie
```

**Get QR Code:**
```bash
GET /api/whatsapp/qr
Authorization: Session cookie

Response:
{
  "connected": false,
  "qrDataUrl": "data:image/png;base64,..."
}
```

**Disconnect:**
```bash
POST /api/whatsapp/disconnect
Authorization: Session cookie
```

---

## 📈 Performance Tuning

### Resource Allocation

Edit `docker-compose.production.yml`:

```yaml
web:
  deploy:
    resources:
      limits:
        cpus: '8'      # Increase for more tenants
        memory: 8G
      reservations:
        cpus: '4'
        memory: 4G
```

### Database Optimization

```sql
-- Connect to database
docker-compose exec db psql -U app app

-- Analyze tables
ANALYZE;

-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Media Cache Management

```bash
# Clean old media (run weekly)
find ./wa-media-cache -type f -mtime +7 -delete

# Or configure retention in .env
MEDIA_CACHE_RETENTION_DAYS=7
```

---

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
# Start services
docker-compose up -d

# Run integration tests
npm run test:integration
```

### Manual API Testing

```bash
# Health check
curl http://localhost:3000/api/health

# Connect WhatsApp
curl -X POST http://localhost:3000/api/whatsapp/connect \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"

# Get QR
curl http://localhost:3000/api/whatsapp/qr \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"

# Send message via Odoo gateway
curl -X POST http://localhost:3000/api/odoo/gateway \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Client-Id: YOUR_UUID" \
  -d 'action=send&to=1234567890&text=Hello'
```

---

## 📝 Environment Variables Reference

### Critical Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://app:pass@db:5432/app` |
| `AUTH_SECRET` | NextAuth encryption key | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `https://api.example.com` |
| `ODOO_BASE_URL` | Odoo instance URL | `https://odoo.example.com` |
| `ODOO_API_TOKEN` | API authentication | Generated from dashboard |
| `ODOO_CONNECTOR_UUID` | Connector ID | Generated from dashboard |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBHOOK_MAX_RETRIES` | 3 | Max retry attempts |
| `WEBHOOK_TIMEOUT_MS` | 10000 | Request timeout |
| `API_RATE_LIMIT` | 60 | Requests per minute |
| `LOG_LEVEL` | info | Log level (debug/info/warn/error) |
| `BACKUP_RETENTION_DAYS` | 30 | Backup retention |

**Full Reference:** [.env.production.example](./.env.production.example)

---

## 🆘 Getting Help

### Documentation

- [Production Deployment](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [QR Troubleshooting](./TROUBLESHOOTING_QR_STATUS.md)
- [Quick Start](./QUICKSTART_WHATSAPP_TESTING.md)
- [Odoo Integration](./ODOO_CONNECTOR_INTEGRATION.md)

### Diagnostic Commands

```bash
# Health check
curl http://localhost:3000/api/health?detailed=true

# Debug status (while logged in)
http://localhost:3000/api/debug/whatsapp-status

# Check logs
docker-compose logs --tail=100 web

# Container status
docker-compose ps
```

### Support Checklist

When reporting issues, provide:

- [ ] Health check output
- [ ] Debug endpoint output
- [ ] Recent logs (100 lines)
- [ ] Container status
- [ ] Environment info (OS, Docker version)
- [ ] Exact error messages
- [ ] Screenshots (if UI issue)

---

## 📄 License

[Your License Here]

---

## 🎯 Next Steps

1. **For Development:**
   - Follow [Quick Start](#-quick-start-docker-compose) above
   - Use [QUICKSTART_WHATSAPP_TESTING.md](./QUICKSTART_WHATSAPP_TESTING.md)

2. **For Production:**
   - Read [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md)
   - Configure `.env.production`
   - Run `./deploy.sh`

3. **For Odoo Integration:**
   - Follow [ODOO_CONNECTOR_INTEGRATION.md](./ODOO_CONNECTOR_INTEGRATION.md)
   - Set up connector in Odoo
   - Test end-to-end message flow

---

**Last Updated:** 2024-01-15
**Version:** 1.0.0
**Status:** ✅ Production Ready
