import { z } from 'zod';

export const createBugLinkSchema = z.object({
  url: z.string().trim().url('Must be a valid URL').max(2000),
  title: z.string().trim().max(200).nullable().optional(),
  external_id: z.string().trim().max(100).nullable().optional(),
  provider: z.string().trim().max(50).optional(),
});

export type CreateBugLinkInput = z.infer<typeof createBugLinkSchema>;

export function detectProvider(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('gitlab')) return 'gitlab';
    if (hostname.includes('github')) return 'github';
    if (hostname.includes('jira') || hostname.includes('atlassian')) return 'jira';
    if (hostname.includes('linear')) return 'linear';
    if (hostname.includes('youtrack')) return 'youtrack';
    if (hostname.includes('bugzilla')) return 'bugzilla';
    return 'other';
  } catch {
    return 'other';
  }
}
