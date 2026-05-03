# Fix Webhook NOW - Quick Commands

## ⚠️ DIAGNOSIS: Webhooks ARE working, but URL is wrong!

**Proof:**
- ✅ 8 failed webhooks in dead letter queue
- ✅ Error: "fetch failed" (trying to connect to localhost)
- ❌ URL still shows: `http://localhost:8017/...`
- ❌ Should be your ngrok URL

---

## Step 1: Get Your ngrok URL

If ngrok is running, find your URL:

```bash
# Check ngrok dashboard
# Open: http://127.0.0.1:4040

# Your URL will look like:
https://abc123.ngrok-free.app
# OR
https://abc123.ngrok.io
```

**If ngrok is NOT running:**

```bash
# Start ngrok pointing to Odoo port
ngrok http 8017

# Copy the https:// URL from the output
```

---

## Step 2: Update Database (COPY THIS EXACTLY)

```bash
# REPLACE THIS with your actual ngrok URL (keep the https://)
NGROK_URL="https://YOUR_NGROK_URL_HERE.ngrok-free.app"

# Get UUID from database
UUID=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"connectorUuid\" FROM \"OdooGatewayCredential\" LIMIT 1;" | tr -d ' \n')

echo "UUID: $UUID"
echo "Full webhook URL: ${NGROK_URL}/acrux_webhook/whatsapp_connector/${UUID}"

# Update database
docker-compose exec -T db psql -U app app << EOF
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = '${NGROK_URL}/acrux_webhook/whatsapp_connector/${UUID}',
    "updatedAt" = NOW();

SELECT "odooWebhookUrl" FROM "OdooGatewayCredential";
EOF
```

**Example (with real ngrok URL):**
```bash
NGROK_URL="https://abc123.ngrok-free.app"

UUID=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"connectorUuid\" FROM \"OdooGatewayCredential\" LIMIT 1;" | tr -d ' \n')

docker-compose exec -T db psql -U app app << EOF
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = '${NGROK_URL}/acrux_webhook/whatsapp_connector/${UUID}',
    "updatedAt" = NOW();
SELECT "odooWebhookUrl" FROM "OdooGatewayCredential";
EOF
```

---

## Step 3: Verify Update

```bash
docker-compose exec db psql -U app app -c "SELECT \"odooWebhookUrl\" FROM \"OdooGatewayCredential\";"
```

**Should show:**
```
https://abc123.ngrok-free.app/acrux_webhook/whatsapp_connector/13d5d026...
```

**NOT:**
```
http://localhost:8017/...  ❌ WRONG
```

---

## Step 4: Watch Logs

```bash
docker-compose logs -f web | grep -E "WEBHOOK DEBUG|Incoming"
```

---

## Step 5: Send Test Message

1. **Send WhatsApp message to your number**
2. **Watch logs** - should see:

```
[WEBHOOK DEBUG] Processing inbound message for Odoo
[WEBHOOK DEBUG] Prepared Acrux row: { type: 'text', txt: '...', ... }
[WEBHOOK DEBUG] deliverAcuxInboundRow called
[WEBHOOK DEBUG] deliverToOdooWithDlq called { userId: '...', webhookUrl: 'https://...ngrok...', hasMessages: true, messageCount: 1 }
[WEBHOOK DEBUG] Attempting POST to: https://abc123.ngrok-free.app/acrux_webhook/...
[WEBHOOK DEBUG] POST result: { ok: true, status: 200 }
```

---

## Step 6: Check ngrok Dashboard

Open: http://127.0.0.1:4040/inspect/http

You should see:
- **POST** request to `/acrux_webhook/whatsapp_connector/...`
- **Status:** 200 OK
- **Request body:** Contains message data
- **Response:** From Odoo

---

## Troubleshooting After Update

### If Still Shows "fetch failed":

**Check ngrok is actually running:**
```bash
curl -I https://YOUR_NGROK_URL.ngrok-free.app
```

**Should get:** 200 or 302 response (NOT connection refused)

### If Shows "404 Not Found":

**Odoo endpoint doesn't exist. Check:**

1. **Is Odoo running on port 8017?**
   ```bash
   curl -I http://localhost:8017/web/database/selector
   ```

2. **Is WhatsApp Connector module installed in Odoo?**
   - Go to Odoo → Apps → Search "WhatsApp" or "Acrux"
   - Should show "Installed"

3. **Does ngrok forward to correct port?**
   ```bash
   # Should show:
   ngrok http 8017
   # NOT:
   ngrok http 8069  # Wrong port
   ```

### If Shows "Timeout":

ngrok might be rate-limiting (free tier) or slow.

**Solution:**
- Upgrade ngrok
- OR use local network IP if Odoo is accessible locally

---

## After It Works

### Clear Dead Letter Queue:

```bash
docker-compose exec db psql -U app app << 'EOF'
UPDATE "OdooWebhookDeadLetter"
SET "resolvedAt" = NOW()
WHERE "resolvedAt" IS NULL;

SELECT COUNT(*) as cleared FROM "OdooWebhookDeadLetter" WHERE "resolvedAt" IS NOT NULL;
EOF
```

### Verify Messages in Odoo:

1. Open Odoo → ChatRoom
2. Should see conversation with your WhatsApp number
3. Messages should appear in real-time

---

## Important: ngrok Free Tier Warning

⚠️ **ngrok free tier changes URL every restart!**

Every time you restart ngrok, you need to:
1. Get new URL
2. Update database (Step 2 above)
3. Restart web service

**Better solutions:**
- Use ngrok paid tier (static domain)
- Use ngrok config with reserved domain
- Use VPS with public IP
- Use Odoo's public URL if already accessible

---

## One-Liner Update (For Future ngrok Restarts)

Save this as a script:

```bash
#!/bin/bash
# update-ngrok.sh

NGROK_URL="$1"

if [ -z "$NGROK_URL" ]; then
    echo "Usage: $0 https://your-ngrok-url.ngrok-free.app"
    exit 1
fi

UUID=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"connectorUuid\" FROM \"OdooGatewayCredential\" LIMIT 1;" | tr -d ' \n')

docker-compose exec -T db psql -U app app << EOF
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = '${NGROK_URL}/acrux_webhook/whatsapp_connector/${UUID}';
SELECT "odooWebhookUrl" FROM "OdooGatewayCredential";
EOF

echo "✅ Updated! Restart: docker-compose restart web"
```

**Usage:**
```bash
chmod +x update-ngrok.sh
./update-ngrok.sh https://new-url.ngrok-free.app
docker-compose restart web
```

---

## ✅ SUMMARY

1. **Problem:** Webhook URL is `localhost`, not ngrok
2. **Solution:** Update database with ngrok URL (Step 2)
3. **Test:** Send WhatsApp message and check logs
4. **Success:** Logs show `POST result: { ok: true }`
5. **Verify:** Message appears in Odoo ChatRoom

**Start with Step 2 NOW!**
