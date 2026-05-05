# Repository instructions for AI agents

Use this file together with `.cursor/rules/` when planning or editing code in this repo.

## Product context

**RelayLink** — WhatsApp Web platform built on [Baileys](https://github.com/WhiskeySockets/Baileys). The main abstraction is `WhatsAppService` (`src/services/whatsapp.ts`); use `createWhatsAppService({ tenantId, authBaseDir, ... })` for SaaS tenants. Next.js lives under `app/` with Prisma and SSLCommerz helpers under `lib/` (`lib/whatsapp-registry.ts` holds active sockets). The legacy CLI uses `createDefaultWhatsAppService()` via `src/index.ts`. Commands are handled in `src/handlers/message.handler.ts`; connection logic in `src/handlers/connection.handler.ts`.

## Environment and run

- Copy `.env.example` to `.env` before running.
- `npm install` then `npm run dev` (or `npm run build` && `npm start`).
- Session data is stored under the folder named by `SESSION_NAME` — treat it as secrets on disk; do not commit it.

## Editing guidelines

- Match existing patterns: Pino logger, async handlers, Baileys socket from `getSocket()` when raw access is needed.
- Changing auth, QR/pairing, or reconnect behavior requires careful review of `connect()`, `handleAuthentication()`, and `setupConnectionHandler`.
- New bot features usually belong in `message.handler.ts` or new handlers wired from `whatsapp.ts` event setup.

## Safety and scope

- Respect WhatsApp Terms of Service; avoid automation patterns aimed at spam or mass unsolicited outreach.
- Prefer minimal diffs: only touch files needed for the requested behavior.
