-- Clear Bid: user-scoped documents with RLS (Supabase / Postgres)
-- Run in Supabase SQL Editor (or via CLI migration).

create table if not exists public.user_documents (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (key in ('profile', 'pipeline', 'stats', 'ai_usage')),
  json jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists user_documents_user_id_idx on public.user_documents (user_id);

alter table public.user_documents enable row level security;

drop policy if exists "user_documents_select_own" on public.user_documents;
drop policy if exists "user_documents_insert_own" on public.user_documents;
drop policy if exists "user_documents_update_own" on public.user_documents;
drop policy if exists "user_documents_delete_own" on public.user_documents;

create policy "user_documents_select_own"
  on public.user_documents
  for select
  using (auth.uid() = user_id);

create policy "user_documents_insert_own"
  on public.user_documents
  for insert
  with check (auth.uid() = user_id);

create policy "user_documents_update_own"
  on public.user_documents
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_documents_delete_own"
  on public.user_documents
  for delete
  using (auth.uid() = user_id);

-- Harden: no grants to anon beyond RLS; authenticated can use own rows via RLS.
grant select, insert, update, delete on table public.user_documents to authenticated;
grant all on table public.user_documents to service_role;
