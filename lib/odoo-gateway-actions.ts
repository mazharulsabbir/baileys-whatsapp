import { NextResponse } from 'next/server';
import type { proto, WASocket } from '@whiskeysockets/baileys';
import { getExistingService } from '@/lib/whatsapp-registry';
import type { WhatsAppService } from '@/src/services/whatsapp';
import { normalizeToJid } from '@/lib/jid';

/**
 * Parse Odoo `msgid`: either composite `true|false_<waId>_<remoteJid>` or plain Baileys id (use `number` for JID).
 */
export function parseMsgIdForDelete(
  msgIdParam: string,
  numberDigits: string,
  fromMeFromQuery: boolean
): { jid: string; key: proto.IMessageKey } {
  const m = /^(true|false)_([^_]+)_(.+)$/.exec(msgIdParam);
  if (m) {
    const fromMe = m[1] === 'true';
    return {
      jid: m[3]!,
      key: { remoteJid: m[3]!, id: m[2]!, fromMe },
    };
  }
  const jid = normalizeToJid(numberDigits);
  return {
    jid,
    key: { remoteJid: jid, id: msgIdParam, fromMe: fromMeFromQuery },
  };
}

export async function handleMsgSetRead(
  userId: string,
  body: unknown
): Promise<NextResponse> {
  // Odoo already marks messages read in DB before calling; WA read receipt needs per-message keys we don't have here.
  void body;
  return NextResponse.json({});
}

export async function handleContactGetAll(_userId: string): Promise<NextResponse> {
  // Shape matches Connector.ca_get_chat_list; Baileys chat-store sync not wired here yet — sync happens via inbound webhook messages.
  return NextResponse.json({ dialogs: [] as { id: string; name: string; image: string }[] });
}

export async function handleContactGet(
  userId: string,
  searchParams: URLSearchParams
): Promise<NextResponse> {
  const chatId = searchParams.get('chatId')?.trim() ?? '';
  if (!chatId) {
    return NextResponse.json({ error: 'chatId required' }, { status: 400 });
  }

  const svc = getExistingService(userId);
  const socket = svc?.getSocket() as
    | (WASocket & {
        profilePictureUrl?: (
          jid: string,
          type?: 'preview' | 'image',
          timeoutMs?: number
        ) => Promise<string | undefined>;
      })
    | null;
  if (!socket?.profilePictureUrl) {
    return NextResponse.json({ name: '', image: '' });
  }

  const jid = chatId.includes('@') ? chatId : normalizeToJid(chatId);
  const image = (await socket.profilePictureUrl(jid, 'image').catch(() => undefined)) ?? '';
  const name = jid.split('@')[0] ?? '';
  return NextResponse.json({ name, image });
}

export async function handleWhatsappNumberGet(
  userId: string,
  searchParams: URLSearchParams
): Promise<NextResponse> {
  const raw = searchParams.get('numbers')?.trim() ?? '';
  const parts = raw
    .split(',')
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean)
    .slice(0, 20);

  const svc = getExistingService(userId);
  const socket = svc?.getSocket() as
    | (WASocket & {
        onWhatsApp?: (
          ...phones: string[]
        ) => Promise<{ jid: string; exists: boolean }[] | undefined>;
      })
    | null;

  const numbers: Record<
    string,
    { valid: boolean; same: boolean; number: string }
  > = {};

  if (socket?.onWhatsApp && parts.length > 0) {
    const res = await socket.onWhatsApp(...parts).catch(() => undefined);
    if (Array.isArray(res)) {
      for (const row of res) {
        if (!row?.jid) continue;
        const id = row.jid.split('@')[0]?.replace(/\D/g, '') ?? '';
        if (!id) continue;
        const wa = row.jid.split('@')[0] ?? id;
        numbers[id] = {
          valid: Boolean(row.exists),
          same: true,
          number: wa,
        };
      }
    }
  }

  return NextResponse.json({
    numbers,
    remain_limit: 999999,
    limit: 999999,
    date_due: false,
  });
}

export async function handleTemplateGet(): Promise<NextResponse> {
  // WABA templates not used on Baileys Web; empty payload keeps Odoo template sync from crashing if invoked.
  return NextResponse.json({ waba_templates: [], templates: [] });
}

export async function handleDeleteMessage(
  userId: string,
  searchParams: URLSearchParams
): Promise<NextResponse> {
  const number = searchParams.get('number')?.trim() ?? '';
  const msgIdParam = searchParams.get('msg_id')?.trim() ?? '';
  const fromMe = searchParams.get('from_me') === 'true';

  if (!number || !msgIdParam) {
    return NextResponse.json({ error: 'number and msg_id required' }, { status: 400 });
  }

  let svc: WhatsAppService | undefined;
  try {
    const { ensureConnecting } = await import('@/lib/whatsapp-registry');
    await ensureConnecting(userId);
    svc = getExistingService(userId);
  } catch {
    return NextResponse.json({ error: 'Could not initialize WhatsApp client' }, { status: 500 });
  }

  if (!svc?.isConnected()) {
    return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 503 });
  }

  try {
    const { jid, key } = parseMsgIdForDelete(msgIdParam, number, fromMe);
    await svc.deleteMessage(jid, key);
    return NextResponse.json({});
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Delete failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
