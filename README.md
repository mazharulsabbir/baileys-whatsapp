# Baileys WhatsApp Bot

A powerful WhatsApp Web API integration using the [Baileys](https://github.com/WhiskeySockets/Baileys) library. Build WhatsApp bots, send messages, manage groups, and more without browser dependencies.

## Features

- 🔐 **Authentication** - QR Code or Pairing Code login
- 💬 **Messaging** - Send/receive text, images, videos, audio, documents
- 📍 **Location** - Send and receive location messages
- 📊 **Polls** - Create and manage polls
- 👥 **Groups** - Full group management (create, add/remove participants, settings)
- 🤖 **Bot Ready** - Built-in command handler with customizable prefix
- 🔄 **Auto-reconnect** - Automatic reconnection on disconnect
- 💾 **Session Persistence** - Save authentication to avoid re-scanning QR
- 📦 **Multi-device Support** - Full WhatsApp multi-device protocol support
- 🎯 **Mentions** - Mention users in messages
- ✏️ **Edit/Delete** - Edit and delete messages
- ⚡ **Presence** - Show typing, recording, online status
- 📥 **Media Download** - Download media from messages

### Feature list review

The bullets above match the public surface of `WhatsAppService` (`src/services/whatsapp.ts`): connect/disconnect, messaging (text, image, video, audio, document), location, contact, poll, reaction, reply/edit/delete helpers, and presence updates. Command handling (`!ping`, `!help`, `!info`) and auto-reconnect live under `src/handlers/`. Examples that use `socket.ev` and `downloadMediaMessage` are illustrative Baileys patterns—wire them where you have socket access (for example via `getSocket()` after connect).

## Cursor IDE: agents, tools, init, and best practices

Use Cursor in this repo for faster, more accurate edits by giving the AI stable context and clear tasks.

### Initialization

1. Open the **folder** `baileys-whatsapp` as the workspace (not a single file).
2. Run `npm install` and copy `.env.example` → `.env`.
3. Optional: add a **`.cursorignore`** (this repo includes one) so large dirs like `node_modules/` and session folders are excluded from indexing.
4. Read **`AGENTS.md`** and **`.cursor/rules/`** once—they encode stack, file layout, and boundaries for WhatsApp/Baileys work.

### Agents and modes

| Capability | Use when |
|------------|----------|
| **Chat / Composer** | Quick questions, single-file edits, short explanations. |
| **Agent mode** | Multi-file changes, refactors, running terminal commands (`npm run build`, tests), searching the repo. |
| **Plan / Ask** (if available in your Cursor version) | Large or ambiguous changes—agree on approach before long edits. |

Pin context with **`@`** (@ file, @ folder, @ codebase, @ docs) so answers reference this project instead of generic Baileys snippets.

### Tools the agent can use

- **Codebase search and file reads** — finding handlers and types across `src/`.
- **Terminal** — install deps, build, run `npm run dev`; confirm behavior after edits.
- **Linter / diagnostics** — fix TypeScript issues before finishing.
- **MCP tools** — optional; enable in Cursor settings if you use external integrations (e.g. Dart/Flutter MCP). Check each server’s schema before calling tools.

### Best practices for better results

- **Be specific:** name files (`src/handlers/message.handler.ts`), behaviors, and acceptance criteria (“must not break reconnect”).
- **Keep rules lean:** project rules live in `.cursor/rules/*.mdc`; avoid huge pasted blobs in every prompt—update rules when conventions change.
- **Small tasks:** split large features into steps (types → service method → handler → README note).
- **Verify:** run `npm run build` after substantive TypeScript changes.
- **Secrets:** never ask the agent to embed real phone numbers or session paths from production in code or docs.

## Requirements

- Node.js 20.0.0 or higher
- WhatsApp account (for authentication)

## Installation

```bash
# Clone or navigate to the project
cd baileys-whatsapp

# Install dependencies
npm install
```

### SaaS stack (Docker Compose)

PostgreSQL + Next.js run together; `docker-compose.yml` sets `DATABASE_URL` to host **`db`** and `WHATSAPP_SESSION_ROOT` to **`/data/sessions`** inside the container (your `.env` can keep `localhost` for local-only runs).

```bash
cp .env.example .env
# Set AUTH_SECRET, SSLCommerz sandbox credentials, etc.

docker compose up --build
# App: http://localhost:3000 — migrations run on container start (see docker-entrypoint.sh).
```

### Odoo integration (SaaS API + webhooks)

- **SaaS app:** With an active subscription, open **Dashboard** → **Odoo / API integration** to generate an **API key**, set **webhook URL** (your Odoo endpoint), and rotate the **webhook secret** as needed.
- **HTTP API:** `POST {APP_URL}/api/integration/v1/messages` with `Authorization: Bearer <api_key>` and JSON body `{ "to": "E164_OR_JID", "type": "text", "text": "…" }`. `GET .../api/integration/v1/status` returns connection state.
- **Inbound:** The server POSTs JSON to your configured URL with `X-Signature: sha256=…` (HMAC-SHA256 of the raw body). See [odoo-modules/whatsapp_saas_bridge/AGENTS.md](odoo-modules/whatsapp_saas_bridge/AGENTS.md).
- **Env:** `NEXT_PUBLIC_APP_URL` (or `AUTH_URL`) should be the public origin users and Odoo can reach; keep `DATABASE_URL` and `WHATSAPP_SESSION_ROOT` consistent in Docker (see `.env.example`).

## Configuration

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit `.env` to configure your settings:

```env
# Session name (folder where auth data is stored)
SESSION_NAME=whatsapp_session

# Authentication method: 'qr' or 'pairing'
AUTH_METHOD=qr

# For pairing code authentication, enter your phone number
PHONE_NUMBER=1234567890

# Bot command prefix
COMMAND_PREFIX=!

# Log level: fatal | error | warn | info | debug | trace | silent
LOG_LEVEL=info
```

## Usage

### Start the Bot

```bash
# Development (build and run)
npm run dev

# Or build first, then run
npm run build
npm start

# If you're having connection issues, clear the session first:
npm run dev -- --clear-session
```

### Authentication

**QR Code Method:**
1. Set `AUTH_METHOD=qr` in `.env`
2. Run the bot
3. Scan the QR code with WhatsApp mobile app (Linked Devices)

**Pairing Code Method:**
1. Set `AUTH_METHOD=pairing` in `.env`
2. Enter your phone number in `PHONE_NUMBER` (with country code, no + sign)
3. Run the bot
4. Enter the pairing code shown in terminal on your WhatsApp mobile app

### Basic Commands

Once connected, the bot responds to these commands (in groups or private chats):

- `!ping` - Check if bot is online
- `!help` - Show help message
- `!info` - Show bot information

## Programmatic Usage

You can also use the WhatsApp service in your own code:

```typescript
import { whatsappService } from './services/whatsapp';

// Connect
await whatsappService.connect();

// Send text message
await whatsappService.sendMessage('1234567890@s.whatsapp.net', 'Hello!');

// Send image
await whatsappService.sendImage(
  '1234567890@s.whatsapp.net',
  './image.jpg',
  'Check this out!'
);

// Send poll
await whatsappService.sendPoll(
  '1234567890@s.whatsapp.net',
  'Favorite color?',
  ['Red', 'Blue', 'Green']
);

// Send reaction
await whatsappService.sendReaction(
  '1234567890@s.whatsapp.net',
  messageKey,
  '👍'
);

// Disconnect
await whatsappService.disconnect();
```

## Project Structure

```
baileys-whatsapp/
├── src/
│   ├── config/           # Configuration management
│   │   └── index.ts
│   ├── services/         # WhatsApp service layer
│   │   └── whatsapp.ts
│   ├── handlers/         # Event handlers
│   │   ├── connection.handler.ts
│   │   └── message.handler.ts
│   ├── utils/            # Helper utilities
│   │   └── helpers.ts
│   ├── types/            # TypeScript type definitions
│   └── index.ts          # Main entry point
├── .env.example          # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Available Methods

### WhatsAppService

| Method | Description |
|--------|-------------|
| `connect()` | Initialize and connect to WhatsApp |
| `disconnect()` | Disconnect from WhatsApp |
| `sendMessage(jid, text, options)` | Send text message |
| `sendImage(jid, image, caption)` | Send image message |
| `sendVideo(jid, video, caption)` | Send video message |
| `sendAudio(jid, audio, ptt)` | Send audio message |
| `sendDocument(jid, doc, fileName, caption)` | Send document |
| `sendLocation(jid, lat, lng, name)` | Send location |
| `sendContact(jid, phone, name)` | Send contact |
| `sendPoll(jid, name, values, multiple)` | Send poll |
| `sendReaction(jid, key, emoji)` | React to message |
| `reply(jid, text, quoted)` | Reply to message |
| `deleteMessage(jid, key)` | Delete message |
| `editMessage(jid, key, text)` | Edit message |
| `sendPresenceUpdate(type, jid)` | Update presence |
| `getSocket()` | Get socket instance |
| `isConnected()` | Check connection status |

## JID Format

- **User:** `1234567890@s.whatsapp.net` (phone number with country code)
- **Group:** `123456789@g.us` (group ID)

## Examples

### Send a Message to a Group

```typescript
const groupId = '123456789@g.us';
await whatsappService.sendMessage(groupId, 'Hello everyone!');
```

### Reply to a Message

```typescript
socket.ev.on('messages.upsert', async ({ messages }) => {
  const message = messages[0];
  if (message.message?.conversation === 'hello') {
    await whatsappService.reply(
      message.key.remoteJid!,
      'Hi there!',
      message
    );
  }
});
```

### Download Media

```typescript
import { downloadMediaMessage } from '@whiskeysockets/baileys';

socket.ev.on('messages.upsert', async ({ messages }) => {
  const message = messages[0];
  
  if (message.message?.imageMessage) {
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      { logger, reuploadRequest: socket.updateMediaMessage }
    );
    // Save buffer to file
  }
});
```

## Troubleshooting

### WebSocket Connection Error
If you see `WebSocket Error` or connection errors:
- **Check internet connection** - Ensure you have stable internet access
- **Firewall/Proxy** - Make sure your firewall isn't blocking WebSocket connections to WhatsApp servers
- **WhatsApp server status** - WhatsApp servers may be temporarily unavailable; wait a few minutes and try again
- **Clear session** - Delete the `whatsapp_session/` folder and re-authenticate
- **Update Baileys** - Run `npm update @whiskeysockets/baileys` to get the latest version

### QR Code Not Showing
- Make sure `PRINT_QR=true` in `.env`
- Check terminal for QR code output
- Wait a few seconds after starting for QR to generate

### Connection Lost
- Check your internet connection
- Session may have expired - delete `whatsapp_session/` folder and re-scan QR
- Check if you're logged in on another device (WhatsApp allows only one web session per account)

### Pairing Code Not Working
- Ensure phone number includes country code (no + sign)
- Example: `1234567890` for US number
- Make sure `AUTH_METHOD=pairing` in `.env`

### Messages Not Sending
- Verify the JID format is correct (e.g., `1234567890@s.whatsapp.net`)
- Check if bot is connected (`isConnected()`)
- Ensure the recipient exists on WhatsApp

### Common Error Codes
- **428 (Precondition Failed)** - Clear session folder and re-authenticate
- **401 (Unauthorized)** - Session expired, re-scan QR code
- **503 (Service Unavailable)** - WhatsApp servers temporarily down, wait and retry

## Disclaimer

This project is not affiliated with, authorized by, or connected with WhatsApp. Use responsibly and adhere to WhatsApp's Terms of Service. Do not use for spam or unauthorized bulk messaging.

## License

ISC

## Resources

- [Baileys GitHub](https://github.com/WhiskeySockets/Baileys)
- [Baileys Documentation](https://baileys.wiki)
- [WhiskeySockets Discord](https://discord.gg/whiskeysockets)
