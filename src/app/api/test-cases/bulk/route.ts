import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { bulkUpdateSchema, bulkIdsSchema } from '@/lib/validations/test-case';

/**
 * PATCH /api/test-cases/bulk — bulk field update (automation_status, priority, etc.)
 */
export async function PATCH(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = bulkUpdateSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { ids, updates } = parsed.data;

  const cleanUpdates: Record<string, unknown> = { updated_by: user.id };
  if (updates.automation_status !== undefined) cleanUpdates.automation_status = updates.automation_status;
  if (updates.platform_tags !== undefined) cleanUpdates.platform_tags = updates.platform_tags;
  if (updates.priority !== undefined) cleanUpdates.priority = updates.priority;
  if (updates.type !== undefined) cleanUpdates.type = updates.type;

  const { data, error } = await supabase
    .from('test_cases')
    .update(cleanUpdates)
    .in('id', ids)
    .is('deleted_at', null) // only update active cases
    .select();

  if (error) return serverError(error.message);

  return NextResponse.json({ updated: data?.length ?? 0 });
}

/**
 * POST /api/test-cases/bulk — route sub-actions via ?action= query param
 * Supported: action=delete, action=restore
 *
 * Body: { ids: [uuid, ...] } — max 100 IDs
 *
 * bulk-delete:
 *   Single UPDATE WHERE id = ANY(ids) AND deleted_at IS NULL
 *   Batch audit INSERT
 *   Response: { deleted: [], skipped: [], not_found: [] }
 *
 * bulk-restore:
 *   Single UPDATE WHERE id = ANY(ids) AND deleted_at IS NOT NULL
 *   Batch audit INSERT
 *   Response: { restored: [], skipped: [], not_found: [] }
 *
 * RBAC: Editor+ (soft_delete). Viewers get 403.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'delete') return handleBulkDelete(request);
  if (action === 'restore') return handleBulkRestore(request);

  return NextResponse.json({ error: 'Unknown bulk action. Use ?action=delete or ?action=restore' }, { status: 400 });
}

async function handleBulkDelete(request: Request) {
  const auth = await withAuth('soft_delete');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = bulkIdsSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { ids } = parsed.data;
  const now = new Date().toISOString();

  // Find which IDs exist at all (unfiltered)
  const { data: existing } = await supabase // UNFILTERED_SCOPE
    .from('test_cases')
    .select('id, deleted_at')
    .in('id', ids);

  const existingMap = new Map((existing ?? []).map((r) => [r.id, r]));
  const notFound = ids.filter((id) => !existingMap.has(id));
  const alreadyDeleted = ids.filter((id) => existingMap.get(id)?.deleted_at);
  const toDelete = ids.filter((id) => existingMap.has(id) && !existingMap.get(id)?.deleted_at);

  if (toDelete.length > 0) {
    // Batch UPDATE — single statement, not per-row loop
    await supabase
      .from('test_cases')
      .update({
        deleted_at: now,
        deleted_by: user.id,
        restored_at: null,
        restored_by: null,
      })
      .in('id', toDelete)
      .is('deleted_at', null);

    // Batch audit INSERT
    const auditRows = toDelete.map((id) => ({
      test_case_id: id,
      action: 'deleted' as const,
      actor_id: user.id,
      occurred_at: now,
      metadata: {},
    }));
    await supabase.from('test_case_audit_log').insert(auditRows);
  }

  return NextResponse.json({
    deleted: toDelete,
    skipped: alreadyDeleted,
    not_found: notFound,
  });
}

async function handleBulkRestore(request: Request) {
  const auth = await withAuth('soft_delete');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = bulkIdsSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { ids } = parsed.data;
  const now = new Date().toISOString();

  // Find which IDs exist at all (unfiltered)
  const { data: existing } = await supabase // UNFILTERED_SCOPE
    .from('test_cases')
    .select('id, deleted_at')
    .in('id', ids);

  const existingMap = new Map((existing ?? []).map((r) => [r.id, r]));
  const notFound = ids.filter((id) => !existingMap.has(id));
  const alreadyActive = ids.filter((id) => existingMap.has(id) && !existingMap.get(id)?.deleted_at);
  const toRestore = ids.filter((id) => existingMap.get(id)?.deleted_at);

  if (toRestore.length > 0) {
    // Batch UPDATE — single statement
    await supabase
      .from('test_cases')
      .update({
        deleted_at: null,
        deleted_by: null,
        restored_at: now,
        restored_by: user.id,
      })
      .in('id', toRestore)
      .not('deleted_at', 'is', null);

    // Batch audit INSERT
    const auditRows = toRestore.map((id) => ({
      test_case_id: id,
      action: 'restored' as const,
      actor_id: user.id,
      occurred_at: now,
      metadata: {},
    }));
    await supabase.from('test_case_audit_log').insert(auditRows);
  }

  return NextResponse.json({
    restored: toRestore,
    skipped: alreadyActive,
    not_found: notFound,
  });
}
