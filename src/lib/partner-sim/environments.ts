/**
 * Which FullStackRx environment a simulator partner targets.
 *
 * TCM's server makes every Partner API call, so the environment must be reachable from
 * the internet: staging is; QA's FullStackRx only admits the VPN, so it can't be used.
 * Each partner stores its own API base URL (QA types it in). These env vars only
 * pre-fill that field; none are required:
 *
 *   PARTNER_SIM_STAGING_API_URL, PARTNER_SIM_QA_API_URL   default API base URLs
 *   PARTNER_SIM_STAGING_UI_URL,  PARTNER_SIM_QA_UI_URL    link each environment's /partner-api-docs
 *   PARTNER_SIM_WEBHOOK_BASE_URL                          origin FullStackRx sends webhooks to
 */

export const SIM_ENVIRONMENTS = ['staging', 'qa', 'other'] as const;
export type SimEnvironment = (typeof SIM_ENVIRONMENTS)[number];

export const ENVIRONMENT_LABELS: Record<SimEnvironment, string> = {
  staging: 'Staging',
  qa: 'QA',
  other: 'Other',
};

/** Environments TCM's server can't reach, with why. */
export const UNREACHABLE_ENVIRONMENTS: Partial<Record<SimEnvironment, string>> = {
  qa: "QA's FullStackRx only admits the VPN, so TCM can't reach it. Test the Partner API on staging.",
};

/**
 * The bare host QA should store. Trims spaces and trailing slashes, and the Partner API
 * prefix (/api/partner/v1, or a bare /v1) if a full URL was pasted.
 */
export function normalizeApiBase(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/(\/api\/partner)?\/v1$/i, '')
    .replace(/\/+$/, '');
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
  docsUrl: string | null;
}

export function listEnvironments(): EnvironmentInfo[] {
  return SIM_ENVIRONMENTS.map((id) => ({
    id,
    label: ENVIRONMENT_LABELS[id],
    defaultApiUrl: envDefaultApiUrl(id),
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
