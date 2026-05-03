# Quick Start: WhatsApp QR Code Testing

## TL;DR - The Fastest Way to Test

```bash
# 1. Start services
docker-compose up -d

# 2. Wait for services to be ready (30 seconds)
sleep 30

# 3. Create test user with active subscription
docker-compose exec db psql -U app app << 'EOF'
DO $$
DECLARE v_user_id UUID;
BEGIN
  INSERT INTO "User" (id, email, password, "createdAt", "updatedAt")
  VALUES (gen_random_uuid(), 'test@example.com', '$2b$10$', NOW(), NOW())
  ON CONFLICT (email) DO NOTHING RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM "User" WHERE email = 'test@example.com';
  END IF;

  INSERT INTO "Entitlement" ("userId", "planSlug", status, "validUntil", "createdAt", "updatedAt")
  VALUES (v_user_id, 'premium', 'active', NOW() + INTERVAL '30 days', NOW(), NOW())
  ON CONFLICT ("userId") DO UPDATE SET status = 'active', "validUntil" = NOW() + INTERVAL '30 days';
END $$;
EOF

# 4. Register user (to set proper password)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# 5. Open browser and login
echo "Open: http://localhost:3000/dashboard"
echo "Login: test@example.com / testpass123"
echo "Click: Connect / refresh QR"
echo "Wait: 5 seconds for QR code to appear"
```

---

## Step-by-Step Guide

### 1. Verify Services are Running

```bash
# Check container status
docker-compose ps

# Expected output:
# NAME                     STATUS
# baileys-whatsapp-api    Up
# baileys-whatsapp-db     Up (healthy)
```

If not running:
```bash
docker-compose up -d
docker-compose logs -f
```

### 2. Check Application Health

```bash
curl http://localhost:3000/api/health

# Expected:
# {"ok":true,"timestamp":"...","services":{"database":"up","whatsapp":"up"}}
```

If health check fails, check logs:
```bash
docker-compose logs -f web | grep -i error
```

### 3. Create Test User

**Option A: Using SQL (Direct)**

```bash
docker-compose exec db psql -U app app
```

Then run:
```sql
-- Get or create user
INSERT INTO "User" (id, email, password, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'test@example.com', 'placeholder', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Get user ID
SELECT id FROM "User" WHERE email = 'test@example.com';
-- Copy the ID from output

-- Add active entitlement (replace YOUR_USER_ID)
INSERT INTO "Entitlement" ("userId", "planSlug", status, "validUntil", "createdAt", "updatedAt")
VALUES ('YOUR_USER_ID', 'premium', 'active', NOW() + INTERVAL '30 days', NOW(), NOW())
ON CONFLICT ("userId") DO UPDATE SET
  status = 'active',
  "validUntil" = NOW() + INTERVAL '30 days';

-- Verify
SELECT u.email, e.status, e."validUntil"
FROM "User" u
JOIN "Entitlement" e ON e."userId" = u.id
WHERE u.email = 'test@example.com';
```

**Option B: Using Bash Script (Linux/Mac)**

```bash
./setup-test-user.sh
```

**Option C: Using SQL File**

```bash
docker-compose exec db psql -U app app < setup-test-user.sql
```

### 4. Register User via API

This sets the proper password hash:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

Expected response:
```json
{"message":"User created"}
```

Or:
```json
{"error":"Email already registered"}
```
(This is OK - user already exists)

### 5. Login to Dashboard

1. Open browser: **http://localhost:3000**
2. Click **"Login"**
3. Enter credentials:
   - Email: `test@example.com`
   - Password: `testpass123`
4. Should redirect to **Dashboard**

### 6. Connect WhatsApp

1. In Dashboard, locate **"WhatsApp connection"** section
2. Click **"Connect / refresh QR"** button
3. Wait 5-10 seconds
4. QR code should appear below the button

**If QR doesn't appear:**
- Check browser console (F12 → Console)
- Check debug endpoint (see below)
- Check application logs

### 7. Scan QR Code

1. Open **WhatsApp** on your phone
2. Go to **Settings → Linked Devices**
3. Tap **"Link a device"**
4. Scan the QR code on screen
5. Wait for **"Connected"** badge to appear

---

## Debugging When QR Doesn't Appear

### Check Debug Endpoint

Open (while logged in):
```
http://localhost:3000/api/debug/whatsapp-status
```

This shows:
- ✅ Authentication status
- ✅ Entitlement status
- ✅ WhatsApp service status
- ✅ QR code availability
- ✅ Specific recommendations

### Common Issues from Debug Output

**Issue: `"hasActive": false`**
```bash
# Fix: Add entitlement
docker-compose exec db psql -U app app
# Then run the INSERT INTO "Entitlement" query above
```

**Issue: `"exists": false` (no WhatsApp service)**
```bash
# Fix: Click "Connect" button
# OR restart web service
docker-compose restart web
```

**Issue: `"hasQr": false` (service exists but no QR)**
```bash
# Fix: Wait 5-10 seconds and refresh
# OR check logs for connection errors
docker-compose logs -f web | grep -i "qr\|error"
```

### Check Browser Console

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for errors in red
4. Go to **Network** tab
5. Click "Connect / refresh QR"
6. Check `/api/whatsapp/connect` request
   - Should return `{"ok":true}`
7. Check `/api/whatsapp/qr` requests (polling every 2.5 seconds)
   - Should return `{"connected":false,"qrDataUrl":"data:image/png;base64,..."}`

### Check Application Logs

```bash
# Watch logs in real-time
docker-compose logs -f web

# Filter for WhatsApp events
docker-compose logs -f web | grep -i whatsapp

# Look for QR event
docker-compose logs -f web | grep -i "qr code"
```

Expected log sequence after clicking Connect:
```
Connecting to WhatsApp...
Connection initiated
QR code received - waiting for scan...
```

After scanning:
```
✅ Connected to WhatsApp
Phone number: 1234567890
```

---

## Manual API Testing

Useful for debugging without the UI.

### 1. Register and Login

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Login (get session cookie)
curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' \
  -c cookies.txt -v
```

### 2. Check Health

```bash
curl http://localhost:3000/api/health?detailed=true
```

### 3. Connect WhatsApp

```bash
curl -X POST http://localhost:3000/api/whatsapp/connect \
  -H "Cookie: $(cat cookies.txt | grep next-auth.session-token | awk '{print $NF}')"
```

Expected:
```json
{"ok":true}
```

### 4. Get QR Code

Wait 5 seconds after connect, then:

```bash
curl http://localhost:3000/api/whatsapp/qr \
  -b cookies.txt
```

Expected (if not yet connected):
```json
{
  "connected": false,
  "qrDataUrl": "data:image/png;base64,iVBORw0KG..."
}
```

Expected (if already connected):
```json
{
  "connected": true,
  "qrDataUrl": null
}
```

### 5. Debug Status

```bash
curl http://localhost:3000/api/debug/whatsapp-status \
  -b cookies.txt | jq '.'
```

---

## Verification Checklist

Before reporting an issue, verify:

- [ ] Services are running (`docker-compose ps`)
- [ ] Database is healthy (`docker-compose exec db pg_isready`)
- [ ] Health check passes (`curl http://localhost:3000/api/health`)
- [ ] User exists in database
- [ ] User has active entitlement with `validUntil` in future
- [ ] User can login to dashboard
- [ ] Browser console shows no JavaScript errors
- [ ] Network tab shows `/api/whatsapp/connect` returns 200 OK
- [ ] Network tab shows `/api/whatsapp/qr` returns 200 OK
- [ ] Logs show "QR code received" message
- [ ] Internet connection is working
- [ ] WhatsApp Web (https://web.whatsapp.com) is accessible

---

## Advanced Debugging

### Enable Debug Logging

Edit `.env`:
```bash
LOG_LEVEL=debug
```

Restart:
```bash
docker-compose restart web
```

View verbose logs:
```bash
docker-compose logs -f web
```

### Check Session Files

```bash
# List all sessions
ls -la sessions/

# Check specific user session (replace USER_ID)
ls -la sessions/USER_ID_*/
```

Session should contain:
- `creds.json` - Authentication credentials
- `app-state-sync-key-*.json` - Sync keys

### Clear Session and Retry

```bash
# Stop web service
docker-compose stop web

# Clear all sessions
rm -rf sessions/*

# Start web service
docker-compose start web

# Try connecting again
```

### Test WhatsApp Connectivity

```bash
# From inside container
docker-compose exec web node -e "
const https = require('https');
https.get('https://web.whatsapp.com', (res) => {
  console.log('✅ Can reach WhatsApp servers:', res.statusCode);
  process.exit(0);
}).on('error', (err) => {
  console.error('❌ Cannot reach WhatsApp:', err.message);
  process.exit(1);
});
"
```

---

## Production Checklist

When deploying to production:

1. **Use production domain**
   - Update `NEXT_PUBLIC_APP_URL` in `.env.production`
   - Update `MEDIA_PUBLIC_BASE_URL`

2. **Configure SSL**
   - Use reverse proxy (nginx/Caddy)
   - Install valid SSL certificate
   - Force HTTPS

3. **Secure database**
   - Change default password
   - Restrict database port
   - Use strong `AUTH_SECRET`

4. **Configure firewall**
   - Allow outbound HTTPS (port 443)
   - Allow inbound HTTPS to your domain
   - Block direct database access

5. **Monitor logs**
   - Set up log aggregation
   - Configure alerts for errors
   - Monitor webhook DLQ

---

## Getting Help

If QR still doesn't work after following this guide:

1. **Collect debug info:**
   ```bash
   # Health check
   curl http://localhost:3000/api/health?detailed=true > health.json

   # Debug status (while logged in)
   curl http://localhost:3000/api/debug/whatsapp-status > debug.json

   # Recent logs
   docker-compose logs --tail=200 web > logs.txt

   # Container status
   docker-compose ps > containers.txt
   ```

2. **Check browser console:**
   - Open DevTools (F12)
   - Screenshot any errors in Console tab
   - Screenshot Network tab showing API calls

3. **Report with:**
   - Operating system
   - Docker version
   - Browser used
   - Exact error messages
   - Debug output files above
   - Screenshots

---

## Success Indicators

You know it's working when:

1. ✅ Dashboard shows subscription info
2. ✅ "Connect / refresh QR" button is enabled (not grayed out)
3. ✅ QR code appears within 10 seconds of clicking Connect
4. ✅ After scanning, badge changes to "Connected"
5. ✅ Test message via Odoo gateway successfully delivers to WhatsApp
6. ✅ Incoming WhatsApp messages trigger webhook to Odoo

---

**Ready to test!** Start with the TL;DR commands at the top of this file.
