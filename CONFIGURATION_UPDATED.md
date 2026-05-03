# ✅ Configuration Files Updated

## Files Updated

### 1. docker-compose.yml

**New features added:**

✅ **Container names** for easier management
- `baileys-whatsapp-db`
- `baileys-whatsapp-api`

✅ **Network isolation**
- Dedicated `baileys-network` bridge network
- Both services isolated from other containers

✅ **Enhanced environment variables**
- `WHATSAPP_MEDIA_ROOT` - Media cache storage
- `MEDIA_PUBLIC_BASE_URL` - Public URL for Odoo downloads
- `ODOO_BASE_URL` - Odoo instance URL
- `ODOO_WEBHOOK_PATH` - Webhook endpoint path
- `WEBHOOK_MAX_RETRIES` - Retry configuration
- `WEBHOOK_RETRY_DELAY_MS` - Retry delay
- `WEBHOOK_TIMEOUT_MS` - Request timeout
- `ENABLE_WEBHOOK_DLQ` - Dead letter queue
- `HEALTH_CHECK_TIMEOUT` - Health check settings
- `HEALTH_CHECK_DETAILED` - Detailed health responses
- `API_RATE_LIMIT` - Rate limiting
- `WEBHOOK_RATE_LIMIT` - Webhook rate limiting
- `ENABLE_WEBHOOK_DEBUG` - Debug logging
- `ENABLE_METRICS` - Prometheus metrics

✅ **New volumes**
- `media_cache` - For inbound media files
- `app_logs` - For application logs

✅ **Health checks**
- Database: `pg_isready` check every 5s
- Web: `/api/health` endpoint check every 30s

✅ **Log rotation**
- Max 10MB per file
- Keep 3 files max

✅ **Resource limits** (commented out, uncomment for production)
- CPU and memory limits
- Reservations for guaranteed resources

### 2. .env

**Better organization:**

✅ **Grouped by category** with clear sections:
- Database Configuration
- Authentication & Security
- WhatsApp Configuration
- Odoo Integration
- Payment Gateway
- Application Settings
- Health Check & Monitoring
- Rate Limiting
- Debug & Development
- Legacy CLI Bot Settings
- Production Settings

✅ **New variables added:**
- `POSTGRES_PORT` - Database port mapping
- `WHATSAPP_MEDIA_ROOT` - Media storage
- `MEDIA_PUBLIC_BASE_URL` - Public media URL
- `ODOO_BASE_URL` - Odoo instance URL
- `ODOO_WEBHOOK_PATH` - Webhook path
- `WEBHOOK_MAX_RETRIES` - Retry attempts
- `WEBHOOK_RETRY_DELAY_MS` - Retry delay
- `WEBHOOK_TIMEOUT_MS` - Timeout
- `ENABLE_WEBHOOK_DLQ` - DLQ toggle
- `WEB_PORT` - Web container port
- `HEALTH_CHECK_TIMEOUT` - Health timeout
- `HEALTH_CHECK_DETAILED` - Detailed mode
- `ENABLE_METRICS` - Metrics toggle
- `API_RATE_LIMIT` - API rate limit
- `WEBHOOK_RATE_LIMIT` - Webhook rate limit
- `ENABLE_WEBHOOK_DEBUG` - Debug logs
- `AUTO_RECONNECT` - Auto reconnect
- `SESSION_KEEPALIVE_INTERVAL` - Keepalive interval

✅ **Comprehensive documentation**
- Comments explaining each variable
- Examples for production setup
- ngrok setup instructions
- Links to documentation files

---

## New Features Enabled

### 1. Enhanced Webhook Debugging

**ENABLE_WEBHOOK_DEBUG=true** enables detailed console logs:

```
[WEBHOOK DEBUG] Processing inbound message for Odoo
[WEBHOOK DEBUG] Prepared Acrux row: { ... }
[WEBHOOK DEBUG] deliverToOdooWithDlq called
[WEBHOOK DEBUG] Attempting POST to: https://...
[WEBHOOK DEBUG] POST result: { ok: true, status: 200 }
```

### 2. Dead Letter Queue

**ENABLE_WEBHOOK_DLQ=true** saves failed webhooks to database for retry:

```bash
# View failed webhooks
docker-compose exec db psql -U app app -c "
SELECT * FROM \"OdooWebhookDeadLetter\" WHERE \"resolvedAt\" IS NULL;
"
```

### 3. Health Checks

**Both services now have health checks:**

```bash
# Check health status
docker-compose ps

# Should show "healthy" for both services
```

**API health endpoint:**
```bash
curl http://localhost:3000/api/health

# With details:
curl http://localhost:3000/api/health?detailed=true
```

### 4. Media Storage

**Dedicated volume for media files:**

```bash
# View media cache
docker-compose exec web ls -la /data/wa-media-cache

# Media is served at:
http://localhost:3000/api/public/wa-media/[artifact-id]
```

### 5. Log Management

**Automatic log rotation:**
- Max 10MB per log file
- Keeps last 3 files
- Logs in `/data/logs` volume

```bash
# View logs
docker-compose logs -f web

# Or from volume
docker-compose exec web ls -la /data/logs
```

### 6. Network Isolation

**Dedicated network for security:**
```bash
# Inspect network
docker network inspect baileys-whatsapp_baileys-network

# Both services are isolated
```

---

## Verification

### 1. Check Services Are Running

```bash
docker-compose ps
```

**Expected output:**
```
NAME                     STATUS          PORTS
baileys-whatsapp-api    Up (healthy)    0.0.0.0:3000->3000/tcp
baileys-whatsapp-db     Up (healthy)    0.0.0.0:5432->5432/tcp
```

### 2. Check Volumes

```bash
docker volume ls | grep baileys
```

**Should show:**
- `baileys-whatsapp_pgdata`
- `baileys-whatsapp_whatsapp_sessions`
- `baileys-whatsapp_media_cache`
- `baileys-whatsapp_app_logs`

### 3. Check Webhook URL Still Set

```bash
docker-compose exec db psql -U app app -c "
SELECT \"odooWebhookUrl\" FROM \"OdooGatewayCredential\";
"
```

**Should show:**
```
https://b12c-103-146-92-249.ngrok-free.app/acrux_webhook/whatsapp_connector/13d5d026...
```

### 4. Test Application

```bash
# Health check
curl http://localhost:3000/api/health

# Should return:
# {"ok":true,"timestamp":"...","services":{"database":"up","whatsapp":"up"}}
```

---

## Environment Variable Reference

### Quick Settings

**For development (current):**
```env
NODE_ENV=development
LOG_LEVEL=info
ENABLE_WEBHOOK_DEBUG=true
HEALTH_CHECK_DETAILED=false
```

**For production:**
```env
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_WEBHOOK_DEBUG=false
HEALTH_CHECK_DETAILED=false
ENABLE_METRICS=true
```

**For debugging webhooks:**
```env
LOG_LEVEL=debug
ENABLE_WEBHOOK_DEBUG=true
HEALTH_CHECK_DETAILED=true
```

### Webhook Configuration

**Default (recommended):**
```env
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY_MS=1000
WEBHOOK_TIMEOUT_MS=20000
ENABLE_WEBHOOK_DLQ=true
```

**For slow networks:**
```env
WEBHOOK_MAX_RETRIES=5
WEBHOOK_RETRY_DELAY_MS=2000
WEBHOOK_TIMEOUT_MS=30000
```

**For fast/reliable networks:**
```env
WEBHOOK_MAX_RETRIES=2
WEBHOOK_RETRY_DELAY_MS=500
WEBHOOK_TIMEOUT_MS=10000
```

---

## Next Steps

### 1. Test Webhook with Current ngrok URL

```bash
# Watch logs
docker-compose logs -f web | grep "WEBHOOK DEBUG"

# Send WhatsApp message
# Should see successful POST
```

### 2. When ngrok Restarts

```bash
# Get new URL from http://127.0.0.1:4040
NGROK_URL="https://NEW_URL.ngrok-free.app"

# Update database
UUID=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"connectorUuid\" FROM \"OdooGatewayCredential\";" | tr -d ' \n')

docker-compose exec -T db psql -U app app -c "
UPDATE \"OdooGatewayCredential\"
SET \"odooWebhookUrl\" = '${NGROK_URL}/acrux_webhook/whatsapp_connector/${UUID}';
"
```

### 3. Enable Detailed Health Checks

```bash
# Edit .env
HEALTH_CHECK_DETAILED=true

# Restart
docker-compose restart web

# Test
curl http://localhost:3000/api/health?detailed=true
```

### 4. Monitor Resources

```bash
# Watch resource usage
docker stats baileys-whatsapp-api baileys-whatsapp-db

# If needed, uncomment resource limits in docker-compose.yml
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs db
docker-compose logs web

# Rebuild
docker-compose build web
docker-compose up -d
```

### Webhook URL Lost

```bash
# Re-apply ngrok URL
NGROK_URL="https://b12c-103-146-92-249.ngrok-free.app"
UUID="13d5d026-0fb8-46c7-bf71-6589ba1a1d38"

docker-compose exec -T db psql -U app app -c "
UPDATE \"OdooGatewayCredential\"
SET \"odooWebhookUrl\" = '${NGROK_URL}/acrux_webhook/whatsapp_connector/${UUID}';
"
```

### No Debug Logs

```bash
# Check if debug is enabled
docker-compose exec web printenv ENABLE_WEBHOOK_DEBUG

# Should return: true

# If not, add to .env:
ENABLE_WEBHOOK_DEBUG=true

# Restart:
docker-compose restart web
```

---

## Summary

✅ **docker-compose.yml** - Updated with:
- Container names
- Network isolation
- Enhanced environment variables
- Health checks
- Log rotation
- New volumes (media_cache, app_logs)

✅ **.env** - Updated with:
- Better organization
- New Odoo/webhook variables
- Comprehensive documentation
- Production settings examples

✅ **Services restarted** with new configuration

✅ **Webhook URL preserved** (ngrok URL still set)

✅ **Ready to test** webhooks with enhanced debugging

---

**Status:** ✅ All configuration files updated and services running!

**Test:** Send a WhatsApp message and watch the logs!
