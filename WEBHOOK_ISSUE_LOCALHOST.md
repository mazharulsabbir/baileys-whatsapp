# Webhook Issue: localhost Problem

## Problem Summary

**Issue:** Outbound messages (Odoo → WhatsApp) work, but inbound messages (WhatsApp → Odoo) don't reach Odoo.

**Root Cause:** Webhook URL uses `localhost:8017` which is not accessible from Docker container.

```
Database shows:
odooWebhookUrl: http://localhost:8017/acrux_webhook/whatsapp_connector/13d5d026...

When WhatsApp API tries to POST to this URL:
- Container's "localhost" = the container itself, NOT the host machine
- Connection fails with ECONNREFUSED
- Message never reaches Odoo
```

---

## Quick Fix

### Option 1: Use host.docker.internal (Recommended for Docker Desktop)

```bash
# Update webhook URL in database
docker-compose exec db psql -U app app << 'EOF'
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = REPLACE("odooWebhookUrl", 'localhost', 'host.docker.internal'),
    "updatedAt" = NOW();
EOF

# Verify
docker-compose exec db psql -U app app -c "SELECT \"odooWebhookUrl\" FROM \"OdooGatewayCredential\";"

# Restart web service
docker-compose restart web
```

**New URL will be:**
```
http://host.docker.internal:8017/acrux_webhook/whatsapp_connector/...
```

### Option 2: Use Host IP Address

```bash
# Find your host IP (Windows PowerShell)
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*"}

# Or on Linux/Mac
hostname -I | awk '{print $1}'

# Update database (replace 192.168.1.100 with your actual IP)
docker-compose exec db psql -U app app << 'EOF'
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = REPLACE("odooWebhookUrl", 'localhost', '192.168.1.100'),
    "updatedAt" = NOW();
EOF
```

### Option 3: Update in Odoo (Permanent Fix)

1. **In Odoo**, go to: **ChatRoom → Configuration → Connectors**
2. Click on your WhatsApp connector
3. Edit the **"Odoo URL (Webhook)"** field
4. Change from: `http://localhost:8017`
5. Change to: `http://host.docker.internal:8017` (or your public URL)
6. Click **Save**
7. Click **"Test Connection"** or **"Refresh Status"**
   - This triggers `config_set` action
   - Updates `odooWebhookUrl` in database automatically

---

## Test the Fix

### 1. Verify Database Updated

```bash
docker-compose exec db psql -U app app -c "
SELECT
  \"connectorUuid\",
  \"odooWebhookUrl\",
  \"updatedAt\"
FROM \"OdooGatewayCredential\";
"
```

Should show updated URL without "localhost".

### 2. Test Webhook Connectivity

Visit (while logged in):
```
POST /api/debug/webhook-test
```

Should return:
```json
{
  "networkTest": {
    "reachable": true
  },
  "webhookTest": {
    "success": true
  },
  "recommendations": [
    "✅ Webhook is working! Test message delivered successfully."
  ]
}
```

### 3. Send Test WhatsApp Message

1. Send a message to your WhatsApp number
2. Watch logs:
   ```bash
   docker-compose logs -f web | grep -E "Incoming|webhook"
   ```
3. Expected output:
   ```
   Incoming message
   messageId: ABC123
   Odoo Acrux inbound prepare/delivery
   ```
4. Check Odoo ChatRoom - message should appear!

---

## Why localhost Doesn't Work in Docker

```
┌─────────────────────────────────────┐
│          Host Machine               │
│                                     │
│  Odoo running on:                   │
│  localhost:8017                     │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Docker Container (web)      │  │
│  │                               │  │
│  │  When code tries to connect   │  │
│  │  to "localhost:8017":         │  │
│  │                               │  │
│  │  ❌ Looks inside container    │  │
│  │  ❌ Finds nothing on 8017     │  │
│  │  ❌ ECONNREFUSED              │  │
│  │                               │  │
│  │  Solution: Use                │  │
│  │  "host.docker.internal:8017"  │  │
│  │  ✅ Connects to host machine │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## Production Deployment

For production, use **external URLs** instead of localhost:

### Best Practice:

**Odoo Webhook URL:**
```
https://odoo.yourcompany.com/acrux_webhook/whatsapp_connector/<uuid>
```

**API Endpoint (in Odoo connector):**
```
https://whatsapp-api.yourcompany.com/api/odoo/gateway
```

**Benefits:**
- ✅ Works from any network
- ✅ SSL/HTTPS encryption
- ✅ No Docker networking issues
- ✅ Can use load balancers, CDNs, etc.

---

## Additional Troubleshooting

If the fix above doesn't solve the issue, see:
- **[WEBHOOK_TROUBLESHOOTING.md](./WEBHOOK_TROUBLESHOOTING.md)** - Complete troubleshooting guide
- **[QUICKSTART_WHATSAPP_TESTING.md](./QUICKSTART_WHATSAPP_TESTING.md)** - End-to-end testing guide

Common issues:
- Firewall blocking Docker → host communication
- Odoo WhatsApp Connector module not installed
- UUID mismatch between database and Odoo
- Network isolation between Docker containers

---

## Summary

| Issue | Fix |
|-------|-----|
| localhost not reachable | Use `host.docker.internal` |
| Different Docker networks | Add services to same network |
| Production deployment | Use external HTTPS URLs |
| Testing webhook | Use `/api/debug/webhook-test` |

**Quick command:**
```bash
# Fix localhost issue
docker-compose exec db psql -U app app -c "
UPDATE \"OdooGatewayCredential\"
SET \"odooWebhookUrl\" = REPLACE(\"odooWebhookUrl\", 'localhost', 'host.docker.internal')
WHERE \"odooWebhookUrl\" LIKE '%localhost%';
"

# Test
docker-compose exec web curl -I http://host.docker.internal:8017/web/database/selector
```

**Status:** Issue identified and documented with solutions.
