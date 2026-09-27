-- Safe repair migration for projects where the initial schema was applied once
-- and then re-run. This migration never drops tables or deletes data.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, url text not null, feed_url text not null,
  enabled boolean not null default true, last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, feed_url)
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  canonical_url text not null, title text not null, author text, published_at timestamptz,
  excerpt text, content_hash text not null, normalized_title text not null,
  first_seen_at timestamptz not null default now(), selected boolean not null default false,
  duplicate_of uuid references public.articles(id),
  unique (workspace_id, canonical_url), unique (workspace_id, content_hash)
);

create table if not exists public.mission_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid references auth.users(id), trace_id text not null unique,
  status text not null default 'running' check (status in ('running','review','approved','rejected','failed')),
  quality_score integer check (quality_score between 0 and 100),
  input_tokens integer not null default 0, output_tokens integer not null default 0,
  estimated_cost_usd numeric(12,8) not null default 0,
  started_at timestamptz not null default now(), completed_at timestamptz
);

create table if not exists public.mission_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null references public.mission_runs(id) on delete cascade,
  trace_id text not null, kind text not null, actor text not null, target text not null,
  message text not null, duration_ms integer, tokens integer,
  created_at timestamptz not null default now()
);

create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null unique references public.mission_runs(id) on delete cascade,
  title text not null, markdown text not null,
  status text not null default 'draft' check (status in ('draft','approved','rejected')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  briefing_id uuid not null references public.briefings(id) on delete cascade,
  user_id uuid references auth.users(id), verdict text not null check (verdict in ('approved','rejected','edited')),
  rating integer check (rating between 1 and 5), reasons text[] not null default '{}',
  edited_markdown text, note text, created_at timestamptz not null default now()
);

create table if not exists public.editorial_memory (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  preferences jsonb not null default '{"preferred_topics":[],"avoid":[],"style_notes":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists articles_workspace_published_idx on public.articles(workspace_id, published_at desc);
create index if not exists articles_normalized_title_idx on public.articles(workspace_id, normalized_title);
create index if not exists mission_runs_workspace_started_idx on public.mission_runs(workspace_id, started_at desc);
create index if not exists mission_events_run_created_idx on public.mission_events(run_id, created_at);
create index if not exists mission_events_trace_idx on public.mission_events(trace_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.mission_runs enable row level security;
alter table public.mission_events enable row level security;
alter table public.briefings enable row level security;
alter table public.feedback enable row level security;
alter table public.editorial_memory enable row level security;

create or replace function public.is_workspace_member(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.workspace_members where workspace_id = target and user_id = auth.uid());
$$;

do $$
declare policy_name text;
begin
  foreach policy_name in array array[
    'workspace members read workspaces','authenticated create workspaces','members read membership',
    'users join workspaces','members manage sources','members read articles','members read runs',
    'members read events','members read briefings','members manage feedback','members read memory'
  ] loop
    execute format('drop policy if exists %I on public.%I', policy_name,
      case policy_name
        when 'workspace members read workspaces' then 'workspaces'
        when 'authenticated create workspaces' then 'workspaces'
        when 'members read membership' then 'workspace_members'
        when 'users join workspaces' then 'workspace_members'
        when 'members manage sources' then 'sources'
        when 'members read articles' then 'articles'
        when 'members read runs' then 'mission_runs'
        when 'members read events' then 'mission_events'
        when 'members read briefings' then 'briefings'
        when 'members manage feedback' then 'feedback'
        else 'editorial_memory'
      end);
  end loop;
end $$;

create policy "workspace members read workspaces" on public.workspaces for select using (public.is_workspace_member(id));
create policy "authenticated create workspaces" on public.workspaces for insert to authenticated with check (created_by = auth.uid());
create policy "members read membership" on public.workspace_members for select using (public.is_workspace_member(workspace_id) or user_id = auth.uid());
create policy "users join workspaces" on public.workspace_members for insert to authenticated with check (user_id = auth.uid());
create policy "members manage sources" on public.sources for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members read articles" on public.articles for select using (public.is_workspace_member(workspace_id));
create policy "members read runs" on public.mission_runs for select using (public.is_workspace_member(workspace_id));
create policy "members read events" on public.mission_events for select using (public.is_workspace_member(workspace_id));
create policy "members read briefings" on public.briefings for select using (public.is_workspace_member(workspace_id));
create policy "members manage feedback" on public.feedback for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());
create policy "members read memory" on public.editorial_memory for select using (public.is_workspace_member(workspace_id));

do $$ begin
  alter publication supabase_realtime add table public.mission_events;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.mission_runs;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.briefings;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
