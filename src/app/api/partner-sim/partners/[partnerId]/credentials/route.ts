import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api/helpers';
import { simAuth, loadPartnerTarget } from '@/lib/partner-sim/server';
import { decryptSecret } from '@/lib/partner-sim/crypto';

interface RouteContext {
  params: Promise<{ partnerId: string }>;
}

/**
 * The partner's API key and webhook secret in plain text, for the tester's browser.
 * Needed when the browser calls FullStackRx itself (QA is only reachable on the VPN), and
 * for "show / copy key". These are QA/staging test keys, never production ones.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { partnerId } = await context.params;

  const target = await loadPartnerTarget(auth.db, partnerId);
  if (!target.ok) return target.response;

  let webhookSecret: string | null = null;
  if (target.partner.webhook_secret_encrypted) {
    try {
      webhookSecret = decryptSecret(target.partner.webhook_secret_encrypted);
    } catch {
      return serverError('Could not decrypt the stored webhook secret. Edit the partner and paste it again.');
    }
  }

  return NextResponse.json(
    { api_key: target.apiKey, webhook_secret: webhookSecret, api_url: target.baseUrl },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
