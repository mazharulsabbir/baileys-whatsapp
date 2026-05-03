# ✅ Webhook URL Updated Successfully!

## Updated Configuration

**ngrok URL:** `https://b12c-103-146-92-249.ngrok-free.app`

**Full Webhook URL:**
```
https://b12c-103-146-92-249.ngrok-free.app/acrux_webhook/whatsapp_connector/13d5d026-0fb8-46c7-bf71-6589ba1a1d38
```

**Updated At:** 2026-05-03 03:22:30

**Status:** ✅ ngrok is accessible (tested successfully)

---

## Test Now

### 1. Watch Webhook Logs

```bash
docker-compose logs -f web | grep "WEBHOOK DEBUG"
```

### 2. Send WhatsApp Test Message

Send a message to your WhatsApp number.

### 3. Expected Logs

You should see:

```
[WEBHOOK DEBUG] Processing inbound message for Odoo
[WEBHOOK DEBUG] Prepared Acrux row: { type: 'text', txt: 'your message here' }
[WEBHOOK DEBUG] deliverAcuxInboundRow called
[WEBHOOK DEBUG] deliverToOdooWithDlq called {
  userId: 'cmony6mmm0000o92y4rhb0oqz',
  webhookUrl: 'https://b12c-103-146-92-249.ngrok-free.app/acrux_webhook/...',
  hasMessages: true,
  messageCount: 1
}
[WEBHOOK DEBUG] Attempting POST to: https://b12c-103-146-92-249.ngrok-free.app/acrux_webhook/...
[WEBHOOK DEBUG] POST result: { ok: true, status: 200 }  ✅ SUCCESS!
```

### 4. Check ngrok Dashboard

Open: http://127.0.0.1:4040/inspect/http

You should see:
- POST request to `/acrux_webhook/whatsapp_connector/...`
- Status: 200 OK
- Request body with message data

### 5. Verify in Odoo

1. Open Odoo ChatRoom
2. Message should appear in conversation
3. Should show sender name and message content

---

## Old Failed Webhooks

**11 failed webhooks** in dead letter queue (from when URL was localhost).

### Option 1: Clear Them

```bash
docker-compose exec -T db psql -U app app << 'EOF'
UPDATE "OdooWebhookDeadLetter"
SET "resolvedAt" = NOW()
WHERE "resolvedAt" IS NULL;

SELECT COUNT(*) as cleared FROM "OdooWebhookDeadLetter" WHERE "resolvedAt" IS NOT NULL;
EOF
```

### Option 2: Retry Them

```bash
# Visit while logged in:
GET /api/integration/odoo-dlq

# Then retry each via dashboard or API
```

---

## Troubleshooting

### If POST Still Fails

**Check ngrok is forwarding to Odoo:**
```bash
# ngrok should be running on port 8017
curl -I http://localhost:8017/web/database/selector

# Should get 200 or 303 response
```

**Verify ngrok config:**
```bash
# ngrok command should be:
ngrok http 8017

# NOT:
ngrok http 3000  # Wrong port
ngrok http 8069  # Wrong port
```

### If Message Doesn't Appear in Odoo

**Check Odoo connector:**
1. ChatRoom → Configuration → Connectors
2. Your connector should be "Connected" (green)
3. Account ID (UUID) should match: `13d5d026-0fb8-46c7-bf71-6589ba1a1d38`

**Check Odoo logs:**
```bash
docker-compose logs -f odoo | grep -i acrux
```

### If ngrok Shows 404

**Odoo WhatsApp Connector module not installed:**
1. Odoo → Apps
2. Search "WhatsApp" or "Acrux"
3. Install if not already installed
4. Restart Odoo

---

## Monitor Webhooks

### Real-time Monitoring

```bash
# Watch all webhook activity
docker-compose logs -f web | grep -E "WEBHOOK|Incoming"

# Watch only successful POSTs
docker-compose logs -f web | grep "ok: true"

# Watch only failures
docker-compose logs -f web | grep "ok: false"
```

### Check Statistics

```bash
# Failed webhooks count
docker-compose exec db psql -U app app -c "
SELECT COUNT(*) as failed
FROM \"OdooWebhookDeadLetter\"
WHERE \"resolvedAt\" IS NULL;
"

# Group by error type
docker-compose exec db psql -U app app -c "
SELECT COUNT(*) as count, \"lastError\"
FROM \"OdooWebhookDeadLetter\"
WHERE \"resolvedAt\" IS NULL
GROUP BY \"lastError\";
"
```

---

## Important: ngrok URL Changes

⚠️ **ngrok free tier URL changes every restart!**

When you restart ngrok, you'll get a new URL. You'll need to:

1. Get new URL from http://127.0.0.1:4040
2. Update database:
   ```bash
   NGROK_URL="https://NEW_URL.ngrok-free.app"
   UUID="13d5d026-0fb8-46c7-bf71-6589ba1a1d38"

   docker-compose exec -T db psql -U app app -c "
   UPDATE \"OdooGatewayCredential\"
   SET \"odooWebhookUrl\" = '${NGROK_URL}/acrux_webhook/whatsapp_connector/${UUID}';
   "
   ```

**Better Solutions:**
- ngrok paid tier (static URL)
- VPS with public IP
- Cloudflare Tunnel
- Both services in same Docker network

---

## Success Checklist

- [x] Webhook URL updated in database
- [x] ngrok URL is accessible
- [ ] Sent test WhatsApp message
- [ ] Logs show "POST result: { ok: true }"
- [ ] ngrok dashboard shows POST request
- [ ] Message appears in Odoo ChatRoom
- [ ] No new entries in dead letter queue

---

**Status:** ✅ Ready to test!

**Next:** Send a WhatsApp message and watch the logs!
