/**
 * The FullStackRx environments a simulator partner can target. Base URLs come from
 * server env vars only, so a browser can never point a stored key at another host.
 *
 *   PARTNER_SIM_LOCAL_API_URL    default http://localhost:8090 outside production
 *   PARTNER_SIM_QA_API_URL       e.g. https://<qa api host>      (no default)
 *   PARTNER_SIM_STAGING_API_URL  e.g. https://<staging api host> (no default)
 *   PARTNER_SIM_<ENV>_UI_URL     optional; links the environment's /partner-api-docs
 */

export const SIM_ENVIRONMENTS = ['local', 'qa', 'staging'] as const;
export type SimEnvironment = (typeof SIM_ENVIRONMENTS)[number];

export const ENVIRONMENT_LABELS: Record<SimEnvironment, string> = {
  local: 'Local',
  qa: 'QA',
  staging: 'Staging',
};

const isProduction = () => process.env.NODE_ENV === 'production';

/** Trims a trailing slash and a trailing /v1, so either form works in the env var. */
export function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
}

export function environmentApiUrl(env: SimEnvironment): string | null {
  const raw =
    env === 'local'
      ? process.env.PARTNER_SIM_LOCAL_API_URL || (isProduction() ? '' : 'http://localhost:8090')
      : env === 'qa'
        ? process.env.PARTNER_SIM_QA_API_URL
        : process.env.PARTNER_SIM_STAGING_API_URL;
  return raw ? normalizeApiBase(raw) : null;
}

export function environmentDocsUrl(env: SimEnvironment): string | null {
  const raw =
    env === 'local'
      ? process.env.PARTNER_SIM_LOCAL_UI_URL || (isProduction() ? '' : 'https://localhost:3010')
      : env === 'qa'
        ? process.env.PARTNER_SIM_QA_UI_URL
        : process.env.PARTNER_SIM_STAGING_UI_URL;
  return raw ? `${raw.replace(/\/+$/, '')}/partner-api-docs` : null;
}

export interface EnvironmentInfo {
  id: SimEnvironment;
  label: string;
  apiUrl: string | null;
  docsUrl: string | null;
}

export function listEnvironments(): EnvironmentInfo[] {
  return SIM_ENVIRONMENTS.map((id) => ({
    id,
    label: ENVIRONMENT_LABELS[id],
    apiUrl: environmentApiUrl(id),
    docsUrl: environmentDocsUrl(id),
  }));
}

/**
 * Where FullStackRx should deliver webhooks. PARTNER_SIM_WEBHOOK_BASE_URL overrides the
 * request's own origin, e.g. http://host.docker.internal:3000 when the local
 * FullStackRx API runs in Docker and can't reach "localhost".
 */
export function webhookBaseUrl(requestOrigin: string): string {
  return (process.env.PARTNER_SIM_WEBHOOK_BASE_URL || requestOrigin).replace(/\/+$/, '');
}

export function webhookUrlFor(base: string, partnerId: string): string {
  return `${base}/api/webhooks/partner-sim/${partnerId}`;
}
