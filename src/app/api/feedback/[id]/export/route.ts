import { NextRequest, NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';
import { exportFeedbackSchema } from '@/lib/validations/feedback';
import type {
  FeedbackSubmission,
  FeedbackExport,
  GitLabIssuesConfig,
  ADOConfig,
  Integration,
} from '@/types/database';

type RouteParams = { params: Promise<{ id: string }> };

function textToHtml(text: string | null | undefined): string {
  if (!text) return '';
  return `<p>${text.replace(/\n/g, '<br/>')}</p>`;
}

function severityToPriority(severity: string | null | undefined): number {
  switch (severity) {
    case 'critical': return 1;
    case 'high': return 2;
    case 'medium': return 3;
    case 'low': return 4;
    default: return 3;
  }
}

async function exportToGitLab(
  submission: FeedbackSubmission,
  config: GitLabIssuesConfig,
): Promise<{ external_id: string; external_url: string }> {
  const encodedProjectId = encodeURIComponent(config.project_id);
  const url = `${config.gitlab_url.replace(/\/$/, '')}/api/v4/projects/${encodedProjectId}/issues`;

  const labels = [
    'testforge',
    'feedback',
    submission.submission_type,
    submission.environment ?? '',
  ]
    .filter(Boolean)
    .join(',');

  const description = [
    `## Description\n${submission.description}`,
    submission.steps_to_reproduce ? `## Steps to Reproduce\n${submission.steps_to_reproduce}` : null,
    submission.expected_behavior ? `## Expected Behavior\n${submission.expected_behavior}` : null,
    submission.actual_behavior ? `## Actual Behavior\n${submission.actual_behavior}` : null,
    '---',
    `*Submitted via TestForge Feedback Portal*`,
    `*Submitter: ${submission.submitter_name ?? 'Anonymous'} (${submission.submitter_email ?? 'no email'})*`,
    `*Environment: ${submission.environment ?? 'unspecified'}*`,
    `*Severity: ${submission.severity ?? 'N/A'}*`,
  ]
    .filter((line) => line !== null)
    .join('\n\n');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PRIVATE-TOKEN': config.private_token,
    },
    body: JSON.stringify({
      title: submission.title,
      description,
      labels,
      issue_type: 'issue',
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`GitLab API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return {
    external_id: String(data.iid),
    external_url: data.web_url,
  };
}

async function exportToADO(
  submission: FeedbackSubmission,
  config: ADOConfig,
  patToken: string,
): Promise<{ external_id: string; external_url: string }> {
  const orgUrl = config.organization_url.replace(/\/$/, '');
  const workItemType = submission.submission_type === 'bug' ? 'Bug' : 'User Story';
  const encodedType = encodeURIComponent(`$${workItemType}`);
  const url = `${orgUrl}/${encodeURIComponent(config.project_name)}/_apis/wit/workitems/${encodedType}?api-version=7.0`;

  const basicAuth = Buffer.from(`:${patToken}`).toString('base64');

  const patchOps =
    submission.submission_type === 'bug'
      ? [
          { op: 'add', path: '/fields/System.Title', value: submission.title },
          { op: 'add', path: '/fields/System.Description', value: textToHtml(submission.description) },
          { op: 'add', path: '/fields/Microsoft.VSTS.TCM.ReproSteps', value: textToHtml(submission.steps_to_reproduce) },
          { op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: severityToPriority(submission.severity) },
          {
            op: 'add',
            path: '/fields/System.Tags',
            value: ['testforge', 'feedback', submission.environment ?? ''].filter(Boolean).join(';'),
          },
        ]
      : [
          { op: 'add', path: '/fields/System.Title', value: submission.title },
          { op: 'add', path: '/fields/System.Description', value: textToHtml(submission.description) },
          { op: 'add', path: '/fields/System.Tags', value: 'testforge;feedback' },
        ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json-patch+json',
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify(patchOps),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`ADO API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return {
    external_id: String(data.id),
    external_url: data._links?.html?.href ?? `${orgUrl}/${config.project_name}/_workitems/edit/${data.id}`,
  };
}

// POST /api/feedback/[id]/export — AUTHENTICATED
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await withAuth('manage_feedback');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = exportFeedbackSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { provider } = parsed.data;

  // Load submission
  const { data: submission, error: subError } = await supabase
    .from('feedback_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (subError || !submission) return notFound('Feedback submission');

  // Check idempotency — don't export twice to same provider
  const existingExports = (submission.exports ?? []) as FeedbackExport[];
  if (existingExports.some((e) => e.provider === provider)) {
    return NextResponse.json(
      { error: `Already exported to ${provider}` },
      { status: 409 },
    );
  }

  // Resolve integration type
  const integrationType = provider === 'gitlab_issues' ? 'gitlab_issues' : 'ado';

  // Find active integration for the project
  const projectId = submission.project_id;
  if (!projectId) {
    return NextResponse.json(
      { error: 'Submission has no project assigned. Assign a project before exporting.' },
      { status: 422 },
    );
  }

  const { data: integrationData, error: intError } = await supabase
    .from('integrations')
    .select('*')
    .eq('project_id', projectId)
    .eq('type', integrationType)
    .eq('is_active', true)
    .maybeSingle();

  if (intError || !integrationData) {
    return NextResponse.json(
      { error: `No active ${provider} integration configured for this project` },
      { status: 422 },
    );
  }

  const integration = integrationData as Integration;

  let exportResult: { external_id: string; external_url: string };

  try {
    if (provider === 'gitlab_issues') {
      const config = integration.config as GitLabIssuesConfig;
      exportResult = await exportToGitLab(submission as FeedbackSubmission, config);
    } else {
      // ADO — retrieve PAT
      const adoConfig = integration.config as unknown as Record<string, unknown>;
      let patToken: string;

      if (adoConfig.pat_secret_id) {
        // Retrieve from Vault using service client
        const serviceClient = await createServiceClient();
        const { data: vaultData, error: vaultError } = await serviceClient
          .rpc('vault_decrypted_secret', { secret_id: adoConfig.pat_secret_id as string })
          .single();

        if (vaultError || !vaultData) {
          // Vault not available or secret not found — try fallback
          if (adoConfig.pat_encrypted) {
            // This path uses pgcrypto decryption; not callable via RPC in this flow
            return serverError('ADO PAT retrieval failed — Vault unavailable and pgcrypto fallback not configured');
          }
          return serverError('ADO PAT retrieval failed');
        }
        patToken = (vaultData as { decrypted_secret: string }).decrypted_secret;
      } else if (adoConfig.pat_token) {
        // Plain text PAT stored in config (admin configured directly)
        patToken = adoConfig.pat_token as string;
      } else {
        return serverError('ADO PAT not configured for this integration');
      }

      const adoTypedConfig: import('@/types/database').ADOConfig = {
        organization_url: adoConfig.organization_url as string,
        project_name: adoConfig.project_name as string,
      };

      exportResult = await exportToADO(submission as FeedbackSubmission, adoTypedConfig, patToken);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Export failed: ${message}` }, { status: 502 });
  }

  // Record export result
  const exportRecord: FeedbackExport = {
    provider,
    external_id: exportResult.external_id,
    external_url: exportResult.external_url,
    exported_at: new Date().toISOString(),
  };

  const updatedExports = [...existingExports, exportRecord];

  const { error: updateError } = await supabase
    .from('feedback_submissions')
    .update({
      exports: updatedExports,
      status: 'exported',
    })
    .eq('id', id);

  if (updateError) {
    // Export succeeded but recording failed — still return the result
    console.error('Failed to record export result:', updateError.message);
  }

  return NextResponse.json(exportRecord);
}
