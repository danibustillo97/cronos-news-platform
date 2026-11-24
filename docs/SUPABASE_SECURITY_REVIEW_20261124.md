# CRONOS — Supabase security review (2026-11-24)

## Status

**Review draft only. Not applied to Supabase.**

The SQL proposal is:
`infrastructure/database/migrations/20261124d_security_lockdown.sql`

It is committed only to `feature/social-media-studio-v2`. The production project
`NEWS_DEPORT` (`mxvdnfaeqjifnxqmxbri`) has not been changed by this review.

## Live baseline

The live project is healthy, PostgreSQL 17.4.1, Free plan, us-east-2.

- 39 tables exist in the public schema; all are owned by `postgres`.
- 1 public table (`match_results`) had RLS disabled and contained 381 rows.
- Broad `anon` and `authenticated` table grants included SELECT, INSERT,
  UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER on most public tables.
- `news` had a permissive all-operations policy.
- Several internal workflow tables had `read_all`, `write_authenticated`, or
  `dev_all_access` policies.
- `tiktok_accounts` had an all-operations public policy.
- A single Auth user currently has `app_metadata.role = 'admin'`.
- The project has no views, materialized views, or foreign tables in `public`.
- Existing applied-migration history returned empty, despite SQL files being
  stored in the repository.

## Intended access model

| Resource | Intended browser access |
|---|---|
| `news` | Read published articles; admin metadata may also read drafts |
| `category_groups`, `categories`, `topics` | Public read-only |
| `ad_banners` | Read active banners only |
| `football_broadcast_matches` | Authenticated user CRUD on rows where `user_id = auth.uid()` |
| `site_analytics_events` | Insert through the validated/rate-limited public RPC only |
| Analytics dashboard | Authenticated admin only |
| Editorial, discovery, production, jobs, assets, social credentials, settings | No direct anon/authenticated SQL access; use backend/service role |
| Storage `media` bucket | Public read; upload through admin-protected signed-upload flow |

The migration does not delete or rewrite rows.

## Expected application impact

- Existing public news and taxonomy reads stay available.
- The football broadcaster keeps per-user persistence.
- Direct client access to `match_results` is disabled. The active sports API
  already reads live scoreboard/standings data through the FastAPI ESPN proxy;
  the old direct Supabase widget has no active component reference.
- Editorial/admin CRUD is expected to continue through FastAPI and Next server
  routes using `SUPABASE_SECRET_KEY`.
- Polls, radio and TikTok routes use the backend/server service-role client.
- Public analytics event collection stays available through its RPC wrapper;
  analytics dashboard RPC checks trusted `app_metadata.role`.
- Storage browser uploads that bypass the admin backend are intentionally
  disabled. Radio upload URLs are issued by an admin-protected backend route.
  Supabase documents signed upload URLs as usable without a second authentication
  step.

## Preconditions before production execution

1. Confirm `cronos_private` is not included in Supabase Data API exposed schemas.
2. Confirm Vercel Production and GitHub workers use the server-only
   `SUPABASE_SECRET_KEY`, never a publishable key for privileged writes.
3. Confirm the admin session has a refreshed JWT with `app_metadata.role=admin`.
4. Schedule a quiet rollout window and have a current recoverable backup.
5. Execute only after reviewing the full SQL and confirming this exact draft.

## Post-apply checks

- Re-run Security and Performance Advisors.
- Verify the public site's news pages, sitemap, categories and active banners.
- Verify admin editorial, discovery, production, publication and radio workflows.
- Verify the broadcaster can save/load only its own workspace.
- Verify anonymous analytics events can be recorded and the analytics dashboard
  is denied to non-admins and allowed to admins.
- Verify signed media upload, public media playback and rejection of direct
  browser writes.
- Verify RLS is on for every public table and no client grants remain except on
  the approved public-read and user-owned resources.

## Separate issues not solved by this migration

- **TikTok schema mismatch:** live `tiktok_accounts` lacks `user_id`,
  `access_token_encrypted`, and `refresh_token_encrypted`, while Next server
  routes expect them. It currently has no rows. This needs its own reviewed
  schema and OAuth storage migration.
- Auth leaked-password protection and MFA options need Dashboard configuration.
- Supabase flagged PostgreSQL 17.4.1 for available security patches; plan a
  maintenance upgrade with compatibility checks.
- Performance work remains: 9 unindexed foreign keys, 24 indexes flagged as
  unused, and query/RLS initialization-plan findings. Do not remove indexes
  solely from the unused-index linter; review query workload first.
- Migration history is not reconciled. A separate migration-history baseline
  plan is needed before relying on automated migration ordering.

## Superseded proposals

- `20261119_security_rls_storage.sql` is marked **SUPERSEDED — DO NOT EXECUTE**.
- `docs/SUPABASE_RLS_PROPOSED_POLICIES.md` is marked **SUPERSEDED — DO NOT EXECUTE**.

The replacement draft is not an automatic deployment step and is not run by CI.
