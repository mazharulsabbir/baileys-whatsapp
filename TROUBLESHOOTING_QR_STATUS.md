# Troubleshooting: QR Code and Status Not Working

## Common Issues and Solutions

### Issue 1: No Active Subscription

**Symptoms:**
- QR endpoint returns 403 Forbidden
- Error message: "Active subscription required"

**Cause:**
The endpoints check for an active entitlement in the database before allowing WhatsApp connections.

**Solution:**
Add a test entitlement to the database:

```bash
# Using Docker Compose
docker-compose exec db psql -U app app

# SQL to create test entitlement (replace USER_ID with your actual user ID)
INSERT INTO "Entitlement" (id, "userId", "planSlug", status, "validUntil", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_USER_ID_HERE',
  'premium',
  'active',
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
)
ON CONFLICT ("userId") DO UPDATE SET
  status = 'active',
  "validUntil" = NOW() + INTERVAL '30 days',
  "updatedAt" = NOW();
```

**Get Your User ID:**
```sql
SELECT id, email FROM "User";
```

### Issue 2: Service Not Created

**Symptoms:**
- QR endpoint returns `{connected: false, qrDataUrl: null}`
- No QR code displayed after clicking "Connect"

**Cause:**
The WhatsApp service hasn't been initialized for your user.

**Solution:**

1. Click "Connect / refresh QR" button in dashboard
2. Wait 3-5 seconds
3. The QR polling should pick up the code

**Debug:**
Check application logs:
```bash
docker-compose logs -f web | grep -i "qr\|whatsapp\|connect"
```

### Issue 3: QR Code Timing Issue

**Symptoms:**
- Connect succeeds but QR code doesn't appear
- Dashboard shows "Not connected" but no QR

**Cause:**
Race condition between service creation and QR emission.

**Solution:**
The dashboard polls every 2.5 seconds. Wait a few polling cycles after clicking Connect.

**Manual Test:**
```bash
# Test connect endpoint
curl -X POST http://localhost:3000/api/whatsapp/connect \
  -H "Cookie: YOUR_SESSION_COOKIE"

# Wait 5 seconds, then test QR endpoint
sleep 5
curl http://localhost:3000/api/whatsapp/qr \
  -H "Cookie: YOUR_SESSION_COOKIE"
```

### Issue 4: Authentication/Session Issues

**Symptoms:**
- 401 Unauthorized errors
- Redirected to login page

**Cause:**
No valid session cookie.

**Solution:**
1. Make sure you're logged in
2. Check browser console for authentication errors
3. Try logging out and back in

### Issue 5: Database Connection Issues

**Symptoms:**
- Health check fails
- 503 Service Unavailable errors

**Cause:**
PostgreSQL database not accessible.

**Solution:**
```bash
# Check database status
docker-compose ps db

# Check database connectivity
docker-compose exec db pg_isready -U app

# Restart database if needed
docker-compose restart db
```

### Issue 6: WhatsApp Connection Failures

**Symptoms:**
- Error in logs: "WebSocket connection failed"
- Error: "Could not start WhatsApp connection"

**Cause:**
Cannot reach WhatsApp servers.

**Solutions:**
1. Check internet connection
2. Check firewall rules (allow outbound HTTPS)
3. Check if WhatsApp Web is accessible: https://web.whatsapp.com
4. Try again in a few minutes (WhatsApp servers may be temporarily down)

---

## Diagnostic Commands

### Check Application Health
```bash
curl http://localhost:3000/api/health?detailed=true
```

### Check Database Records
```bash
# Connect to database
docker-compose exec db psql -U app app

# Check users
SELECT id, email FROM "User";

# Check entitlements
SELECT "userId", "planSlug", status, "validUntil" FROM "Entitlement";

# Check if any sessions exist
\! ls -la sessions/
```

### Check Application Logs
```bash
# All logs
docker-compose logs -f

# Web application only
docker-compose logs -f web

# Last 100 lines
docker-compose logs --tail=100 web

# Filter for WhatsApp events
docker-compose logs -f web | grep -i whatsapp

# Filter for errors
docker-compose logs -f web | grep -i error
```

### Check Running Services
```bash
# Container status
docker-compose ps

# Resource usage
docker stats

# Network connectivity
docker-compose exec web curl -I https://web.whatsapp.com
```

---

## Step-by-Step Testing Procedure

### 1. Verify Database is Running
```bash
docker-compose ps db
# Should show "Up" status

docker-compose exec db pg_isready -U app
# Should return "accepting connections"
```

### 2. Verify Application is Running
```bash
curl http://localhost:3000/api/health
# Should return {"ok":true,...}
```

### 3. Create Test User (if needed)
```bash
# Register via UI or create directly in database
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

### 4. Add Active Entitlement
```bash
docker-compose exec db psql -U app app

# Get user ID
SELECT id, email FROM "User" WHERE email = 'test@example.com';

# Add entitlement (replace USER_ID)
INSERT INTO "Entitlement" ("userId", "planSlug", status, "validUntil", "createdAt", "updatedAt")
VALUES ('USER_ID', 'premium', 'active', NOW() + INTERVAL '30 days', NOW(), NOW())
ON CONFLICT ("userId") DO UPDATE SET status = 'active', "validUntil" = NOW() + INTERVAL '30 days';
```

### 5. Test WhatsApp Connection Flow

**Option A: Via Dashboard UI**
1. Open http://localhost:3000/dashboard
2. Login with your credentials
3. Click "Connect / refresh QR"
4. Wait 5 seconds
5. QR code should appear

**Option B: Via API**
```bash
# Login to get session cookie
SESSION_COOKIE=$(curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' \
  -c - | grep next-auth.session-token | awk '{print $NF}')

# Connect
curl -X POST http://localhost:3000/api/whatsapp/connect \
  -H "Cookie: next-auth.session-token=$SESSION_COOKIE"

# Get QR (wait 5 seconds first)
sleep 5
curl http://localhost:3000/api/whatsapp/qr \
  -H "Cookie: next-auth.session-token=$SESSION_COOKIE"
```

### 6. Monitor Logs During Connection
```bash
# In separate terminal, watch logs
docker-compose logs -f web | grep -E "QR|WhatsApp|connect|error"
```

Expected log sequence:
```
Connecting to WhatsApp...
Connection initiated
QR code received - waiting for scan...
✅ Connected to WhatsApp
```

---

## Quick Fixes

### Reset Everything
```bash
# Stop all services
docker-compose down

# Remove WhatsApp sessions
rm -rf sessions/*

# Remove media cache
rm -rf wa-media-cache/*

# Start fresh
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Force Recreate Database
```bash
# WARNING: This deletes all data!
docker-compose down -v
docker-compose up -d
docker-compose exec web npx prisma migrate deploy
```

### Clear Single User Session
```bash
# Get user ID from database
docker-compose exec db psql -U app app -c "SELECT id FROM \"User\" WHERE email = 'user@example.com';"

# Remove session directory (replace USER_ID)
rm -rf sessions/USER_ID_*
```

---

## Common Error Messages and Meanings

| Error | Meaning | Solution |
|-------|---------|----------|
| `Unauthorized` (401) | Not logged in | Login via dashboard |
| `Active subscription required` (403) | No active entitlement | Add entitlement to database |
| `QR unavailable` | Service not created yet | Click Connect button first |
| `Could not start WhatsApp connection` | Connection failed | Check logs, internet, WhatsApp servers |
| `Too many connect attempts` (429) | Rate limited | Wait 60 seconds |
| `WebSocket connection failed` | Cannot reach WhatsApp | Check firewall, internet |
| `Bad session` | Corrupted session | Clear session directory |

---

## Advanced Debugging

### Enable Detailed Logging

Edit `.env`:
```bash
LOG_LEVEL=debug
```

Restart:
```bash
docker-compose restart web
```

### Check WebSocket Connectivity
```bash
# From inside container
docker-compose exec web node -e "
const WebSocket = require('ws');
const ws = new WebSocket('wss://web.whatsapp.com/ws');
ws.on('open', () => { console.log('✅ Can connect to WhatsApp'); process.exit(0); });
ws.on('error', (err) => { console.error('❌ Cannot connect:', err.message); process.exit(1); });
setTimeout(() => { console.log('❌ Timeout'); process.exit(1); }, 10000);
"
```

### Inspect Session Files
```bash
# List sessions
ls -la sessions/

# Check session structure (replace USER_ID)
ls -la sessions/USER_ID_*/

# Session files should include:
# - creds.json (credentials)
# - app-state-sync-key-*.json (sync keys)
```

---

## Contact Support

If none of these solutions work, provide the following information:

1. **Health Check Output:**
   ```bash
   curl http://localhost:3000/api/health?detailed=true
   ```

2. **Recent Logs (last 100 lines):**
   ```bash
   docker-compose logs --tail=100 web
   ```

3. **Container Status:**
   ```bash
   docker-compose ps
   ```

4. **Environment Info:**
   - Operating System
   - Docker version: `docker --version`
   - Docker Compose version: `docker-compose --version`
   - Internet connectivity status
   - Firewall configuration

5. **Exact Error Message:**
   - Screenshot or copy-paste of error
   - Browser console output (F12 → Console tab)
   - Network tab showing failed requests
