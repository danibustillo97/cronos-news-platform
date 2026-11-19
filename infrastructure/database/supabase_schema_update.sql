-- SQL Migration Script for Nexus News Advanced Features

-- 1. Create Stories Table for TikTok Integration
create table if not exists public.stories (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  thumbnail_url text,
  tiktok_id text not null,
  author text default 'Nexus Sports',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  views bigint default 0
);

-- 2. Add Views Column to News Table (if not exists)
alter table public.news add column if not exists views bigint default 0;

-- 3. Enable Row Level Security (RLS)
alter table public.stories enable row level security;

-- 4. Create Policies for Stories
-- Allow public read access
create policy "Public stories are viewable by everyone" 
  on public.stories for select 
  using (true);

-- Allow authenticated users (admins) to insert/update/delete
create policy "Admins can insert stories" 
  on public.stories for insert 
  with check (auth.role() = 'authenticated');

create policy "Admins can update stories" 
  on public.stories for update 
  using (auth.role() = 'authenticated');

create policy "Admins can delete stories" 
  on public.stories for delete 
  using (auth.role() = 'authenticated');

-- 5. Optional: Function for atomic view increment (recommended)
create or replace function increment_news_view(row_id uuid)
returns void as $$
begin
  update public.news
  set views = coalesce(views, 0) + 1
  where id = row_id;
end;
$$ language plpgsql;

-- 6. Grant execute permissions (if needed)
grant execute on function increment_news_view to public;
grant execute on function increment_news_view to anon;
grant execute on function increment_news_view to authenticated;
