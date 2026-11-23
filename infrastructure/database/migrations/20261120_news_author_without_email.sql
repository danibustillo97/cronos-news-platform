-- Bylines must never expose an editor's email address.
--
-- Older versions of the Noticias desk stored the signed-in editor's email as `author`
-- and `author_name`, which was then published on the article, in its OpenGraph and
-- JSON-LD metadata and as /creador/<email> pages. The site now hides email-shaped
-- bylines (lib/byline.ts), and this migration cleans the stored rows.
--
-- Review before running: it rewrites every email-shaped byline to the newsroom name
-- ("Nexus News", the same fallback the backend publisher and the site use). If some
-- editors should keep a personal byline, update their rows by author_id afterwards, e.g.
--   update public.news set author = 'Laura Gómez', author_name = 'Laura Gómez'
--   where author_id = '<uuid>';

begin;

update public.news
set author = 'Nexus News'
where author ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';

update public.news
set author_name = 'Nexus News'
where author_name ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';

-- Guard against regressions from any writer (desk, backend, scripts).
alter table public.news drop constraint if exists news_author_not_email;
alter table public.news
  add constraint news_author_not_email
  check (author is null or author !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  not valid;
alter table public.news validate constraint news_author_not_email;

commit;
