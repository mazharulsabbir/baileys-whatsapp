# Repository instructions: `odoo-modules` (Odoo ChatRoom connector)

Use this file when editing or extending the Odoo addons under `odoo-modules/`.

- **`whatsapp_saas_bridge`** — Connects Odoo to **this repo’s** Next.js SaaS (`/api/integration/v1/*`, signed webhooks). See [whatsapp_saas_bridge/AGENTS.md](whatsapp_saas_bridge/AGENTS.md).
- **`whatsapp_connector`** (Acrux ChatRoom BASE) — Talks to **Acruxlab** hosted APIs, not the Baileys server in the repo root.

## Layout

| Path | Role |
|------|------|
| `whatsapp_saas_bridge/` | Odoo 17 bridge to this project’s integration API and inbound `/saas_whatsapp/hook/<token>`. |
| `whatsapp_connector/__manifest__.py` | Module metadata (Odoo 17, depends: `bus`, `sales_team`, `product`). |
| `whatsapp_connector/controllers/main.py` | HTTP controllers: inbound webhook, attachment URLs, upload endpoint. |
| `whatsapp_connector/models/Connector.py` | **`acrux.chat.connector`**: outbound `ca_request()`, endpoint URLs, action map, error handling. |
| `whatsapp_connector/models/Message.py` | Outbound **send** payload construction (`message_parse` → JSON body). |
| `whatsapp_connector/models/Conversation.py` | Inbound parsing (`parse_message_receive`, events, read receipts, delete). |
| `whatsapp_connector/models/WorkQueue.py` | Async processing of webhook payloads via cron. |

## Integration model

1. **Odoo → Acrux API**: `Connector.ca_request(action, data=..., params=...)` uses `requests` with JSON when needed. The remote base URL is **`connector.endpoint`** (defaults below). **Authentication is header-based**, not a classic Bearer token in body.

2. **Acrux gateway → Odoo**: The gateway POSTs JSON to Odoo at **`{odoo_url}/acrux_webhook/whatsapp_connector/{uuid}`** where `uuid` is the connector’s **Account ID** (`connector.uuid`). The controller enqueues work items; cron drains the queue.

Configure **`odoo_url`** to a public HTTPS base (not `localhost`) so the gateway can reach Odoo.

## Outbound API (`ca_request`)

### URL and HTTP verb

- **Non–Facebook-style connectors** (`apichat.io`, `gupshup`, etc.): one base **`endpoint`** string; the HTTP method is chosen from the **action** name (see table). The path component in `get_api_url` is the fixed base only for these connectors (see `Connector.get_api_url`).
- **Facebook / Instagram / Waba Extern** (`connector_type` in `facebook`, `instagram`, `waba_extern`): **`endpoint`** is a per-product base, e.g. `https://social.acruxlab.net/prod/v1/fb`, `/in`, or `/wa_ext`. Actions are mapped to path segments (`get_facebook_path`), e.g. `send` → `sendMessage`.

Default **`endpoint`** values (from `Connector._onchange_connector_type` / defaults):

- WhatsApp-style: `https://api.acruxlab.net/prod/v2/odoo`
- Facebook: `https://social.acruxlab.net/prod/v1/fb`
- Instagram: `https://social.acruxlab.net/prod/v1/in`
- Waba Extern: `https://social.acruxlab.net/prod/v1/wa_ext`

Free test init forces `https://api.acruxlab.net/test/v2/odoo` (see `init_free_test`).

### Request headers (all outbound calls)

From `get_headers(path)`:

| Header | Value |
|--------|--------|
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |
| `token` | Connector `token` |
| `client_id` | Connector `uuid` (Account ID) |
| `action` | The action name (e.g. `send`, `status_get`, `config_set`) — used by the Acrux API to route the request |

POST bodies are JSON-encoded in the **`data`** argument when present.

### Actions and HTTP methods (`get_actions` / `get_facebook_actions`)

**Standard (non-Facebook owner) actions:**

| Action | Method | Typical use |
|--------|--------|-------------|
| `send` | POST | Outbound chat message (see Message payloads). |
| `msg_set_read` | POST | Mark messages read (`data` varies by connector). |
| `config_get` | GET | Read remote config. |
| `config_set` | POST | Push webhook + company **info** (`ca_set_settings`). |
| `status_get` | GET | Session / QR / connection status. |
| `status_logout` | POST | Logout; body forced to `{}` in `hook_request_args`. |
| `contact_get` | GET | Params e.g. `chatId` — profile/image for a chat. |
| `contact_get_all` | GET | Returns `dialogs` list for chat list sync. |
| `init_free_test` | POST | Provisions trial credentials; body includes company info + `tz`. |
| `whatsapp_number_get` | GET | Query params `numbers` (comma-separated IDs). |
| `template_get` | GET | WABA template sync. |
| `opt_in` | POST | (Gupshup opt-in; mostly commented in UI flow.) |
| `delete_message` | DELETE | Query params only (see below). |

**Facebook-style mapping** renames paths (`get_facebook_path`), e.g. `config_set`→`config`, `contact_get`→`contact`, `send`→`sendMessage`, `msg_set_read`→`readChat` (or `None` for Instagram read).

### Response handling

- **200**: JSON parsed; business logic uses keys like `msg_id`, `status`, `dialogs`, `numbers`, etc.
- **202 / 204 / 400 / 403 / 404 / 500**: `get_request_error_message` maps to user-facing `ValidationError` using JSON `error` when present.
- Facebook owner branch (`is_owner_facebook`) treats **200** JSON differently and may surface redirect URLs for OAuth-style flows in `ca_get_status`.

### Notable request/response bodies (outbound)

**`config_set`** — `data`:

```json
{
  "webhook": "<odoo_base>/acrux_webhook/whatsapp_connector/<uuid>",
  "info": {
    "odoo_url": "...",
    "lang": "...",
    "phone": "...",
    "website": "...",
    "currency": "...",
    "country": "...",
    "name": "...",
    "email": "..."
  }
}
```

**`send`** — JSON body from `acrux.chat.message.message_parse()` (POST). Shape depends on `ttype`:

- **text**: `{ "type": "text", "text": "...", "to": "<number>", "chat_type": "...", "id": "<message_id>" }` plus optional `quote_msg_id`, `messaging_type` for FB/IG.
- **image / video / file**: `{ "type": "<ttype>", "text": "...", "filename": "...", "url": "<public_odoo_url>", ... }` — URLs point at Odoo (`get_url_from_attachment` / `get_url_from_model_field`).
- **audio**: `{ "type": "audio", "url": "<...>" }`.
- **location**: `{ "type": "location", "address": "...", "latitude": "...", "longitude": "..." }`.
- Templates/buttons/lists add `template_id`, `params`, `template_lang`, `buttons`, `list`, etc. per connector rules in `Message.py`.

**`send` response** (expected): `{ "msg_id": "<external_id>" }` (code reads `msg_id`).

**`contact_get`** — query params: `chatId` formatted as e.g. `{number}@c.us` / `@l.us` / `@g.us` for apichat.io; FB/IG uses `chatId` = conversation number. Response includes `name`, `image` URL.

**`msg_set_read`** — JSON body examples:

- apichat.io: `{ "phone": "<number>", "chat_type": "<normal|private|group>" }`
- Facebook: `{ "phone": "<number>" }` when applicable
- Waba extern: `{ "message_ids": ["..."] }`

**`whatsapp_number_get`** — query: `numbers=<id1>,<id2>,...` (max 20). Response includes `numbers`, `remain_limit`, `limit`, `date_due`.

**`delete_message`** — no JSON body; **query params**: `number`, `msg_id`, `for_me`, `from_me` (string `"true"`/`"false"`).

**`status_get`** — GET, no body; response includes `status` with fields like `acrux_ok`, `acrux_er`, `accountStatus`, `qrCode`, `statusData`.

---

## Inbound: Odoo HTTP routes (`controllers/main.py`)

### `POST /acrux_webhook/whatsapp_connector/<connector_uuid>`

- **`type='json'`** (Odoo JSON-RPC style body parsing).
- **Auth**: `public` (connector matched by `uuid`).
- **Body** must include at least one of **`updates`**, **`events`**, **`messages`** (each an array). Empty payload → **403**.
- Each array element is stored as JSON text on `acrux.chat.work.queue` with `ttype` `in_update`, `in_event`, or `in_message`, then `queue_trigger()` runs the cron processor.

**Logical payload shape** (as consumed after queue processing):

**`messages`** items → `parse_message_receive` expects keys including:

| Field | Meaning |
|-------|---------|
| `type` | `text`, `image`, `audio`, `video`, `file`, `location`, `sticker`, `url`, … |
| `txt` | Message text |
| `id` | External message id (also used to infer `from_me`, private/group via `@l.us` / `@g.us`) |
| `name`, `number`, `filename`, `url`, `time`, `quote_msg_id`, `author`, `metadata` | As present |

**`events`** items → `parse_event_receive` / `new_webhook_event`:

- `type`: `failed` (`msgid`, `txt` reason), `phone-status` (`status`: `connected` / `disconnected`), `opt_update` (Gupshup), `face-status`, `deleted`, etc.

**`updates`** (contact updates) → `parse_contact_receive` ensures `number`; `contact_update` uses `number` + `image_url` for avatar refresh.

### `GET /acrux_webhook/test`

Triggers `acrux.chat.work.queue.queue_trigger()`; returns plain text timestamp (smoke test).

### `GET /web/chatresource/<id>/<access_token>`

Public attachment download by Odoo `ir.binary` + token.

### `GET /web/static/chatresource/<model>/<id>_<hash>/<field>`

Public image stream for allowed models (`acrux_allowed_models()`); `field` must start with `image`.

### `POST /web/binary/upload_attachment_chat`

- **Auth**: `user`.
- **Multipart**: file field `ufile`; optional `is_pending`, `connector_type` (Instagram triggers conversion rules).
- **Response**: JSON `{ "id", "filename", "mimetype", "name", "size", "isAcrux", "accessToken"? }` or `{ "error", "filename" }`.

---

## Editing guidelines for agents

- **`Connector.ca_request`** is the single choke point for outbound HTTP; new remote operations should extend `get_actions`, and if needed `get_facebook_path`, with matching server behavior.
- **Webhook compatibility**: changing `parse_message_receive` / queue processing affects **all** gateways posting to the webhook; keep fields backward-compatible or version gate.
- **Security**: webhook is `auth='public'` and gated by **connector UUID** and non-empty payload; do not weaken those checks.
- **License**: `__manifest__.py` states **OPL-1** and Acruxlab terms; respect that when copying or redistributing.

## Relation to the Node repo

This workspace’s root project is a **Baileys / Next.js** stack. The **`odoo-modules`** tree is an **Odoo addon** for Acrux ChatRoom. Unless you add an explicit bridge in this repo, the Baileys service and this Odoo module are separate integration paths (both may ultimately talk to WhatsApp through different providers).
