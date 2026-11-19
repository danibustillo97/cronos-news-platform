# Production Architecture

## Runtime topology

- **Vercel**: Next.js frontend and bounded API routes.
- **Supabase**: PostgreSQL, Auth, Storage, Realtime and RLS.
- **GitHub Actions**: scheduled and manually dispatched workers.
- **Python/LAB**: CLI and runner processes for editorial and media operations.
- **Local**: development and heavyweight render tools.

## Data flow

1. Server components and API routes use Supabase as the persistence adapter.
2. Public browser reads use the Supabase anon key with RLS.
3. Privileged backend and worker operations use `SUPABASE_SERVICE_ROLE_KEY` only on server processes.
4. Existing Python domain/application use cases remain the source for backend business rules.
5. Bounded Vercel routes must not start residents, queues or persistent file processing.
6. Scheduled and long-running work is invoked by GitHub Actions or local CLI processes against Supabase.

## Implemented boundaries

- FastAPI is retained for local compatibility and bounded API development.
- FastAPI no longer starts an in-process scheduled publication loop.
- Scheduled artifact publication uses `automation/run_scheduled_publications.py`.
- Supabase job tables remain the source of pending work.
