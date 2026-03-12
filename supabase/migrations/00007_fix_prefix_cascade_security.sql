-- Recreate the trigger function with SECURITY DEFINER so it bypasses RLS
-- when cascading prefix changes to test_cases.display_id via PostgREST.

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
