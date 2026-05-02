import { dispatchGatewayRequest } from '@/lib/gateway-dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Odoo ChatRoom (Acrux-style) connector: one base URL, route by `action` header.
 * Headers: token, client_id, action — see lib/gateway-dispatch.ts
 */
export function GET(req: Request) {
  return dispatchGatewayRequest(req);
}

export function POST(req: Request) {
  return dispatchGatewayRequest(req);
}

export function DELETE(req: Request) {
  return dispatchGatewayRequest(req);
}
