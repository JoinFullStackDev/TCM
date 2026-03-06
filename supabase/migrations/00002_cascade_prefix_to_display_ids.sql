-- When a suite's prefix is updated, cascade the change to all existing
-- test_cases.display_id values so they stay in sync.

CREATE OR REPLACE FUNCTION update_test_case_display_ids_on_prefix_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.prefix IS DISTINCT FROM NEW.prefix THEN
    UPDATE test_cases
       SET display_id = NEW.prefix || '-' || sequence_number,
           updated_at = now()
     WHERE suite_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cascade_prefix_to_display_ids
  AFTER UPDATE OF prefix ON suites
  FOR EACH ROW
  EXECUTE FUNCTION update_test_case_display_ids_on_prefix_change();
