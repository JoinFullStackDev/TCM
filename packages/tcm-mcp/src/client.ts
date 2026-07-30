/**
 * client.ts — Thin REST client for TCM.
 *
 * The MCP server is a thin client: it does NOT touch Supabase directly.
 * All reads/writes proxy TCM REST endpoints. ID resolution, Zod validation,
 * the generate_test_case_id RPC, in_cicd locking, and soft-delete scoping
 * all happen inside TCM. (PRD §8, OQ-3 option 2.)
 */

import type { AuthConfig } from './auth.js';
import crypto from 'crypto';

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** MCP correlation ID for dry-run ↔ commit tracking (Appendix C). */
  correlationId?: string;
  /** MCP intent tag (e.g. 'dry-run-create', 'commit-update'). */
  intent?: string;
}

export class TcmClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(private readonly auth: AuthConfig) {
    this.baseUrl = auth.baseUrl;
    this.defaultHeaders = { ...auth.headers };
  }

  /**
   * Make a request to TCM REST API.
   * Throws on network failure; returns parsed JSON on success or HTTP error.
   */
  async request<T = unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<{ ok: boolean; status: number; data: T }> {
    const { method = 'GET', body, correlationId, intent } = options;

    const headers: Record<string, string> = { ...this.defaultHeaders };
    if (correlationId) headers['X-MCP-Correlation-Id'] = correlationId;
    if (intent) headers['X-MCP-Intent'] = intent;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data: T;
    try {
      data = await res.json() as T;
    } catch {
      data = null as unknown as T;
    }

    return { ok: res.ok, status: res.status, data };
  }

  /** GET convenience */
  async get<T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<{ ok: boolean; status: number; data: T }> {
    return this.request<T>(path, { ...opts, method: 'GET' });
  }

  /** POST convenience */
  async post<T>(path: string, body: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<{ ok: boolean; status: number; data: T }> {
    return this.request<T>(path, { ...opts, method: 'POST', body });
  }

  /** PATCH convenience */
  async patch<T>(path: string, body: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<{ ok: boolean; status: number; data: T }> {
    return this.request<T>(path, { ...opts, method: 'PATCH', body });
  }
}

/**
 * Compute a SHA-256 hash of a normalized write payload for audit correlation.
 * Used to verify a commit payload matches its approved dry-run (Appendix C).
 */
export function hashPayload(payload: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload, Object.keys(payload as object).sort()))
    .digest('hex');
}
