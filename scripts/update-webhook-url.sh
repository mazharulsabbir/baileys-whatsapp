#!/bin/bash

#
# Update Odoo Webhook URL
# Usage: ./update-webhook-url.sh <new-url>
# Example: ./update-webhook-url.sh https://abc123.ngrok.io/acrux_webhook/whatsapp_connector
#

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <webhook-url>"
    echo "Example: $0 https://abc123.ngrok.io/acrux_webhook/whatsapp_connector"
    exit 1
fi

NEW_URL="$1"

echo "Updating webhook URL to: $NEW_URL"

# Get current UUID from database
UUID=$(docker-compose exec -T db psql -U app app -t -c "SELECT \"connectorUuid\" FROM \"OdooGatewayCredential\" LIMIT 1;" | tr -d ' \n')

if [ -z "$UUID" ]; then
    echo "Error: No connector UUID found in database"
    exit 1
fi

echo "Connector UUID: $UUID"

# Append UUID to URL if not already present
if [[ "$NEW_URL" != *"$UUID"* ]]; then
    NEW_URL="${NEW_URL}/${UUID}"
fi

echo "Full webhook URL: $NEW_URL"

# Update database
docker-compose exec -T db psql -U app app << EOF
UPDATE "OdooGatewayCredential"
SET "odooWebhookUrl" = '${NEW_URL}',
    "updatedAt" = NOW();

SELECT
  "connectorUuid" as uuid,
  "odooWebhookUrl" as webhook_url,
  "updatedAt" as updated_at
FROM "OdooGatewayCredential";
EOF

echo ""
echo "✅ Webhook URL updated successfully!"
echo ""
echo "Next steps:"
echo "1. Restart the web service: docker-compose restart web"
echo "2. Send a test WhatsApp message"
echo "3. Check logs: docker-compose logs -f web | grep WEBHOOK"
