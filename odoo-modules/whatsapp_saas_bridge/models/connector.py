# -*- coding: utf-8 -*-
import json
import logging
import uuid

import requests
from odoo import models, fields, api, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class SaasWhatsappConnector(models.Model):
    _name = 'saas.whatsapp.connector'
    _description = 'SaaS WhatsApp Connector'

    name = fields.Char(required=True, default='WhatsApp SaaS')
    active = fields.Boolean(default=True)
    company_id = fields.Many2one(
        'res.company', string='Company', required=True,
        default=lambda self: self.env.company,
    )
    saas_base_url = fields.Char(
        string='SaaS base URL',
        required=True,
        help='Origin only, e.g. https://app.example.com (no trailing path).',
    )
    api_key = fields.Char(string='API key', required=True)
    webhook_verify_secret = fields.Char(
        string='Webhook signing secret',
        required=True,
        help='Same secret as on the SaaS dashboard for outbound webhooks (HMAC SHA-256).',
    )
    hook_token = fields.Char(
        string='Inbound hook token',
        required=True,
        copy=False,
        default=lambda self: str(uuid.uuid4()),
        help='Used in the public webhook URL.',
    )
    webhook_url_display = fields.Char(
        string='Odoo webhook URL',
        compute='_compute_webhook_url_display',
    )
    conversation_ids = fields.One2many(
        'saas.whatsapp.conversation', 'connector_id', string='Conversations',
    )

    @api.depends('hook_token')
    def _compute_webhook_url_display(self):
        base = self.env['ir.config_parameter'].sudo().get_param('web.base.url') or ''
        for rec in self:
            if rec.hook_token and base:
                rec.webhook_url_display = '%s/saas_whatsapp/hook/%s' % (
                    base.rstrip('/'),
                    rec.hook_token,
                )
            else:
                rec.webhook_url_display = ''

    def _base(self):
        self.ensure_one()
        return (self.saas_base_url or '').rstrip('/')

    def integration_headers(self):
        self.ensure_one()
        return {
            'Authorization': 'Bearer %s' % self.api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    def action_ping_saas(self):
        self.ensure_one()
        url = '%s/api/integration/v1/status' % self._base()
        try:
            r = requests.get(url, headers=self.integration_headers(), timeout=30)
            body = r.text
            try:
                data = r.json()
            except ValueError:
                data = {'raw': body}
            if r.status_code >= 400:
                raise UserError(_('SaaS error (%s): %s') % (r.status_code, body[:500]))
            msg = json.dumps(data, indent=2, ensure_ascii=False)
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('SaaS status'),
                    'message': msg[:2000],
                    'sticky': True,
                },
            }
        except requests.RequestException as e:
            raise UserError(_('Request failed: %s') % str(e)) from e

    def send_text(self, to_number, text):
        """POST /api/integration/v1/messages."""
        self.ensure_one()
        url = '%s/api/integration/v1/messages' % self._base()
        payload = {'to': to_number, 'type': 'text', 'text': text}
        try:
            r = requests.post(
                url,
                headers=self.integration_headers(),
                json=payload,
                timeout=60,
            )
            if r.status_code >= 400:
                try:
                    err = r.json().get('error', r.text)
                except ValueError:
                    err = r.text
                raise UserError(_('Send failed (%s): %s') % (r.status_code, err))
            return True
        except requests.RequestException as e:
            raise UserError(_('Request failed: %s') % str(e)) from e
