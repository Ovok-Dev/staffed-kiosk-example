-- The patient register. Ovok holds only the pseudonym `id` and the readings.
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  card_code text not null unique,
  given_name text not null,
  family_name text not null,
  birth_date date not null,
  ovok_patient_id text unique,
  created_at timestamptz not null default now(),
  constraint card_code_format check (card_code ~ '^[A-Za-z0-9-]{4,64}$'),
  constraint given_name_length check (char_length(given_name) between 1 and 100),
  constraint family_name_length check (char_length(family_name) between 1 and 100)
);

-- No policies: only the service role, which the patients Edge Function uses, can read or write.
alter table public.patients enable row level security;
revoke all on public.patients from anon, authenticated;
