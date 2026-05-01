# -*- coding: utf-8 -*-
from odoo import models, fields


class SaasWhatsappMessage(models.Model):
    _name = 'saas.whatsapp.message'
    _description = 'SaaS WhatsApp Message'
    _order = 'create_date desc, id desc'

    conversation_id = fields.Many2one(
        'saas.whatsapp.conversation', required=True, ondelete='cascade',
    )
    connector_id = fields.Many2one(
        related='conversation_id.connector_id', store=True, readonly=True,
    )
    company_id = fields.Many2one(
        related='conversation_id.company_id', store=True, readonly=True,
    )
    direction = fields.Selection(
        [('inbound', 'Inbound'), ('outbound', 'Outbound')],
        required=True,
    )
    wa_message_id = fields.Char(string='WhatsApp message id', index=True)
    body = fields.Text()
