# Production Deployment Guide
## Baileys WhatsApp API with Odoo ChatRoom Integration

This guide covers deploying the Baileys WhatsApp API to production with full Odoo ChatRoom integration.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Deployment](#deployment)
6. [Odoo Configuration](#odoo-configuration)
7. [Health Checks & Monitoring](#health-checks--monitoring)
8. [Backup & Recovery](#backup--recovery)
9. [Troubleshooting](#troubleshooting)
10. [Security Considerations](#security-considerations)

---

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended)
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 20GB minimum (SSD recommended)
- **Network**: Public IP address or domain name
- **SSL**: Valid SSL certificate (Let's Encrypt recommended)

### External Services

- **Odoo Instance**: v17.0 with ChatRoom (Acrux) module installed
- **Domain Name**: For public access and webhooks
- **SSL Certificate**: For HTTPS communication
- **Payment Gateway** (Optional): SSLCommerz account for billing

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/baileys-whatsapp.git
cd baileys-whatsapp
```

### 2. Create Environment File

```bash
cp .env.production.example .env.production
```

### 3. Make Scripts Executable

```bash
chmod +x deploy.sh backup.sh docker-entrypoint.sh
```

---

## Environment Configuration

Edit `.env.production` with your production values:

### Critical Settings

```bash
# Database (use strong password)
DATABASE_URL=postgresql://app:SECURE_PASSWORD@db:5432/app
POSTGRES_PASSWORD=SECURE_PASSWORD

# Authentication (generate: openssl rand -base64 32)
AUTH_SECRET=your-random-secret-here

# Public URLs (MUST be accessible from internet)
AUTH_URL=https://whatsapp-api.your-domain.com
NEXT_PUBLIC_APP_URL=https://whatsapp-api.your-domain.com
MEDIA_PUBLIC_BASE_URL=https://whatsapp-api.your-domain.com/api/media

# Odoo Integration
ODOO_BASE_URL=https://your-odoo.com
ODOO_API_TOKEN=your-api-token
ODOO_CONNECTOR_UUID=your-connector-uuid
```

### Generate Strong Secrets

```bash
# AUTH_SECRET
openssl rand -base64 32

# POSTGRES_PASSWORD
openssl rand -base64 24
```

---

## Database Setup

The database is automatically initialized during deployment, but you can verify:

```bash
# Start database only
docker-compose -f docker-compose.production.yml up -d db

# Wait for it to be ready
docker-compose -f docker-compose.production.yml exec db pg_isready -U app

# Run migrations manually (if needed)
docker-compose -f docker-compose.production.yml run --rm web npx prisma migrate deploy
```

---

## Deployment

### Automated Deployment

Use the deployment script for zero-downtime deployment:

```bash
./deploy.sh
```

The script will:
1. ✅ Validate environment variables
2. ✅ Create required directories
3. ✅ Build Docker images
4. ✅ Run database migrations
5. ✅ Start all services
6. ✅ Verify health checks
7. ✅ Clean up old images

### Manual Deployment

If you prefer manual control:

```bash
# Build images
docker-compose -f docker-compose.production.yml build

# Start services
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

### Verify Deployment

```bash
# Check health endpoint
curl https://whatsapp-api.your-domain.com/api/health

# Expected response:
# {
#   "ok": true,
#   "timestamp": "2024-01-15T10:30:00.000Z",
#   "services": {
#     "database": "up",
#     "whatsapp": "up"
#   }
# }

# Detailed health check
curl https://whatsapp-api.your-domain.com/api/health?detailed=true
```

---

## Odoo Configuration

### 1. Install ChatRoom Module

In Odoo:
1. Navigate to **Apps**
2. Search for "WhatsApp ChatRoom" or "Acrux"
3. Click **Install**

### 2. Create API Connector

1. Go to **ChatRoom → Configuration → Connectors**
2. Click **Create**
3. Configure:

```
Name: Baileys WhatsApp API
Connector Type: apichat.io
API Endpoint: https://whatsapp-api.your-domain.com/api/odoo/gateway
Token: <generate-from-dashboard>
Account ID (UUID): <your-connector-uuid>
Odoo URL (Webhook): https://your-odoo.com
```

### 3. Generate Credentials

In the Baileys WhatsApp API:
1. Log in to dashboard
2. Navigate to **Odoo / API Integration**
3. Click **Generate API Key**
4. Copy the generated token and UUID
5. Paste into Odoo connector configuration

### 4. Test Connection

In Odoo connector form:
1. Click **Test Connection** button
2. Verify status shows "Connected"
3. Check **Status** tab for connection details

### 5. Configure Webhook

Odoo will automatically configure webhook callbacks to:
```
https://your-odoo.com/acrux_webhook/whatsapp_connector/<uuid>
```

Verify webhook delivery in application logs:
```bash
docker-compose -f docker-compose.production.yml logs -f web | grep webhook
```

---

## Health Checks & Monitoring

### Health Endpoint

**Basic Check:**
```bash
GET /api/health
```

Response:
```json
{
  "ok": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": "up",
    "whatsapp": "up"
  }
}
```

**Detailed Check:**
```bash
GET /api/health?detailed=true
```

Response:
```json
{
  "ok": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
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

### Service Status Indicators

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `up` | Service operational | None |
| `degraded` | Partial functionality | Investigate logs |
| `down` | Service unavailable | Immediate action |

### Docker Health Checks

```bash
# View container health
docker-compose -f docker-compose.production.yml ps

# Check specific service
docker inspect --format='{{json .State.Health}}' baileys-whatsapp-api

# Restart unhealthy container
docker-compose -f docker-compose.production.yml restart web
```

### Log Monitoring

```bash
# Follow all logs
docker-compose -f docker-compose.production.yml logs -f

# Web application logs only
docker-compose -f docker-compose.production.yml logs -f web

# Database logs
docker-compose -f docker-compose.production.yml logs -f db

# Filter for errors
docker-compose -f docker-compose.production.yml logs -f | grep ERROR

# Webhook delivery logs
docker-compose -f docker-compose.production.yml logs -f | grep "Odoo webhook"
```

### Metrics Endpoint (Optional)

If `ENABLE_METRICS=true`:

```bash
GET /api/metrics
```

Returns Prometheus-compatible metrics for monitoring tools.

---

## Backup & Recovery

### Automated Backups

Run the backup script:

```bash
./backup.sh
```

This backs up:
- ✅ PostgreSQL database
- ✅ WhatsApp session files
- ✅ Media cache
- ✅ Webhook DLQ logs

Backups are stored in `./backups/<timestamp>/`

### Schedule Automated Backups

Add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/baileys-whatsapp && ./backup.sh >> /var/log/baileys-backup.log 2>&1
```

### Manual Backup

**Database Only:**
```bash
docker-compose -f docker-compose.production.yml exec -T db pg_dump -U app app | gzip > backup_$(date +%Y%m%d).sql.gz
```

**Sessions Only:**
```bash
tar -czf sessions_backup_$(date +%Y%m%d).tar.gz sessions/
```

### Restore from Backup

**1. Restore Database:**
```bash
# Stop web service
docker-compose -f docker-compose.production.yml stop web

# Restore database
gunzip -c backups/20240115_020000/database.sql.gz | docker-compose -f docker-compose.production.yml exec -T db psql -U app app

# Restart services
docker-compose -f docker-compose.production.yml up -d
```

**2. Restore Sessions:**
```bash
# Stop web service
docker-compose -f docker-compose.production.yml stop web

# Restore sessions
tar -xzf backups/20240115_020000/sessions.tar.gz

# Restart
docker-compose -f docker-compose.production.yml up -d
```

**3. Restore Media:**
```bash
tar -xzf backups/20240115_020000/media.tar.gz
```

### Backup Retention

Default retention: **30 days** (configured via `BACKUP_RETENTION_DAYS`)

Old backups are automatically cleaned up by `backup.sh`.

---

## Troubleshooting

### Common Issues

#### 1. WhatsApp Not Connecting

**Symptoms:**
- Health check shows `whatsapp: "down"` or `"degraded"`
- QR code not generating

**Solutions:**
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs -f web | grep WhatsApp

# Restart service
docker-compose -f docker-compose.production.yml restart web

# Clear session and reconnect
docker-compose -f docker-compose.production.yml exec web rm -rf /app/sessions/*
docker-compose -f docker-compose.production.yml restart web
```

#### 2. Webhook Delivery Failures

**Symptoms:**
- Messages not appearing in Odoo
- DLQ logs growing

**Solutions:**
```bash
# Check webhook DLQ
cat logs/webhook-dlq/*.json

# Verify Odoo URL is reachable
docker-compose -f docker-compose.production.yml exec web curl -I https://your-odoo.com

# Check Odoo webhook endpoint
curl -X POST https://your-odoo.com/acrux_webhook/whatsapp_connector/<uuid> \
  -H "Content-Type: application/json" \
  -d '{"messages":[],"events":[],"updates":[]}'

# Increase retry attempts
# Edit .env.production:
WEBHOOK_MAX_RETRIES=5
WEBHOOK_TIMEOUT_MS=15000
```

#### 3. Database Connection Issues

**Symptoms:**
- Health check shows `database: "down"`
- Application crashes on startup

**Solutions:**
```bash
# Check database status
docker-compose -f docker-compose.production.yml exec db pg_isready -U app

# Check connection from web container
docker-compose -f docker-compose.production.yml exec web psql postgresql://app:app@db:5432/app -c "SELECT 1"

# Restart database
docker-compose -f docker-compose.production.yml restart db
```

#### 4. High Memory Usage

**Symptoms:**
- Container OOM kills
- Slow performance

**Solutions:**
```bash
# Check memory usage
docker stats

# Adjust resource limits in docker-compose.production.yml:
deploy:
  resources:
    limits:
      memory: 8G  # Increase if needed
    reservations:
      memory: 4G

# Clear media cache
docker-compose -f docker-compose.production.yml exec web rm -rf /app/wa-media-cache/*
```

#### 5. SSL/HTTPS Issues

**Symptoms:**
- Media URLs not loading in Odoo
- Webhook callbacks failing

**Solutions:**
1. Verify SSL certificate is valid
2. Ensure `NEXT_PUBLIC_APP_URL` uses HTTPS
3. Configure reverse proxy (nginx/Caddy) properly
4. Check firewall allows inbound 443

---

## Security Considerations

### 1. Environment Variables

**Never commit `.env.production` to version control!**

```bash
# Add to .gitignore
echo ".env.production" >> .gitignore
```

### 2. Database Security

- Use strong passwords (24+ characters)
- Restrict database port exposure
- Enable SSL for database connections (production)
- Regular security updates: `docker-compose pull`

### 3. API Security

- Use HTTPS only (no HTTP)
- Rotate API tokens regularly
- Implement rate limiting (configured via env vars)
- Monitor for suspicious activity

### 4. Network Security

```yaml
# docker-compose.production.yml - restrict database access
db:
  ports:
    # REMOVE this line in production (internal only):
    # - "5432:5432"
```

### 5. File Permissions

```bash
# Secure environment file
chmod 600 .env.production

# Secure backup directory
chmod 700 backups/
```

### 6. Regular Updates

```bash
# Update base images
docker-compose -f docker-compose.production.yml pull

# Rebuild with security patches
./deploy.sh
```

### 7. Webhook Security

- Validate webhook payloads
- Use HTTPS for all webhook URLs
- Monitor DLQ for suspicious patterns

---

## Performance Tuning

### 1. Database Optimization

```sql
-- Connect to database
docker-compose -f docker-compose.production.yml exec db psql -U app app

-- Analyze tables
ANALYZE;

-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 2. Application Tuning

Edit `.env.production`:

```bash
# Increase for high-traffic scenarios
API_RATE_LIMIT=120
WEBHOOK_RATE_LIMIT=200

# Adjust session keepalive
SESSION_KEEPALIVE_INTERVAL=60000  # 60 seconds
```

### 3. Resource Allocation

Edit `docker-compose.production.yml`:

```yaml
web:
  deploy:
    resources:
      limits:
        cpus: '8'      # Increase for more tenants
        memory: 8G
```

### 4. Media Cache Management

```bash
# Clean old media (run weekly)
find ./wa-media-cache -type f -mtime +7 -delete
```

---

## Production Checklist

Before going live:

- [ ] SSL certificate installed and valid
- [ ] `.env.production` configured with production values
- [ ] Strong passwords for database and auth secrets
- [ ] Odoo connector configured and tested
- [ ] Health checks passing
- [ ] Automated backups scheduled
- [ ] Monitoring/alerting configured
- [ ] Firewall rules configured
- [ ] Domain DNS configured correctly
- [ ] Rate limiting configured
- [ ] Log rotation configured
- [ ] Disaster recovery plan documented
- [ ] Team trained on troubleshooting procedures

---

## Maintenance Windows

### Rolling Updates (Zero Downtime)

```bash
# Build new image
docker-compose -f docker-compose.production.yml build web

# Scale up with new version
docker-compose -f docker-compose.production.yml up -d --scale web=2 --no-recreate

# Wait for new container to be healthy
sleep 30

# Remove old container
docker-compose -f docker-compose.production.yml up -d --scale web=1
```

### Scheduled Maintenance

```bash
# 1. Notify users
# 2. Stop accepting new connections
# 3. Wait for active sessions to complete
docker-compose -f docker-compose.production.yml stop web

# 4. Perform maintenance (backups, migrations, etc.)
./backup.sh

# 5. Restart services
docker-compose -f docker-compose.production.yml up -d

# 6. Verify health
curl https://whatsapp-api.your-domain.com/api/health
```

---

## Support & Resources

### Documentation
- [Odoo Connector Integration](./ODOO_CONNECTOR_INTEGRATION.md)
- [Implementation Complete](./IMPLEMENTATION_COMPLETE.md)
- [Task Plan](./TASK_PLAN.md)

### Logs Location
- **Application**: `docker-compose logs -f web`
- **Database**: `docker-compose logs -f db`
- **Webhook DLQ**: `./logs/webhook-dlq/`

### Emergency Contacts
- System Administrator: [contact info]
- Database Administrator: [contact info]
- Odoo Administrator: [contact info]

---

## License

[Your License Here]

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0
