import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { testSlackSchema } from '@/lib/validations/integration';

export async function POST(request: Request) {
  const auth = await withAuth('manage_integrations');
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const parsed = testSlackSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  try {
    const res = await fetch(parsed.data.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'TCM Slack Integration Test',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'If you can see this message, your Slack integration is working correctly.',
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Sent from TCM at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Slack returned ${res.status}: ${text}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to reach Slack');
  }
}
