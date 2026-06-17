create table if not exists public.wedding_photos (
  id text primary key,
  photo jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists wedding_photos_created_at_idx
  on public.wedding_photos (created_at desc);

alter table public.wedding_photos enable row level security;

drop policy if exists "Service role manages wedding photos" on public.wedding_photos;
create policy "Service role manages wedding photos"
  on public.wedding_photos
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
