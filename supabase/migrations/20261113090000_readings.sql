-- Readings the CIS receives from Ovok over HL7 v2, one row per OBX value. A resend carries the same control id.
create table public.readings (
  control_id text not null,
  set_id integer not null,
  patient_id uuid not null references public.patients (id),
  code text not null,
  code_system text,
  display text,
  value numeric not null,
  unit text,
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key (control_id, set_id)
);

create index readings_patient_observed on public.readings (patient_id, observed_at desc);

-- No policies: only the service role, which the HL7 receiver uses, can read or write.
alter table public.readings enable row level security;
revoke all on public.readings from anon, authenticated;
