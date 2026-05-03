# Odoo ChatRoom Compliance - Implementation Task Plan
## Baileys WhatsApp Integration

**Version**: 1.0
**Date**: 2026-05-03
**Status**: Ready for implementation
**Estimated Total Effort**: 18-28 hours

---

## Table of Contents
1. [Priority 1 Tasks (Critical)](#priority-1-tasks-critical)
2. [Priority 2 Tasks (Enhancements)](#priority-2-tasks-enhancements)
3. [Implementation Guidelines](#implementation-guidelines)
4. [Testing Strategy](#testing-strategy)
5. [Verification Checklist](#verification-checklist)
6. [Rollout Plan](#rollout-plan)

---

## Priority 1 Tasks (Critical)

### Task 1.1: Implement Failed Message Event Handling
**Impact**: High - Odoo needs to know when messages fail
**Effort**: 3-4 hours
**Files**: `src/services/whatsapp.ts`, `lib/odoo-webhook-delivery.ts`

#### Current Behavior
```typescript
// src/services/whatsapp.ts:242-261
async sendMessage(jid: string, text: string, options?): Promise<string | undefined> {
  const result = await this.socket.sendMessage(jid, message);
  return result?.key?.id ?? undefined;
  // ❌ No error handling - failures not reported
}
```

#### Required Implementation

**Step 1**: Add failed event delivery function

File: `lib/odoo-webhook-delivery.ts`

```typescript
/**
 * Deliver failed message event to Odoo
 * Odoo expects: { type: 'failed', msgid, reason }
 */
export function deliverOdooFailedMessage(
  userId: string,
  msgid: string,
  reason: string
): void {
  void (async () => {
    await deliverToOdooWithDlq(userId, {
      messages: [],
      updates: [],
      events: [{
        type: 'failed' as const,
        msgid,
        reason: reason || 'Unknown error'
      }],
    });
  })();
}
```

**Step 2**: Update WhatsAppService to catch send failures

File: `src/services/whatsapp.ts:242-261`

```typescript
import { deliverOdooFailedMessage } from '@/lib/odoo-webhook-delivery';
import { buildCompositeMsgId } from '@/lib/odoo-acrux-mapper';

async sendMessage(
  jid: string,
  text: string,
  options?: {
    quoted?: proto.IWebMessageInfo;
    mentions?: string[];
  }
): Promise<string | undefined> {
  if (!this.socket) {
    throw new Error('Socket not initialized. Call connect() first.');
  }

  const message: any = {
    text,
    mentions: options?.mentions
  };

  if (options?.quoted) {
    message.quoted = options.quoted;
  }

  try {
    const result = await this.socket.sendMessage(jid, message);
    return result?.key?.id ?? undefined;
  } catch (error) {
    // Build composite message ID for Odoo correlation
    const msgid = buildCompositeMsgId({
      id: Date.now().toString(), // Temporary ID since send failed
      remoteJid: jid,
      fromMe: true
    });

    const reason = error instanceof Error
      ? error.message
      : 'Failed to send message';

    // Report failure to Odoo
    if (this.opts.tenantId) {
      deliverOdooFailedMessage(this.opts.tenantId, msgid, reason);
    }

    this.logger.error({ error, jid, text }, 'Failed to send message');
    throw error; // Re-throw for caller handling
  }
}
```

**Step 3**: Apply same pattern to all send methods

Apply the same try-catch pattern to:
- `sendImage()` (line 266-275)
- `sendVideo()` (line 280-289)
- `sendAudio()` (line 294-304)
- `sendDocument()` (line 309-320)
- `sendLocation()` (line 325-337)
- `sendContact()` (line 342-356)
- `sendPoll()` (line 361-373)

#### Testing
```typescript
// Test case 1: Send to invalid JID
await service.sendMessage('invalid_jid', 'test');
// Expected: deliverOdooFailedMessage() called with reason

// Test case 2: Network failure
// Mock socket.sendMessage() to throw error
// Expected: Webhook POSTed with { type: 'failed', msgid, reason }

// Test case 3: Verify Odoo receives event
// Check Odoo logs: "Message event: failed"
// Verify message marked as failed in UI
```

---

### Task 1.2: Extract Quoted Message Support
**Impact**: Medium - Users frequently reply to messages
**Effort**: 2 hours
**Files**: `lib/odoo-acrux-mapper.ts`

#### Current Behavior
```typescript
// Quoted messages not extracted
// Odoo shows replies without context
```

#### Required Implementation

File: `lib/odoo-acrux-mapper.ts:91-132`

```typescript
export function waMessageToAcuxInbound(message: WAMessage): Record<string, unknown> {
  const chatId = message.key.remoteJid ?? '';
  const id = buildCompositeMsgId({
    id: message.key.id,
    remoteJid: message.key.remoteJid,
    fromMe: message.key.fromMe ?? false,
  });

  const rawType = getMessageType(message);
  const content = extractMessageContent(message);
  let txt = (content ?? '').trim();
  if (!txt) {
    txt = MEDIA_FALLBACK[rawType] ?? MEDIA_FALLBACK.unknown;
  }

  const number = jidToOdooNumber(chatId);
  const ts = tsToNumber(message.messageTimestamp);
  const timeSec = /* ... */;

  const row: Record<string, unknown> = {
    type: 'text',
    txt,
    id,
    number,
    name: message.pushName ?? '',
    filename: '',
    url: '',
    time: timeSec,
  };

  const isGroup = Boolean(chatId && isJidGroup(chatId));
  if (isGroup && message.key.participant) {
    row.author = message.key.participant;
  }

  // ✅ ADD: Extract quoted message ID
  const quotedMsgId = extractQuotedMessageId(message);
  if (quotedMsgId) {
    row.quote_msg_id = quotedMsgId;
  }

  return row;
}

/**
 * Extract quoted message stanza ID from context info
 */
function extractQuotedMessageId(message: WAMessage): string | null {
  // Check extended text message (most common)
  const extQuote = message.message?.extendedTextMessage?.contextInfo?.stanzaId;
  if (extQuote) return extQuote;

  // Check image message with caption
  const imgQuote = message.message?.imageMessage?.contextInfo?.stanzaId;
  if (imgQuote) return imgQuote;

  // Check video message with caption
  const vidQuote = message.message?.videoMessage?.contextInfo?.stanzaId;
  if (vidQuote) return vidQuote;

  // Check document message
  const docQuote = message.message?.documentMessage?.contextInfo?.stanzaId;
  if (docQuote) return docQuote;

  return null;
}
```

#### Odoo Integration

Odoo processes quoted messages like this:

```python
# models/Conversation.py:424-430
if data['quote_msg_id']:
    message_obj = AcruxChatMessages.search([
        ('contact_id', '=', message_id.contact_id.id),
        ('msgid', '=', data['quote_msg_id'])
    ], limit=1)
    if message_obj:
        message_id.write({'quote_id': message_obj.id})
```

#### Testing
```typescript
// Test case 1: Reply to a text message
// 1. Send message A
// 2. Reply to message A with message B
// 3. Verify webhook contains: quote_msg_id = message A's stanzaId
// 4. Check Odoo UI shows quoted message context

// Test case 2: Reply to image with caption
// Same flow but with image message
// Verify contextInfo extracted from imageMessage

// Test case 3: No quote
// Regular message should not have quote_msg_id field
```

---

### Task 1.3: Add Private Conversation Detection
**Impact**: Low - Edge case for business accounts
**Effort**: 30 minutes
**Files**: `lib/odoo-acrux-mapper.ts`

#### Current Behavior
```typescript
// Only 'normal' and 'group' detected
// @l.us JIDs treated as 'normal'
```

#### Required Implementation

File: `lib/odoo-acrux-mapper.ts:91-132`

```typescript
export function waMessageToAcuxInbound(message: WAMessage): Record<string, unknown> {
  const chatId = message.key.remoteJid ?? '';
  // ... existing code ...

  const row: Record<string, unknown> = {
    type: 'text',
    txt,
    id,
    number,
    name: message.pushName ?? '',
    filename: '',
    url: '',
    time: timeSec,
  };

  // ✅ ADD: Detect conversation type from JID suffix
  const convType = detectConversationType(chatId);
  if (convType !== 'normal') {
    // Only include if not default
    row.conv_type = convType;
  }

  const isGroup = convType === 'group';
  if (isGroup && message.key.participant) {
    row.author = message.key.participant;
  }

  return row;
}

/**
 * Detect conversation type from WhatsApp JID
 * @returns 'normal' | 'private' | 'group'
 */
function detectConversationType(jid: string): string {
  if (!jid) return 'normal';

  if (jid.endsWith('@g.us')) {
    return 'group';
  } else if (jid.endsWith('@l.us')) {
    return 'private'; // WhatsApp Business / Large account
  } else {
    return 'normal'; // Regular @s.whatsapp.net
  }
}
```

#### Odoo Conversation Types

```python
# models/Conversation.py:33-36
conv_type = fields.Selection([
    ('normal', 'Normal'),      # Individual chat (@s.whatsapp.net)
    ('private', 'Private'),    # Business chat (@l.us)
    ('group', 'Group')         # Group chat (@g.us)
])
```

#### Testing
```typescript
// Test case 1: Normal conversation
// JID: 1234567890@s.whatsapp.net
// Expected: conv_type = 'normal' (or omitted)

// Test case 2: Group conversation
// JID: 120363012345678901@g.us
// Expected: conv_type = 'group', author field present

// Test case 3: Private/business conversation
// JID: 1234567890@l.us
// Expected: conv_type = 'private'
// Verify Odoo UI shows "Private" conversation type
```

---

## Priority 2 Tasks (Enhancements)

### Task 2.1: Implement Structured Contact Messages
**Impact**: Low - Nice to have
**Effort**: 2-3 hours
**Files**: `lib/odoo-acrux-mapper.ts`

#### Current Behavior
```typescript
if (msg.contactMessage) {
  return `Contact: ${msg.contactMessage.displayName}`;
  // Type: 'text' (fallback)
}
```

#### Proposed Implementation

```typescript
function extractMessageContent(message: WAMessage): string | null {
  const msg = message.message;
  if (!msg) return null;

  // ... other types ...

  if (msg.contactMessage) {
    // Keep text fallback for compatibility
    return `Contact: ${msg.contactMessage.displayName}`;
  }
}

// Add separate contact data extraction
function extractContactData(message: WAMessage): Record<string, unknown> | null {
  const msg = message.message?.contactMessage;
  if (!msg) return null;

  return {
    displayName: msg.displayName || '',
    vcard: msg.vcard || '',
  };
}

// Update waMessageToAcuxInbound
export function waMessageToAcuxInbound(message: WAMessage): Record<string, unknown> {
  // ... existing code ...

  const row: Record<string, unknown> = { /* ... */ };

  // Add contact data if present
  const contactData = extractContactData(message);
  if (contactData) {
    row.contact_data = contactData;
  }

  return row;
}
```

#### Testing
- Send contact card via WhatsApp
- Verify `contact_data` field in webhook
- Check Odoo can parse vCard format

---

### Task 2.2: Add Contact Sync (contact_get_all)
**Impact**: Medium - Useful for Odoo UI
**Effort**: 4-5 hours
**Files**: `lib/odoo-gateway-actions.ts`

#### Current Behavior
```typescript
export async function handleContactGetAll(_userId: string): Promise<NextResponse> {
  return NextResponse.json({ dialogs: [] });
  // ❌ Empty response
}
```

#### Proposed Implementation

```typescript
export async function handleContactGetAll(userId: string): Promise<NextResponse> {
  const svc = getExistingService(userId);
  const socket = svc?.getSocket();

  if (!socket) {
    return NextResponse.json({ dialogs: [] });
  }

  try {
    // Get all chats from Baileys store
    const chats = socket.chats?.all() || [];

    const dialogs = await Promise.all(
      chats.slice(0, 100).map(async (chat) => {
        const jid = chat.id;
        const name = chat.name || jid.split('@')[0] || '';

        // Try to get profile picture
        let image = '';
        try {
          const url = await socket.profilePictureUrl?.(jid, 'preview');
          image = url || '';
        } catch {
          // Profile picture not available
        }

        return {
          id: jid.split('@')[0] || '',
          name,
          image
        };
      })
    );

    return NextResponse.json({ dialogs });
  } catch (error) {
    return NextResponse.json({ dialogs: [] });
  }
}
```

#### Testing
- Call `/contact_get_all` endpoint
- Verify returns array of contacts with id, name, image
- Check Odoo can import contact list

---

### Task 2.3: Instagram Format Validation
**Impact**: Low - Instagram-specific
**Effort**: 1-2 hours
**Files**: `src/handlers/message.handler.ts`, `lib/odoo-acrux-mapper.ts`

#### Current Behavior
No format validation - all media types accepted

#### Proposed Implementation

```typescript
// lib/odoo-acrux-mapper.ts

const INSTAGRAM_AUDIO_FORMATS = [
  'audio/x-wav',
  'audio/mp4',
  'audio/wav',
  'audio/wave',
  'audio/aac',
  'audio/x-m4a',
  'audio/m4a'
];

const INSTAGRAM_VIDEO_FORMATS = [
  'video/x-msvideo',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
  'video/avi'
];

function validateInstagramMedia(
  connectorType: string,
  messageType: string,
  mimetype: string
): { valid: boolean; error?: string } {
  if (connectorType !== 'instagram') {
    return { valid: true };
  }

  if (messageType === 'audio') {
    if (!INSTAGRAM_AUDIO_FORMATS.includes(mimetype)) {
      return {
        valid: false,
        error: `Instagram audio format not supported: ${mimetype}`
      };
    }
  } else if (messageType === 'video') {
    if (!INSTAGRAM_VIDEO_FORMATS.includes(mimetype)) {
      return {
        valid: false,
        error: `Instagram video format not supported: ${mimetype}`
      };
    }
  }

  return { valid: true };
}
```

---

## Implementation Guidelines

### Code Style
- **TypeScript**: Follow existing patterns in `lib/` and `src/`
- **Naming**: Use camelCase for functions, PascalCase for types
- **Imports**: Group by external, internal, type imports
- **Comments**: JSDoc for public functions, inline for complex logic

### Error Handling
```typescript
// ✅ Good: Specific error handling
try {
  await socket.sendMessage(jid, message);
} catch (error) {
  if (error instanceof BaileysError) {
    // Handle Baileys-specific error
  } else {
    // Generic error handling
  }
  logger.error({ error, jid }, 'Send failed');
  deliverOdooFailedMessage(userId, msgid, error.message);
}

// ❌ Bad: Silent failures
try {
  await socket.sendMessage(jid, message);
} catch {
  // No logging, no reporting
}
```

### Logging
```typescript
// Use structured logging
logger.info({
  messageId,
  chatId,
  type,
  userId
}, 'Processing inbound message');

// Not just strings
logger.info('Processing message'); // ❌ Less useful
```

### Type Safety
```typescript
// ✅ Define interfaces
interface QuotedMessageInfo {
  msgid: string;
  fromMe: boolean;
  text?: string;
}

// Use proper types
function extractQuoted(msg: WAMessage): QuotedMessageInfo | null {
  // ...
}
```

---

## Testing Strategy

### 1. Unit Tests

#### Test: buildCompositeMsgId
```typescript
test('buildCompositeMsgId formats correctly', () => {
  const id = buildCompositeMsgId({
    id: 'ABC123',
    remoteJid: '1234567890@s.whatsapp.net',
    fromMe: true
  });
  expect(id).toBe('true_ABC123_1234567890@s.whatsapp.net');
});
```

#### Test: extractQuotedMessageId
```typescript
test('extracts quoted message from extendedTextMessage', () => {
  const message = {
    message: {
      extendedTextMessage: {
        text: 'Reply text',
        contextInfo: {
          stanzaId: 'QUOTED_MSG_ID'
        }
      }
    }
  } as WAMessage;

  expect(extractQuotedMessageId(message)).toBe('QUOTED_MSG_ID');
});
```

### 2. Integration Tests

#### Test: Failed message webhook delivery
```typescript
test('failed send triggers webhook event', async () => {
  const mockWebhook = jest.fn();

  // Mock socket to throw error
  socket.sendMessage = jest.fn().mockRejectedValue(new Error('Network error'));

  await expect(
    service.sendMessage('invalid@jid', 'test')
  ).rejects.toThrow();

  // Verify webhook called
  expect(mockWebhook).toHaveBeenCalledWith(
    expect.objectContaining({
      events: expect.arrayContaining([
        expect.objectContaining({
          type: 'failed',
          reason: 'Network error'
        })
      ])
    })
  );
});
```

### 3. E2E Tests

#### Test: Full message flow with Odoo
```bash
# 1. Start Baileys service
npm run dev

# 2. Send WhatsApp message
# Via WhatsApp mobile app → Send to test number

# 3. Verify Odoo received message
curl -X GET "https://odoo.example.com/api/messages?limit=1"
# Expected: Latest message with correct msgid, type, text

# 4. Reply from Odoo
curl -X POST "https://odoo.example.com/api/send_message" \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": 123, "text": "Reply from Odoo"}'

# 5. Verify WhatsApp received reply
# Check mobile app for message
```

---

## Verification Checklist

### Priority 1 Completion
- [ ] Task 1.1: Failed message events delivered to Odoo
  - [ ] Send to invalid JID → Odoo shows failure
  - [ ] Network error → DLQ contains event
  - [ ] Error message displayed in Odoo UI

- [ ] Task 1.2: Quoted messages extracted
  - [ ] Reply to text → quote_id populated in Odoo DB
  - [ ] Reply to image → contextInfo extracted
  - [ ] Odoo UI shows quoted message preview

- [ ] Task 1.3: Private conversations detected
  - [ ] @l.us JID → conv_type = 'private'
  - [ ] @g.us JID → conv_type = 'group'
  - [ ] @s.whatsapp.net → conv_type = 'normal'

### Data Integrity
- [ ] Message IDs follow format: `true/false_id_jid`
- [ ] Timestamps in seconds (not milliseconds)
- [ ] Phone numbers digits-only (no + or -)
- [ ] Media URLs publicly accessible
- [ ] Group messages include author field

### Error Handling
- [ ] Webhook retries on 5xx errors
- [ ] Dead letter queue captures failures
- [ ] Failed events include meaningful error messages
- [ ] No data loss on temporary failures

### Performance
- [ ] Webhook response time < 2s
- [ ] Media upload completes < 10s
- [ ] Message processing latency < 500ms
- [ ] No memory leaks on long-running service

---

## Rollout Plan

### Phase 1: Development (Week 1)
**Day 1-2**: Implement Task 1.1 (Failed events)
- Code implementation
- Unit tests
- Local testing

**Day 3**: Implement Task 1.2 (Quoted messages)
- Code implementation
- Integration tests

**Day 4**: Implement Task 1.3 (Private conversations)
- Code implementation
- Quick win, low risk

**Day 5**: Code review & refinement
- Address feedback
- Update documentation

### Phase 2: Staging (Week 2)
**Day 1**: Deploy to staging environment
- Configure test Odoo instance
- Set up monitoring

**Day 2-3**: Integration testing
- Send various message types
- Test edge cases
- Monitor dead letter queue

**Day 4**: Performance testing
- Load test webhook delivery
- Check for memory leaks
- Verify retry logic

**Day 5**: Staging sign-off
- Review metrics
- Fix any issues
- Document findings

### Phase 3: Production (Week 3)
**Day 1**: Deploy to 10% of tenants
- Canary deployment
- Monitor closely

**Day 2**: Deploy to 50% of tenants
- Review metrics from 10%
- No rollback needed

**Day 3**: Deploy to 100% of tenants
- Full rollout
- Monitor webhook success rate

**Day 4-5**: Post-deployment monitoring
- Check dead letter queue
- Review error rates
- Gather user feedback

### Phase 4: Priority 2 Tasks (Week 4+)
- Implement Task 2.1-2.3 as separate iterations
- Lower priority, can be scheduled flexibly

---

## Monitoring & Metrics

### Key Metrics to Track

#### Webhook Delivery
- **Success Rate**: Target > 99%
- **Retry Rate**: < 5% of messages
- **Dead Letter Queue Size**: < 1% of total messages
- **Average Response Time**: < 2s

#### Message Processing
- **Inbound Latency**: Time from WhatsApp → Odoo webhook
  - Target: < 500ms
- **Outbound Latency**: Time from Odoo → WhatsApp delivery
  - Target: < 1s

#### Error Rates
- **Failed Events**: Count per day
  - Alert if > 100/day
- **Parse Errors**: Invalid message formats
  - Alert if > 10/day

### Logging Examples

```typescript
// Success
logger.info({
  userId,
  messageId,
  type: 'inbound',
  duration: 250
}, 'Message processed successfully');

// Warning
logger.warn({
  userId,
  attempt: 3,
  error: 'Connection timeout'
}, 'Webhook retry');

// Error
logger.error({
  userId,
  messageId,
  error: 'Invalid JID format',
  jid: 'malformed@...'
}, 'Message processing failed');
```

---

## File Impact Summary

### Must Modify (Priority 1)
```
lib/odoo-acrux-mapper.ts
├── Add: extractQuotedMessageId()
├── Add: detectConversationType()
└── Modify: waMessageToAcuxInbound()

lib/odoo-webhook-delivery.ts
└── Add: deliverOdooFailedMessage()

src/services/whatsapp.ts
├── Modify: sendMessage() - add try-catch
├── Modify: sendImage() - add try-catch
├── Modify: sendVideo() - add try-catch
├── Modify: sendAudio() - add try-catch
├── Modify: sendDocument() - add try-catch
└── Import: deliverOdooFailedMessage, buildCompositeMsgId
```

### Optional Modify (Priority 2)
```
lib/odoo-gateway-actions.ts
├── Modify: handleContactGetAll() - implement sync
└── Add: validateInstagramMedia()

src/handlers/message.handler.ts
└── Add: Instagram format validation
```

---

## Success Criteria

### Technical Success
- ✅ All Priority 1 tasks implemented and tested
- ✅ Zero regressions in existing functionality
- ✅ Webhook success rate maintained > 99%
- ✅ Dead letter queue < 1% of messages
- ✅ All tests passing (unit + integration + E2E)

### Business Success
- ✅ Odoo users see quoted message context
- ✅ Failed messages show clear error reasons
- ✅ Private/business conversations properly categorized
- ✅ No customer complaints about missing features
- ✅ Support ticket volume unchanged or decreased

### Documentation Success
- ✅ Code comments added for all new functions
- ✅ README updated with new features
- ✅ Migration guide created (if needed)
- ✅ Monitoring dashboard configured
- ✅ Runbook updated with troubleshooting steps

---

**Total Estimated Effort**:
- Priority 1: 8-12 hours (2-3 days)
- Priority 2: 6-10 hours (1-2 days)
- Testing: 4-6 hours (1 day)
- **Total**: 18-28 hours (4-6 working days)

---

*Task Plan Version 1.0*
*Created: 2026-05-03*
*Status: Ready for Development*
*Next Review: After Priority 1 completion*
