-- Export feature enums
CREATE TYPE export_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE export_format AS ENUM ('xlsx', 'google_sheets');
CREATE TYPE export_scope AS ENUM ('project', 'suite');
