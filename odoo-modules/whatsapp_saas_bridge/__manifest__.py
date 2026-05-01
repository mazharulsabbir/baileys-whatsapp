# -*- coding: utf-8 -*-
{
    'name': 'WhatsApp SaaS Bridge',
    'summary': 'Connect Odoo to the Baileys SaaS integration API (send/receive text, signed webhooks).',
    'version': '17.0.1.0.0',
    'category': 'Productivity',
    'author': 'baileys-whatsapp',
    'license': 'LGPL-3',
    'depends': ['base'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'views/connector_views.xml',
        'views/menu.xml',
    ],
    'external_dependencies': {
        'python': ['requests'],
    },
    'installable': True,
    'application': False,
}
