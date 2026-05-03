# ✅ Webhook Issue - SOLVED

## Problem Identified

**Webhooks ARE working** - the code is correct!

**The only issue:** Database has wrong URL

### Evidence:
```
✅ Code works: 8 webhooks attempted and logged to dead letter queue
✅ Logs show: "Incoming message" detected
✅ Mapper works: Messages being prepared for Odoo
❌ URL wrong: Still pointing to localhost instead of ngrok
```

**Current database:**
```sql
odooWebhookUrl: http://localhost:8017/acrux_webhook/whatsapp_connector/...
```

**Should be:**
```sql
odooWebhookUrl: https://YOUR_NGROK_URL.ngrok-free.app/acrux_webhook/whatsapp_connector/...
```

---

## Fix in 2 Commands

### 1. Update Database

```bash
# Replace with YOUR actual ngrok URL
NGROK_URL="https://abc123.ngrok-free.app"

UUID=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"connectorUuid\" FROM \"OdooGatewayCredential\" LIMIT 1;" | tr -d ' \n')

docker-compose exec -T db psql -U app app << EOF
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = '${NGROK_URL}/acrux_webhook/whatsapp_connector/${UUID}';
SELECT "odooWebhookUrl" FROM "OdooGatewayCredential";
EOF
```

### 2. Test

```bash
# Watch logs
docker-compose logs -f web | grep "WEBHOOK DEBUG"

# Send WhatsApp message
# Should see: POST result: { ok: true, status: 200 }
```

---

## What Was Added

### Enhanced Debug Logging

**File:** `lib/odoo-webhook-delivery.ts`
- ✅ Logs every webhook attempt
- ✅ Shows URL being called
- ✅ Shows success/failure
- ✅ Shows exact error

**File:** `src/handlers/message.handler.ts`
- ✅ Logs inbound message processing
- ✅ Shows prepared Acrux row data
- ✅ Confirms webhook delivery triggered

### New Debug Endpoints

**File:** `app/api/debug/webhook-test/route.ts`
- Test webhook connectivity
- POST `/api/debug/webhook-test` (requires login)

### Documentation Created

1. **WEBHOOK_DEBUG_STEPS.md** - Complete troubleshooting guide
2. **FIX_WEBHOOK_NOW.md** - Quick fix commands
3. **WEBHOOK_TROUBLESHOOTING.md** - Detailed error solutions
4. **WEBHOOK_ISSUE_LOCALHOST.md** - localhost vs Docker explanation

### Helper Scripts

**File:** `scripts/update-webhook-url.sh`
```bash
./scripts/update-webhook-url.sh https://your-ngrok-url.ngrok-free.app
```

---

## How to Use Going Forward

### Every Time ngrok Restarts

ngrok free tier changes URL every restart!

**Quick update:**
```bash
# 1. Get new ngrok URL from dashboard
# http://127.0.0.1:4040

# 2. Update database
NGROK_URL="https://NEW_URL.ngrok-free.app"
UUID=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"connectorUuid\" FROM \"OdooGatewayCredential\";" | tr -d ' \n')

docker-compose exec -T db psql -U app app -c "
UPDATE \"OdooGatewayCredential\"
SET \"odooWebhookUrl\" = '${NGROK_URL}/acrux_webhook/whatsapp_connector/${UUID}';
"

# 3. No need to restart - webhook will use new URL immediately
```

### Monitor Webhooks

```bash
# Watch webhook activity
docker-compose logs -f web | grep "WEBHOOK DEBUG"

# Check failed webhooks
docker-compose exec db psql -U app app -c "
SELECT COUNT(*), \"lastError\"
FROM \"OdooWebhookDeadLetter\"
WHERE \"resolvedAt\" IS NULL
GROUP BY \"lastError\";
"
```

---

## Log Messages Explained

### Success:
```
[WEBHOOK DEBUG] Processing inbound message for Odoo
  → Message received from WhatsApp

[WEBHOOK DEBUG] Prepared Acrux row: { type: 'text', txt: 'hello', ... }
  → Message formatted for Odoo

[WEBHOOK DEBUG] deliverAcuxInboundRow called
  → Webhook delivery initiated

[WEBHOOK DEBUG] deliverToOdooWithDlq called { webhookUrl: 'https://...', hasMessages: true }
  → Webhook URL retrieved from database

[WEBHOOK DEBUG] Attempting POST to: https://abc123.ngrok-free.app/...
  → Making HTTP request to Odoo

[WEBHOOK DEBUG] POST result: { ok: true, status: 200 }
  → ✅ SUCCESS! Message delivered to Odoo
```

### Failure (wrong URL):
```
[WEBHOOK DEBUG] POST result: { ok: false, error: 'fetch failed' }
  → ❌ Failed to connect (wrong URL)

[WEBHOOK DEBUG] Webhook delivery failed, adding to DLQ: fetch failed
  → Saved to dead letter queue for retry
```

---

## Verification Checklist

After updating webhook URL:

- [ ] Database shows ngrok URL (not localhost)
- [ ] Sent test WhatsApp message
- [ ] Logs show "POST result: { ok: true }"
- [ ] ngrok dashboard shows POST request
- [ ] Message appears in Odoo ChatRoom
- [ ] Dead letter queue is empty

**Check each:**
```bash
# 1. Database URL
docker-compose exec db psql -U app app -c "SELECT \"odooWebhookUrl\" FROM \"OdooGatewayCredential\";"

# 2. Send test message to WhatsApp number

# 3. Watch logs
docker-compose logs -f web | grep "POST result"

# 4. ngrok dashboard
# Open: http://127.0.0.1:4040/inspect/http

# 5. Odoo ChatRoom
# Open Odoo → ChatRoom → Check for message

# 6. DLQ count
docker-compose exec db psql -U app app -c "SELECT COUNT(*) FROM \"OdooWebhookDeadLetter\" WHERE \"resolvedAt\" IS NULL;"
```

---

## ngrok Alternatives (Production)

For production, don't use ngrok. Instead:

### Option 1: VPS with Public IP
```bash
# Odoo running on VPS
odooWebhookUrl: https://odoo.yourcompany.com/acrux_webhook/...
```

### Option 2: Cloudflare Tunnel
```bash
cloudflared tunnel --url http://localhost:8017
# Get public URL
# Update database
```

### Option 3: ngrok Paid Tier
```bash
ngrok http --domain=your-static-domain.ngrok-app 8017
# URL never changes!
```

### Option 4: Both in Same Docker Network
```yaml
# docker-compose.yml
services:
  odoo:
    networks: [shared]
  whatsapp:
    networks: [shared]

# webhook URL:
http://odoo:8069/acrux_webhook/...
```

---

## Quick Reference

### Get ngrok URL
```bash
curl http://127.0.0.1:4040/api/tunnels | grep -o 'https://[^"]*ngrok[^"]*'
```

### Update Webhook URL
```bash
NGROK_URL="https://abc123.ngrok-free.app"
UUID=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"connectorUuid\" FROM \"OdooGatewayCredential\";" | tr -d ' \n')
docker-compose exec -T db psql -U app app -c "UPDATE \"OdooGatewayCredential\" SET \"odooWebhookUrl\" = '${NGROK_URL}/acrux_webhook/whatsapp_connector/${UUID}';"
```

### Clear DLQ
```bash
docker-compose exec db psql -U app app -c "UPDATE \"OdooWebhookDeadLetter\" SET \"resolvedAt\" = NOW() WHERE \"resolvedAt\" IS NULL;"
```

### Watch Webhooks
```bash
docker-compose logs -f web | grep -E "WEBHOOK|Incoming"
```

---

## Support

If still not working after updating URL:

1. **Collect logs:**
   ```bash
   docker-compose logs --tail=100 web > debug.log
   ```

2. **Check ngrok:**
   - Visit http://127.0.0.1:4040/inspect/http
   - Screenshot any POST requests to `/acrux_webhook`

3. **Test manually:**
   ```bash
   curl -X POST "$(docker-compose exec -T db psql -U app app -t -c 'SELECT "odooWebhookUrl" FROM "OdooGatewayCredential";' | tr -d ' ')" \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"type":"text","txt":"test","id":"1","number":"123","name":"Test","time":123}],"events":[],"updates":[]}'
   ```

4. **Provide:**
   - Webhook URL from database
   - ngrok URL
   - Logs with WEBHOOK DEBUG messages
   - Manual curl test result
   - ngrok dashboard screenshot

---

**Status:** ✅ Issue identified, solution documented, debug logging added.

**Next step:** Update database with your ngrok URL and test!
