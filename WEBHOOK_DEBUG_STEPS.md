# Webhook Debug Steps - Complete Troubleshooting

## Current Issue
- Messages send from Odoo → WhatsApp ✅ (working)
- Messages from WhatsApp → Odoo ❌ (not working)
- Using ngrok for webhook URL

---

## Step 1: Update Webhook URL to ngrok

### Get Your ngrok URL
If you're running ngrok:
```bash
# Your ngrok URL should look like:
https://abc123.ngrok.io

# Or check ngrok dashboard:
http://127.0.0.1:4040
```

### Update Database with ngrok URL

```bash
# Get connector UUID
docker-compose exec db psql -U app app -c "SELECT \"connectorUuid\" FROM \"OdooGatewayCredential\";"

# Update webhook URL (replace with your ngrok URL and UUID)
docker-compose exec db psql -U app app << 'EOF'
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = 'https://YOUR_NGROK_URL.ngrok.io/acrux_webhook/whatsapp_connector/YOUR_UUID_HERE',
    "updatedAt" = NOW();

-- Verify
SELECT "odooWebhookUrl" FROM "OdooGatewayCredential";
EOF
```

**Quick command (auto-appends UUID):**
```bash
# Replace YOUR_NGROK_URL with your actual ngrok URL
NGROK_URL="https://abc123.ngrok.io"

UUID=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"connectorUuid\" FROM \"OdooGatewayCredential\" LIMIT 1;" | tr -d ' \n')

docker-compose exec -T db psql -U app app << EOF
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = '${NGROK_URL}/acrux_webhook/whatsapp_connector/${UUID}',
    "updatedAt" = NOW();
SELECT "odooWebhookUrl" FROM "OdooGatewayCredential";
EOF
```

---

## Step 2: Rebuild and Restart with Debug Logging

```bash
# Stop services
docker-compose down

# Rebuild with new logging
docker-compose build web

# Start services
docker-compose up -d

# Watch logs with webhook debug info
docker-compose logs -f web | grep -E "WEBHOOK DEBUG|Incoming message|ERROR"
```

---

## Step 3: Send Test WhatsApp Message

1. **Send a message to your WhatsApp number**
2. **Watch the logs** (should show):

```
[WEBHOOK DEBUG] Processing inbound message for Odoo
[WEBHOOK DEBUG] Prepared Acrux row: { type: 'text', txt: '...', ... }
[WEBHOOK DEBUG] deliverAcuxInboundRow called
[WEBHOOK DEBUG] deliverToOdooWithDlq called
[WEBHOOK DEBUG] Attempting POST to: https://abc123.ngrok.io/acrux_webhook/...
[WEBHOOK DEBUG] POST result: { ok: true, status: 200 }
```

---

## Step 4: Check What's Happening

### A. No Debug Logs at All?

**Check if tenantId is set:**
```bash
docker-compose logs -f web | grep "tenantId\|userId"
```

**Possible causes:**
- Service not initialized with tenantId
- WhatsApp not connected
- User not logged in

**Fix:**
1. Login to dashboard
2. Click "Connect / refresh QR"
3. Scan QR code
4. Send test message again

### B. Logs Show "No webhook URL configured"?

**Database URL is NULL or empty:**
```bash
docker-compose exec db psql -U app app -c "SELECT \"odooWebhookUrl\" FROM \"OdooGatewayCredential\";"
```

**Fix:** Go back to Step 1 and update the webhook URL.

### C. Logs Show "POST result: { ok: false }"?

**Webhook is being called but failing:**

Check the error:
```bash
docker-compose logs -f web | grep "POST result"
```

**Common errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED` | ngrok not running | Start ngrok |
| `404 Not Found` | Wrong URL path | Check endpoint path |
| `401/403` | Auth issue | Check UUID matches |
| `500` | Odoo error | Check Odoo logs |
| `Timeout` | ngrok slow/offline | Check ngrok status |

### D. Check Dead Letter Queue

```bash
# See all failed webhooks
docker-compose exec db psql -U app app -c "
SELECT
  \"webhookUrl\",
  \"lastError\",
  \"createdAt\",
  payload::text
FROM \"OdooWebhookDeadLetter\"
WHERE \"resolvedAt\" IS NULL
ORDER BY \"createdAt\" DESC
LIMIT 5;
"
```

**If there are entries:**
- They show why webhooks are failing
- Check `lastError` column for specific error message
- Check `webhookUrl` to ensure it's your ngrok URL

---

## Step 5: Test Webhook Manually

### A. Test ngrok Endpoint

```bash
# Get webhook URL from database
WEBHOOK_URL=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"odooWebhookUrl\" FROM \"OdooGatewayCredential\" LIMIT 1;" | tr -d ' ')

echo "Testing webhook URL: $WEBHOOK_URL"

# Send test payload
curl -v -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "type": "text",
      "txt": "Manual test message",
      "id": "test_manual_123",
      "number": "1234567890",
      "name": "Test User",
      "filename": "",
      "url": "",
      "time": 1704067200
    }],
    "events": [],
    "updates": []
  }'
```

**Expected response:**
- `200 OK` - Success! Webhook is working
- `404 Not Found` - Odoo endpoint doesn't exist
- `Connection refused` - ngrok not running or wrong URL

### B. Check ngrok Requests

Visit ngrok web interface:
```
http://127.0.0.1:4040/inspect/http
```

You should see:
- POST requests to `/acrux_webhook/whatsapp_connector/...`
- Request body with message payload
- Response status from Odoo

---

## Step 6: Verify Odoo Receives Messages

### In Odoo:

1. Go to **ChatRoom** app
2. Look for conversation from your WhatsApp number
3. Message should appear in real-time

### Check Odoo Logs:

```bash
# If Odoo is in Docker
docker-compose logs -f odoo | grep -i acrux

# Look for:
# - Webhook received
# - Message parsed
# - Conversation created
```

---

## Step 7: Common Issues & Solutions

### Issue 1: ngrok URL Not Updated

**Symptom:** Logs still show localhost

**Solution:**
```bash
docker-compose exec db psql -U app app << 'EOF'
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = 'https://YOUR_NGROK_URL.ngrok.io/acrux_webhook/whatsapp_connector/YOUR_UUID'
WHERE "odooWebhookUrl" LIKE '%localhost%';
SELECT "odooWebhookUrl" FROM "OdooGatewayCredential";
EOF

docker-compose restart web
```

### Issue 2: ngrok Free Tier Limitations

**ngrok free tier changes URLs on restart!**

**Solution:**
- Use ngrok paid tier for static URLs
- OR update database every time ngrok restarts
- OR use ngrok config with `--domain` flag

```bash
# ngrok with reserved domain (paid)
ngrok http --domain=your-static-domain.ngrok.io 8017
```

### Issue 3: Firewall Blocking ngrok

**Symptom:** Webhook timeout

**Solution:**
```bash
# Test if ngrok is accessible from container
docker-compose exec web curl -I https://YOUR_NGROK_URL.ngrok.io
```

### Issue 4: Odoo Module Not Installed

**Symptom:** 404 error on webhook

**Solution:**
1. In Odoo: Apps → Search "WhatsApp" or "Acrux"
2. Install "WhatsApp ChatRoom" module
3. Restart Odoo
4. Reconfigure connector

### Issue 5: UUID Mismatch

**Symptom:** 401/403 error

**Solution:**
```bash
# Get UUID from database
DB_UUID=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"connectorUuid\" FROM \"OdooGatewayCredential\";" | tr -d ' ')

echo "Database UUID: $DB_UUID"
echo "Check this matches in Odoo: ChatRoom → Connectors → Account ID"
```

---

## Step 8: Enable Maximum Debug Logging

### Update .env:
```bash
LOG_LEVEL=debug
```

### Restart:
```bash
docker-compose restart web
```

### Watch verbose logs:
```bash
docker-compose logs -f web
```

---

## Quick Diagnostics

Run all checks at once:

```bash
echo "=== Webhook Configuration ==="
docker-compose exec db psql -U app app -c "SELECT \"connectorUuid\", \"odooWebhookUrl\" FROM \"OdooGatewayCredential\";"

echo ""
echo "=== Failed Webhooks (DLQ) ==="
docker-compose exec db psql -U app app -c "SELECT COUNT(*), \"lastError\" FROM \"OdooWebhookDeadLetter\" WHERE \"resolvedAt\" IS NULL GROUP BY \"lastError\";"

echo ""
echo "=== Recent Logs ==="
docker-compose logs --tail=20 web | grep -E "WEBHOOK|Incoming"

echo ""
echo "=== Test ngrok Connectivity ==="
WEBHOOK_URL=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"odooWebhookUrl\" FROM \"OdooGatewayCredential\";" | tr -d ' ')
echo "Webhook URL: $WEBHOOK_URL"
curl -I "$WEBHOOK_URL" 2>&1 | head -5
```

---

## Success Indicators

You know it's working when you see:

1. ✅ **In Logs:**
   ```
   [WEBHOOK DEBUG] Processing inbound message for Odoo
   [WEBHOOK DEBUG] deliverToOdooWithDlq called
   [WEBHOOK DEBUG] Attempting POST to: https://...ngrok.io/...
   [WEBHOOK DEBUG] POST result: { ok: true, status: 200 }
   ```

2. ✅ **In ngrok Dashboard:**
   - POST request appears
   - Status: 200 OK
   - Response from Odoo

3. ✅ **In Odoo ChatRoom:**
   - New conversation appears
   - Message content is correct
   - Timestamp is accurate

4. ✅ **No entries in DLQ:**
   ```bash
   docker-compose exec db psql -U app app -c "
   SELECT COUNT(*) FROM \"OdooWebhookDeadLetter\" WHERE \"resolvedAt\" IS NULL;
   "
   # Should return: 0
   ```

---

## Still Not Working?

Provide this information:

1. **Webhook URL from database:**
   ```bash
   docker-compose exec db psql -U app app -c "SELECT \"odooWebhookUrl\" FROM \"OdooGatewayCredential\";"
   ```

2. **Recent logs with debug:**
   ```bash
   docker-compose logs --tail=100 web > webhook-debug.log
   ```

3. **Dead letter queue:**
   ```bash
   docker-compose exec db psql -U app app -c "SELECT * FROM \"OdooWebhookDeadLetter\" WHERE \"resolvedAt\" IS NULL;" > dlq.log
   ```

4. **ngrok request log:**
   - Screenshot from http://127.0.0.1:4040

5. **Manual curl test result:**
   ```bash
   curl -v -X POST "YOUR_NGROK_URL/acrux_webhook/..." \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"type":"text","txt":"test","id":"1","number":"123","name":"Test","time":123}],"events":[],"updates":[]}' \
     > curl-test.log 2>&1
   ```

---

**Next:** Run through Steps 1-6 in order and check the logs at each step!
