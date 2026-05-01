/** Payload POSTed to customer webhook URL (e.g. Odoo). */
export type InboundWebhookPayload = {
  event: 'message.received';
  tenantId: string;
  messageId: string | undefined;
  from: string | undefined;
  chatId: string | undefined;
  type: string;
  text: string | null;
  senderName: string | undefined;
  isGroup: boolean;
  timestamp: number | undefined;
  groupName?: string;
};
