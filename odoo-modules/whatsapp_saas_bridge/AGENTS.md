# WhatsApp SaaS Bridge (Odoo addon)

Odoo **17.0** addon that connects one database company to the **baileys-whatsapp** SaaS app via HTTP integration APIs.

## Setup flow

1. On the SaaS **Dashboard**, generate an **API key** and optional **webhook secret**, set **Webhook URL** to the Odoo URL shown on the connector (`Odoo webhook URL` field).
2. In Odoo, assign users **WhatsApp SaaS / User** (Settings → Users → Access Rights).
3. Create **WhatsApp SaaS → Connectors**: paste **SaaS base URL** (origin only), **API key**, **webhook signing secret** (must match SaaS). Copy **Inbound hook token** path — it is already embedded in **Odoo webhook URL**.

## SaaS HTTP API (called by Odoo)

Base URL: `{saas_base_url}/api/integration/v1`

| Endpoint | Method | Auth |
|----------|--------|------|
| `/messages` | POST | `Authorization: Bearer <api_key>` or `X-Api-Key` |
| `/status` | GET | Same |

### POST `/messages` (text MVP)

Request headers: `Authorization: Bearer <api_key>`, `Content-Type: application/json`

Body:

```json
{
  "to": "491234567890",
  "type": "text",
  "text": "Hello from Odoo"
}
```

`to` may be digits only (national number without `+`) or a full WhatsApp JID.

Success: `200` `{ "ok": true }`. Errors: `401`, `403`, `503` (WhatsApp not connected on SaaS).

### GET `/status`

Response example:

```json
{
  "connected": true,
  "waitingForQr": false,
  "tenantId": "<saas_user_id>"
}
```

## Inbound webhook (SaaS → Odoo)

SaaS POSTs JSON to:

`{web.base.url}/saas_whatsapp/hook/<hook_token>`

Headers:

- `Content-Type: application/json`
- `X-Signature: sha256=<hex>` — HMAC-SHA256 of the **raw** JSON body using the shared **webhook signing secret**.

Body fields (MVP):

```json
{
  "event": "message.received",
  "tenantId": "...",
  "messageId": "...",
  "from": "...",
  "chatId": "...",
  "type": "text",
  "text": "...",
  "senderName": "...",
  "isGroup": false,
  "timestamp": 1234567890
}
```

Odoo verifies the signature, then creates/finds `saas.whatsapp.conversation` by `chatId` and logs `saas.whatsapp.message` (inbound).

## Python dependency

`requests` must be available in the Odoo environment (`pip install requests`).

## Distinction from `whatsapp_connector`

The Acrux **`whatsapp_connector`** addon in `odoo-modules/` targets Acruxlab’s hosted API. This addon targets **this repo’s** Next.js integration routes only.
