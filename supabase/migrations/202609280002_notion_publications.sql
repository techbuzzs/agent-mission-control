create table if not exists public.notion_publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  briefing_id uuid not null references public.briefings(id) on delete cascade,
  notion_page_id text not null,
  notion_url text not null,
  status text not null check (status in ('draft','final')),
  created_at timestamptz not null default now()
);
create index if not exists notion_publications_briefing_created_idx on public.notion_publications (briefing_id, created_at desc);
alter table public.notion_publications enable row level security;
create policy "members read notion publications" on public.notion_publications for select using (public.is_workspace_member(workspace_id));
