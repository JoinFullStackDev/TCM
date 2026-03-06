import type { SlackConfig } from '@/types/database';

interface RunSummary {
  runId: string;
  runName: string;
  projectName: string;
  environment: string | null;
  targetVersion: string | null;
  status: string;
  totalCases: number;
  pass: number;
  fail: number;
  blocked: number;
  skip: number;
  not_run: number;
  passRate: number;
}

function statusEmoji(passRate: number, fails: number): string {
  if (fails === 0 && passRate === 100) return ':large_green_circle:';
  if (passRate >= 80) return ':large_yellow_circle:';
  return ':red_circle:';
}

function buildCompletionBlocks(summary: RunSummary, appUrl: string) {
  const emoji = statusEmoji(summary.passRate, summary.fail);
  const reportUrl = `${appUrl}/reports/${summary.runId}`;

  const meta: string[] = [];
  if (summary.environment) meta.push(`*Env:* ${summary.environment}`);
  if (summary.targetVersion) meta.push(`*Version:* ${summary.targetVersion}`);
  meta.push(`*Status:* ${summary.status}`);

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${summary.projectName} — Test Run Complete`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *<${reportUrl}|${summary.runName}>*\n${meta.join('  |  ')}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Total Cases*\n${summary.totalCases}` },
        { type: 'mrkdwn', text: `*Pass Rate*\n${summary.passRate}%` },
        { type: 'mrkdwn', text: `:white_check_mark: *Passed*\n${summary.pass}` },
        { type: 'mrkdwn', text: `:x: *Failed*\n${summary.fail}` },
        { type: 'mrkdwn', text: `:no_entry_sign: *Blocked*\n${summary.blocked}` },
        { type: 'mrkdwn', text: `:fast_forward: *Skipped*\n${summary.skip}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Report', emoji: true },
          url: reportUrl,
          style: 'primary',
        },
      ],
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
  ];

  return blocks;
}

function buildThresholdAlertBlocks(
  summary: RunSummary,
  threshold: number,
  mentionUsergroups: string[],
  appUrl: string,
) {
  const reportUrl = `${appUrl}/reports/${summary.runId}`;
  const mentions = mentionUsergroups.length > 0
    ? mentionUsergroups.map((g) => `<!subteam^${g}>`).join(' ')
    : '<!here>';

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':rotating_light: Failure Threshold Exceeded',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${mentions}\n\n*<${reportUrl}|${summary.runName}>* in *${summary.projectName}* has *${summary.fail} failures* (threshold: ${threshold}).`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Report', emoji: true },
          url: reportUrl,
          style: 'danger',
        },
      ],
    },
  ];
}

async function postToSlack(webhookUrl: string, blocks: Record<string, unknown>[]) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slack webhook returned ${res.status}: ${text}`);
  }
}

export async function sendRunCompletionNotification(
  config: SlackConfig,
  summary: RunSummary,
  appUrl: string,
) {
  if (config.notify_on === 'failures_only' && summary.fail === 0) {
    return;
  }

  const blocks = buildCompletionBlocks(summary, appUrl);
  await postToSlack(config.webhook_url, blocks);

  if (config.failure_threshold > 0 && summary.fail >= config.failure_threshold) {
    const alertBlocks = buildThresholdAlertBlocks(
      summary,
      config.failure_threshold,
      config.mention_usergroups,
      appUrl,
    );
    await postToSlack(config.webhook_url, alertBlocks);
  }
}
