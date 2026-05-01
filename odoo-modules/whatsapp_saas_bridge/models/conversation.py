# -*- coding: utf-8 -*-
from odoo import models, fields


class SaasWhatsappConversation(models.Model):
    _name = 'saas.whatsapp.conversation'
    _description = 'SaaS WhatsApp Conversation'
    _order = 'last_message_at desc, id desc'

    name = fields.Char(required=True, default='Chat')
    connector_id = fields.Many2one(
        'saas.whatsapp.connector', required=True, ondelete='cascade',
    )
    company_id = fields.Many2one(
        related='connector_id.company_id', store=True, readonly=True,
    )
    wa_chat_id = fields.Char(string='WhatsApp chat id', required=True, index=True)
    wa_from_label = fields.Char(string='Last sender')
    last_message_at = fields.Datetime()
    message_ids = fields.One2many('saas.whatsapp.message', 'conversation_id', string='Messages')

    _sql_constraints = [
        ('uniq_connector_chat', 'unique(connector_id, wa_chat_id)',
         'This chat is already linked for this connector.'),
    ]
