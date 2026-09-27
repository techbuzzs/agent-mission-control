-- Safe repair migration: may be run after the partially applied initial schema.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null default 'basic' check (role in ('basic','admin','superuser')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "profiles readable by signed in users" on public.profiles;
create policy "profiles readable by signed in users" on public.profiles for select to authenticated using (true);

create or replace function public.current_role() returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 'basic')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.mission_runs drop constraint if exists mission_runs_status_check;
alter table public.mission_runs add constraint mission_runs_status_check check (status in ('running','review','approved','rejected','failed','cancelled'));

create table if not exists public.llm_interactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  run_id uuid references public.mission_runs(id) on delete cascade,
  trace_id text not null,
  stage text not null,
  provider text not null default 'openai',
  model text not null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  input_tokens integer default 0,
  output_tokens integer default 0,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists llm_interactions_run_idx on public.llm_interactions(run_id, created_at);
alter table public.llm_interactions enable row level security;
drop policy if exists "admins read llm interactions" on public.llm_interactions;
create policy "admins read llm interactions" on public.llm_interactions for select to authenticated using (public.current_role() in ('admin','superuser'));
