/**
 * Which FullStackRx environment a simulator partner targets, and how it is reached.
 *
 * Each partner stores its own API base URL (QA types it in). These env vars only
 * pre-fill that field when a partner is created; none are required:
 *
 *   PARTNER_SIM_QA_API_URL, PARTNER_SIM_STAGING_API_URL   default API base URLs
 *   PARTNER_SIM_QA_UI_URL,  PARTNER_SIM_STAGING_UI_URL    link each environment's /partner-api-docs
 *   PARTNER_SIM_WEBHOOK_BASE_URL                          origin FullStackRx sends webhooks to
 *
 * Transport ("call mode"):
 *   browser  the tester's browser calls FullStackRx and TCM records the answer. Needed for
 *            QA, whose load balancer only admits the VPN; needs FullStackRx's CORS to allow
 *            TCM's origin on /v1.
 *   server   TCM's server calls FullStackRx. Works for publicly reachable environments
 *            (staging), with no CORS involved.
 */

export const SIM_ENVIRONMENTS = ['qa', 'staging', 'other'] as const;
export type SimEnvironment = (typeof SIM_ENVIRONMENTS)[number];

export const CALL_MODES = ['browser', 'server'] as const;
export type CallMode = (typeof CALL_MODES)[number];

export const ENVIRONMENT_LABELS: Record<SimEnvironment, string> = {
  qa: 'QA',
  staging: 'Staging',
  other: 'Other',
};

/** QA is VPN-only, so the browser has to make the call; staging is public. */
export const DEFAULT_CALL_MODE: Record<SimEnvironment, CallMode> = {
  qa: 'browser',
  staging: 'server',
  other: 'browser',
};

/** Trims spaces, a trailing slash and a trailing /v1, so either form can be pasted. */
export function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/v1$/i, '').replace(/\/+$/, '');
}

/** An http(s) URL with a host and no query or fragment. */
export function isValidApiBase(url: string): boolean {
  try {
    const u = new URL(normalizeApiBase(url));
    return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname && !u.search && !u.hash;
  } catch {
    return false;
  }
}

function envDefaultApiUrl(env: SimEnvironment): string | null {
  const raw =
    env === 'qa' ? process.env.PARTNER_SIM_QA_API_URL : env === 'staging' ? process.env.PARTNER_SIM_STAGING_API_URL : '';
  return raw ? normalizeApiBase(raw) : null;
}

function envDocsUrl(env: SimEnvironment): string | null {
  const raw =
    env === 'qa' ? process.env.PARTNER_SIM_QA_UI_URL : env === 'staging' ? process.env.PARTNER_SIM_STAGING_UI_URL : '';
  return raw ? `${raw.replace(/\/+$/, '')}/partner-api-docs` : null;
}

export interface EnvironmentInfo {
  id: SimEnvironment;
  label: string;
  /** Pre-fill for a new partner's API base URL, if configured. */
  defaultApiUrl: string | null;
  defaultCallMode: CallMode;
  docsUrl: string | null;
}

export function listEnvironments(): EnvironmentInfo[] {
  return SIM_ENVIRONMENTS.map((id) => ({
    id,
    label: ENVIRONMENT_LABELS[id],
    defaultApiUrl: envDefaultApiUrl(id),
    defaultCallMode: DEFAULT_CALL_MODE[id],
    docsUrl: envDocsUrl(id),
  }));
}

/** A partner's base URL: its own, else the environment default (older rows have none). */
export function resolveApiBase(partner: { api_base_url: string | null; environment: SimEnvironment }): string | null {
  return partner.api_base_url ? normalizeApiBase(partner.api_base_url) : envDefaultApiUrl(partner.environment);
}

export function docsUrlFor(env: SimEnvironment): string | null {
  return envDocsUrl(env);
}

/**
 * Where FullStackRx should deliver webhooks. PARTNER_SIM_WEBHOOK_BASE_URL overrides the
 * request's own origin when TCM is reached under a different name than FullStackRx can use.
 */
export function webhookBaseUrl(requestOrigin: string): string {
  return (process.env.PARTNER_SIM_WEBHOOK_BASE_URL || requestOrigin).replace(/\/+$/, '');
}

export function webhookUrlFor(base: string, partnerId: string): string {
  return `${base}/api/webhooks/partner-sim/${partnerId}`;
}

/** Orders sent with one key before TCM suggests swapping it for a fresh one. */
export const KEY_SWAP_REMINDER_AFTER = 10;
