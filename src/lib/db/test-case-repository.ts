/**
 * TestCaseRepository — enforces default active scope on all test_cases queries.
 *
 * Scope conventions used in this file and across the codebase:
 *   // TRASH_SCOPE     — intentionally queries deleted (deleted_at IS NOT NULL) rows
 *   // UNFILTERED_SCOPE — intentionally bypasses soft-delete filter (e.g. audit / run history)
 *
 * NEVER add .from('test_cases') queries outside this repository without one of
 * the above comments to explain why the default scope is bypassed.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type TestCaseFilters = Record<string, unknown>;

export class TestCaseRepository {
  constructor(private readonly db: SupabaseClient) {}

  /** Default scope: active (not deleted) test cases only. */
  private baseQuery() {
    return this.db.from('test_cases').select('*').is('deleted_at', null);
  }

  /** Find a single active test case by ID. Returns null if deleted or missing. */
  async findById(id: string) {
    const { data, error } = await this.baseQuery()
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  /** Find a single active test case by ID with full relations. */
  async findByIdWithRelations(id: string) {
    const { data, error } = await this.db
      .from('test_cases')
      .select(`
        *,
        test_steps(*, id, step_number, description, test_data, expected_result, is_automation_only),
        bug_links(*, id, url, title, provider, external_id, external_status),
        test_case_versions(id, version_number, changed_by, change_summary, created_at, changer:changed_by(full_name))
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (error) return null;
    return data;
  }

  /** List active test cases, optionally filtered. */
  async findAll(filters: TestCaseFilters = {}) {
    let query = this.db
      .from('test_cases')
      .select('*, suite:suites(project_id)')
      .is('deleted_at', null)
      .order('position', { ascending: true });

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value as string);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  /** TRASH_SCOPE — list soft-deleted test cases only (trash view). */
  async findDeleted(filters: TestCaseFilters = {}) {
    // TRASH_SCOPE
    let query = this.db
      .from('test_cases')
      .select('*, suite:suites(project_id, name, prefix)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value as string);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  /**
   * UNFILTERED_SCOPE — fetch a test case regardless of deleted_at.
   * Use only for audit log lookups or historical run snapshots.
   */
  async findByIdUnfiltered(id: string) {
    // UNFILTERED_SCOPE — run history / audit only
    const { data, error } = await this.db
      .from('test_cases')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  /**
   * Check whether a test case with the given title exists in the trash
   * (for duplicate-name notice on create).
   */
  async findDeletedByTitle(title: string, suiteId?: string) {
    // TRASH_SCOPE
    let query = this.db
      .from('test_cases')
      .select('id, title, suite_id, deleted_at')
      .not('deleted_at', 'is', null)
      .ilike('title', title);

    if (suiteId) {
      query = query.eq('suite_id', suiteId);
    }

    const { data } = await query;
    return data ?? [];
  }
}
