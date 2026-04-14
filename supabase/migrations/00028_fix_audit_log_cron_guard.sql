-- Schedule the 90-day audit log cleanup only if pg_cron is installed.
-- Environments without pg_cron (e.g. local dev, CI) will skip this safely.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-export-audit-log',
      '0 2 * * *',
      'DELETE FROM export_audit_log WHERE created_at < now() - interval ''90 days'';'
    );
  END IF;
END;
$guard$;
