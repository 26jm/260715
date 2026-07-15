create table if not exists public.tutoring_memos (
  id uuid primary key,
  teacher_key text not null,
  date date not null,
  student_name text not null,
  progress text not null,
  memo text not null,
  created_at timestamptz not null default now()
);

alter table public.tutoring_memos enable row level security;

create policy "Allow public read for demo"
on public.tutoring_memos
for select
using (true);

create policy "Allow public insert for demo"
on public.tutoring_memos
for insert
with check (true);
