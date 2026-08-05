-- Migration 00043: enable RLS on mcp_tool_calls
--
-- 00042 created mcp_tool_calls in the public schema without RLS. Because the
-- public schema is exposed via PostgREST, an authenticated user could read the
-- audit log (correlation ids, actor identity, display_ids, outcomes) through the
-- REST API. Supabase's linter flags this ("RLS not enabled on a public table").
--
-- Fix: enable RLS with NO policies. This denies all access to the anon and
-- authenticated roles by default. The API writes to this table with the
-- service-role client, which BYPASSES RLS, so the fire-and-forget audit inserts
-- keep working unchanged. Add an admin-only SELECT policy later only if the UI
-- ever needs to surface this table.

ALTER TABLE mcp_tool_calls ENABLE ROW LEVEL SECURITY;
