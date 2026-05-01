# -*- coding: utf-8 -*-
import hashlib
import hmac
import json
import logging

from odoo import http, fields
from odoo.http import request, Response

_logger = logging.getLogger(__name__)


def _verify_signature(secret, raw_body, signature_header):
    if not signature_header or not signature_header.startswith('sha256='):
        return False
    sent = signature_header[7:]
    expected = hmac.new(
        secret.encode('utf-8'),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(sent, expected)


class SaasWhatsappWebhook(http.Controller):

    @http.route(
        '/saas_whatsapp/hook/<string:token>',
        type='http',
        auth='public',
        methods=['POST'],
        csrf=False,
    )
    def inbound_hook(self, token, **kwargs):
        raw = request.httprequest.data or b''
        sig = request.httprequest.headers.get('X-Signature', '')
        connector = request.env['saas.whatsapp.connector'].sudo().search([
            ('hook_token', '=', token),
            ('active', '=', True),
        ], limit=1)
        if not connector:
            return Response(status=404)

        secret = connector.webhook_verify_secret or ''
        if not secret or not _verify_signature(secret, raw, sig):
            _logger.warning('saas_whatsapp hook signature failed for token prefix %s', token[:8])
            return Response(status=403)

        try:
            data = json.loads(raw.decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            return Response(status=400)

        event = data.get('event')
        if event != 'message.received':
            return Response(status=200)

        chat_id = data.get('chatId') or ''
        text = data.get('text') or ''
        from_label = data.get('from') or data.get('senderName') or ''
        wa_mid = data.get('messageId') or ''

        Conv = request.env['saas.whatsapp.conversation'].sudo()
        conv = Conv.search([
            ('connector_id', '=', connector.id),
            ('wa_chat_id', '=', chat_id),
        ], limit=1)
        if not conv:
            conv = Conv.create({
                'name': from_label or chat_id or 'WhatsApp',
                'connector_id': connector.id,
                'wa_chat_id': chat_id,
                'wa_from_label': from_label,
                'last_message_at': fields.Datetime.now(),
            })
        else:
            conv.write({
                'wa_from_label': from_label or conv.wa_from_label,
                'last_message_at': fields.Datetime.now(),
            })

        request.env['saas.whatsapp.message'].sudo().create({
            'conversation_id': conv.id,
            'direction': 'inbound',
            'wa_message_id': wa_mid,
            'body': text,
        })

        return Response(status=200)
