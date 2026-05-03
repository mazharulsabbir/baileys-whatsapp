# Webhook Troubleshooting Guide
## Inbound Messages (WhatsApp → Odoo)

## Issue: Messages Sending from Odoo Work, But Incoming Messages Don't Reach Odoo

This guide helps diagnose why outbound messages (Odoo → WhatsApp) work but inbound messages (WhatsApp → Odoo) don't.

---

## Understanding the Flow

### Outbound (Working)
```
Odoo → HTTP POST → /api/odoo/gateway (action=send)
     → WhatsApp Service → Baileys → WhatsApp Servers
     → Message delivered ✅
```

### Inbound (Not Working)
```
WhatsApp Servers → Baileys → Message Handler
     → prepareAcuxInboundRow() → deliverAcuxInboundRow()
     → POST to odooWebhookUrl → Odoo /acrux_webhook/whatsapp_connector/<uuid>
     → Message appears in Odoo ChatRoom ❌
```

---

## Diagnostic Steps

### 1. Test Webhook Connectivity

Visit (while logged in):
```
POST /api/debug/webhook-test
```

This will:
- ✅ Check if webhook URL is configured
- ✅ Test network connectivity to Odoo
- ✅ Send a test webhook payload
- ✅ Report any issues with recommendations

### 2. Check Webhook Configuration

```bash
# Connect to database
docker-compose exec db psql -U app app

# Check webhook URL
SELECT "userId", "connectorUuid", "odooWebhookUrl", "updatedAt"
FROM "OdooGatewayCredential";
```

**Expected output:**
```
userId | connectorUuid | odooWebhookUrl | updatedAt
-------|---------------|----------------|----------
abc123 | uuid-here     | http://odoo... | 2024-...
```

**If `odooWebhookUrl` is NULL:**
- Odoo hasn't called `config_set` yet
- Solution: In Odoo, go to connector and click "Test Connection" or refresh status

### 3. Check Application Logs

```bash
# Watch for incoming messages
docker-compose logs -f web | grep -E "Incoming message|Odoo.*inbound|webhook"

# Expected when receiving WhatsApp message:
# Incoming message
# Odoo Acrux inbound prepare/delivery
# Webhook POST successful (or failed with error)
```

**If you see "Incoming message" but no webhook logs:**
- Webhook URL might be missing in database
- Check step 2 above

**If you see webhook POST failures:**
- Check the error message
- Common issues below

### 4. Check Dead Letter Queue

```bash
# Check for failed webhooks
docker-compose exec db psql -U app app -c "
SELECT
  \"webhookUrl\",
  \"lastError\",
  \"createdAt\"
FROM \"OdooWebhookDeadLetter\"
WHERE \"resolvedAt\" IS NULL
ORDER BY \"createdAt\" DESC
LIMIT 10;
"
```

Or visit API endpoint (while logged in):
```
GET /api/integration/odoo-dlq
```

---

## Common Issues & Solutions

### Issue 1: Webhook URL Uses localhost

**Symptom:**
```
odooWebhookUrl: http://localhost:8017/acrux_webhook/...
Error: ECONNREFUSED
```

**Cause:**
- Application runs in Docker container
- `localhost` inside container ≠ host machine's localhost
- Container cannot reach Odoo on host's localhost

**Solutions:**

**Option A: Use host.docker.internal (Docker Desktop)**
```sql
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = REPLACE("odooWebhookUrl", 'localhost', 'host.docker.internal');
```

**Option B: Use Host IP Address**
```bash
# On Windows (PowerShell)
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*"}

# On Linux/Mac
hostname -I | awk '{print $1}'
```

Then update:
```sql
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = REPLACE("odooWebhookUrl", 'localhost', '192.168.1.100');
```

**Option C: Use Odoo's External URL**
```sql
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = REPLACE("odooWebhookUrl", 'http://localhost:8017', 'https://your-odoo.com');
```

**Option D: Update in Odoo and Reconfigure**
1. In Odoo connector, update "Odoo URL (Webhook)" field
2. Use `http://host.docker.internal:8017` or public URL
3. Save connector
4. Click "Test Connection" to trigger config_set

### Issue 2: Network Isolation (Docker Compose)

**Symptom:**
```
Error: ENOTFOUND odoo
Error: connect ETIMEDOUT
```

**Cause:**
- Odoo and WhatsApp API are on different Docker networks
- They cannot communicate

**Solution:**

**If both services are in same docker-compose.yml:**
```yaml
# docker-compose.yml
services:
  web:
    networks:
      - shared-network

  odoo:
    networks:
      - shared-network

networks:
  shared-network:
    driver: bridge
```

Update webhook URL to use service name:
```sql
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = 'http://odoo:8069/acrux_webhook/whatsapp_connector/...';
```

**If services are in different docker-compose files:**
```yaml
# odoo/docker-compose.yml
networks:
  shared:
    name: odoo-network
    driver: bridge

# baileys-whatsapp/docker-compose.yml
networks:
  external_odoo:
    external: true
    name: odoo-network

services:
  web:
    networks:
      - external_odoo
```

### Issue 3: Odoo Endpoint Returns 404

**Symptom:**
```
Webhook POST returned 404 Not Found
```

**Cause:**
- WhatsApp Connector module not installed in Odoo
- Wrong endpoint URL
- UUID mismatch

**Solutions:**

1. **Verify module is installed:**
   - In Odoo: Apps → Search "WhatsApp ChatRoom" or "Acrux"
   - Should show "Installed" status

2. **Check UUID matches:**
   ```bash
   # In database
   docker-compose exec db psql -U app app -c "SELECT \"connectorUuid\" FROM \"OdooGatewayCredential\";"

   # In Odoo
   # ChatRoom → Configuration → Connectors → Your Connector → Account ID (UUID)
   # They must match!
   ```

3. **Verify endpoint format:**
   ```
   Correct: http://odoo:8069/acrux_webhook/whatsapp_connector/<uuid>
   Wrong:   http://odoo:8069/webhook/whatsapp/<uuid>
   ```

### Issue 4: Odoo Returns 401/403 Unauthorized

**Symptom:**
```
Webhook POST returned 401 Unauthorized
Webhook POST returned 403 Forbidden
```

**Cause:**
- Odoo webhook endpoint doesn't use authentication headers
- BUT might check UUID in URL path
- UUID mismatch or invalid

**Solution:**
Check UUID matches (see Issue 3, solution 2)

### Issue 5: Odoo Returns 500 Server Error

**Symptom:**
```
Webhook POST returned 500 Internal Server Error
```

**Cause:**
- Odoo Python exception processing webhook
- Invalid payload structure
- Odoo database error

**Solutions:**

1. **Check Odoo logs:**
   ```bash
   docker-compose logs -f odoo | grep -i error
   ```

2. **Check payload structure:**
   ```bash
   # View failed payloads in DLQ
   docker-compose exec db psql -U app app -c "
   SELECT payload FROM \"OdooWebhookDeadLetter\"
   ORDER BY \"createdAt\" DESC
   LIMIT 1;
   "
   ```

3. **Verify Odoo connector is active:**
   - In Odoo: ChatRoom → Configuration → Connectors
   - Status should show green "Connected"

### Issue 6: Firewall Blocking Requests

**Symptom:**
```
Error: ETIMEDOUT
Connection timeout
```

**Cause:**
- Host firewall blocks Docker → host communication
- Corporate firewall blocks outbound requests

**Solutions:**

**Windows Firewall:**
```powershell
# Allow Docker Desktop
New-NetFirewallRule -DisplayName "Docker Desktop" -Direction Inbound -Action Allow
```

**Linux iptables:**
```bash
# Allow Docker bridge network
sudo iptables -I INPUT -i docker0 -j ACCEPT
```

**Test connectivity from container:**
```bash
docker-compose exec web curl -I http://host.docker.internal:8017/web/database/selector
```

---

## Verification Checklist

Before creating a support ticket, verify:

### Database Configuration
- [ ] Webhook URL is set in `OdooGatewayCredential` table
- [ ] Webhook URL format is correct
- [ ] UUID matches between database and Odoo connector
- [ ] No NULL values in required fields

### Network Connectivity
- [ ] Can ping/curl Odoo from WhatsApp container
- [ ] Webhook URL is accessible (not localhost if in Docker)
- [ ] No firewall blocking requests
- [ ] Correct port number in URL

### Odoo Configuration
- [ ] WhatsApp Connector module installed
- [ ] Connector created with type "apichat.io"
- [ ] Connector UUID matches database
- [ ] Connector status shows "Connected"
- [ ] "Odoo URL (WebHook)" field uses correct URL

### Application Logs
- [ ] "Incoming message" appears when receiving WhatsApp message
- [ ] "Odoo Acrux inbound" message appears after incoming message
- [ ] No errors in webhook delivery logs
- [ ] Dead letter queue is empty

---

## Testing End-to-End

### 1. Send Test Message to WhatsApp

1. Send a WhatsApp message to the connected number
2. Watch logs in real-time:
   ```bash
   docker-compose logs -f web | grep -A 5 "Incoming message"
   ```

3. Expected log sequence:
   ```
   Incoming message
   messageId: ABC123
   from: 1234567890@s.whatsapp.net
   Message content: "test"
   Odoo Acrux inbound prepare/delivery
   ```

### 2. Check Odoo ChatRoom

1. Open Odoo → ChatRoom
2. Message should appear in conversation list
3. If not appearing, check Odoo logs:
   ```bash
   docker-compose logs -f odoo | grep -i acrux
   ```

### 3. Manual Webhook Test

```bash
# Get webhook URL from database
WEBHOOK_URL=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"odooWebhookUrl\" FROM \"OdooGatewayCredential\" LIMIT 1;" | tr -d ' ')

# Send test payload
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "type": "text",
      "txt": "Test message",
      "id": "test_123",
      "number": "1234567890",
      "name": "Test User",
      "time": 1704067200
    }],
    "events": [],
    "updates": []
  }'
```

Expected: Message appears in Odoo ChatRoom

---

## Debug Endpoint

Use the webhook test endpoint (requires login):

```bash
POST /api/debug/webhook-test
```

Returns detailed diagnostics:
```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "webhookConfig": {
    "hasUrl": true,
    "url": "http://odoo:8069/acrux_webhook/whatsapp_connector/...",
    "uuid": "..."
  },
  "networkTest": {
    "attempted": true,
    "reachable": true,
    "responseTime": 45
  },
  "webhookTest": {
    "attempted": true,
    "success": true,
    "status": 200
  },
  "recommendations": [
    "✅ Webhook is working! Test message delivered successfully."
  ]
}
```

---

## Quick Fixes

### Force Webhook URL Update

```bash
# Update webhook URL directly (replace with your Odoo URL)
docker-compose exec db psql -U app app << EOF
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = 'http://host.docker.internal:8017/acrux_webhook/whatsapp_connector/'
  || "connectorUuid",
  "updatedAt" = NOW();
EOF
```

### Retry Failed Webhooks

Visit (while logged in):
```
GET /api/integration/odoo-dlq
```

Manually retry via API:
```bash
curl -X POST http://localhost:3000/api/integration/odoo-dlq \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"dlqId": "DEAD_LETTER_ID"}'
```

### Clear Dead Letter Queue

```bash
docker-compose exec db psql -U app app << EOF
UPDATE "OdooWebhookDeadLetter"
SET "resolvedAt" = NOW()
WHERE "resolvedAt" IS NULL;
EOF
```

---

## Production Recommendations

### 1. Use External URLs

Always use publicly accessible URLs for webhooks in production:
```
❌ http://localhost:8017/...
❌ http://192.168.1.100:8017/...
✅ https://odoo.yourcompany.com/...
```

### 2. Enable HTTPS

Both services should use HTTPS in production:
```
Odoo Webhook URL: https://odoo.yourcompany.com/acrux_webhook/...
API Endpoint:     https://whatsapp-api.yourcompany.com/api/odoo/gateway
```

### 3. Monitor Dead Letter Queue

Set up monitoring for failed webhooks:
```bash
# Alert if DLQ count > 10
COUNT=$(docker-compose exec -T db psql -U app app -t -c "
  SELECT COUNT(*) FROM \"OdooWebhookDeadLetter\" WHERE \"resolvedAt\" IS NULL;
")

if [ "$COUNT" -gt 10 ]; then
  echo "⚠️ Too many failed webhooks: $COUNT"
  # Send alert
fi
```

### 4. Configure Logging

Enable detailed webhook logs:
```bash
# .env
LOG_LEVEL=debug
ENABLE_WEBHOOK_DLQ=true
WEBHOOK_DLQ_PATH=/app/logs/webhook-dlq
```

---

## Getting Help

If issues persist, collect this information:

1. **Webhook test results:**
   ```
   POST /api/debug/webhook-test
   ```

2. **Database configuration:**
   ```bash
   docker-compose exec db psql -U app app -c "
   SELECT * FROM \"OdooGatewayCredential\";
   "
   ```

3. **Application logs (last 100 lines):**
   ```bash
   docker-compose logs --tail=100 web > logs.txt
   ```

4. **Dead letter queue:**
   ```bash
   docker-compose exec db psql -U app app -c "
   SELECT * FROM \"OdooWebhookDeadLetter\" WHERE \"resolvedAt\" IS NULL;
   " > dlq.txt
   ```

5. **Network test:**
   ```bash
   docker-compose exec web curl -v http://YOUR_ODOO_URL/web/database/selector
   ```

Provide all outputs when seeking support.
