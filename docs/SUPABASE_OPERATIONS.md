# Supabase Operations

Apply SQL migrations manually in the Supabase SQL Editor or through the project's migration tooling. No migration in this repository is automatically destructive.

Before applying a migration:

1. Back up or export the affected schema.
2. Review the SQL diff.
3. Confirm RLS and existing policies.
4. Apply in staging first.

The worker lease migration is at `infrastructure/database/migrations/20261119_worker_lease.sql`. It adds lease metadata to existing job tables and indexes. It does not claim or delete jobs.

Storage buckets and RLS policies remain in `infrastructure/database/supabase_setup/`. Read the SQL files before applying, and do not disable RLS to resolve schema errors.
