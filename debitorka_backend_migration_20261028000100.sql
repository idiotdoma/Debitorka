-- Debitorka server backend v1
-- Supabase Auth + PostgreSQL + RLS. Apply to a NEW Supabase project first.
-- Never put the Supabase service_role key in Vite/client code.

begin;

-- Prevent untrusted application roles from creating objects in a SECURITY DEFINER search_path.
revoke create on schema public from public, anon, authenticated;

create schema if not exists extensions;
revoke create on schema extensions from public, anon, authenticated;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Common helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Prevent accidental storage of credentials inside ordinary integration config JSON.
create or replace function public.jsonb_contains_secret_key(p_value jsonb)
returns boolean
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare v_key text; v_item jsonb;
begin
  if p_value is null then return false; end if;
  if jsonb_typeof(p_value) = 'object' then
    for v_key, v_item in select key, value from jsonb_each(p_value) loop
      if lower(v_key) ~ '(password|passwd|secret|token|api.?key|authorization|bearer|private.?key|client.?secret)' then
        return true;
      end if;
      if public.jsonb_contains_secret_key(v_item) then return true; end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for v_item in select value from jsonb_array_elements(p_value) loop
      if public.jsonb_contains_secret_key(v_item) then return true; end if;
    end loop;
  end if;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity, organizations and membership
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  position text,
  timezone text not null default 'Europe/Moscow',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_lowercase check (email = lower(email))
);

create unique index if not exists profiles_email_lower_idx on public.profiles (lower(email));

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 180),
  timezone text not null default 'Europe/Moscow',
  stale_data_threshold_hours integer not null default 24 check (stale_data_threshold_hours between 1 and 8760),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','finance','employee','viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists org_memberships_user_active_idx on public.organization_memberships(user_id, is_active);
create index if not exists org_memberships_org_role_idx on public.organization_memberships(organization_id, role, is_active);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  description text,
  manager_id uuid references auth.users(id) on delete set null,
  parent_id uuid references public.teams(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (id, organization_id)
);

create index if not exists teams_org_idx on public.teams(organization_id);
create index if not exists teams_manager_idx on public.teams(manager_id);

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (team_id, organization_id) references public.teams(id, organization_id) on delete cascade,
  unique (team_id, user_id)
);

create index if not exists team_memberships_user_idx on public.team_memberships(user_id, organization_id);

-- ---------------------------------------------------------------------------
-- Business data
-- ---------------------------------------------------------------------------
create table if not exists public.counterparties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_id text,
  name text not null check (length(btrim(name)) between 1 and 300),
  normalized_name text generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored,
  inn text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, external_id)
);

create index if not exists counterparties_org_name_idx on public.counterparties(organization_id, normalized_name);
create index if not exists counterparties_org_inn_idx on public.counterparties(organization_id, inn);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  file_name text not null,
  file_hash text,
  source_type text not null default 'manual_import' check (source_type in ('manual_import','onec_odata','custom_http')),
  row_count integer not null default 0 check (row_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  new_count integer not null default 0 check (new_count >= 0),
  missing_from_source integer not null default 0 check (missing_from_source >= 0),
  status text not null default 'preview' check (status in ('preview','completed','completed_with_warnings','failed','partial')),
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  imported_by uuid references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create index if not exists import_batches_org_date_idx on public.import_batches(organization_id, created_at desc);
create unique index if not exists import_batches_filehash_unique on public.import_batches(organization_id, file_hash) where file_hash is not null and status in ('completed','completed_with_warnings');

create table if not exists public.debt_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_batch_id uuid,
  counterparty_id uuid references public.counterparties(id) on delete set null,
  external_id text,
  document_key text not null,
  counterparty_name text not null,
  counterparty_inn text,
  doc_number text not null,
  doc_date date,
  due_date date,
  amount_cents bigint not null,
  currency text not null default 'RUB' check (currency ~ '^[A-Z]{3}$'),
  owner_email text,
  notes text,
  source_type text not null default 'manual_import' check (source_type in ('manual_import','onec_odata','custom_http')),
  source_updated_at timestamptz,
  last_source_update timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (import_batch_id, organization_id) references public.import_batches(id, organization_id) on delete restrict,
  unique (organization_id, document_key),
  unique (organization_id, source_type, external_id)
);

create index if not exists debt_records_org_due_idx on public.debt_records(organization_id, due_date);
create index if not exists debt_records_org_counterparty_idx on public.debt_records(organization_id, counterparty_id);
create index if not exists debt_records_org_amount_idx on public.debt_records(organization_id, amount_cents desc);
create index if not exists debt_records_org_name_idx on public.debt_records(organization_id, lower(counterparty_name));

create table if not exists public.counterparty_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  counterparty_id uuid references public.counterparties(id) on delete cascade,
  counterparty_name text,
  assigned_to uuid not null references auth.users(id),
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  check (counterparty_id is not null or nullif(btrim(counterparty_name), '') is not null)
);

create unique index if not exists counterparty_assignment_by_id_unique on public.counterparty_assignments(organization_id, counterparty_id, assigned_to) where counterparty_id is not null;
create unique index if not exists counterparty_assignment_by_name_unique on public.counterparty_assignments(organization_id, lower(btrim(counterparty_name)), assigned_to) where counterparty_id is null and counterparty_name is not null;
create index if not exists counterparty_assignment_assignee_idx on public.counterparty_assignments(organization_id, assigned_to);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid,
  title text not null check (length(btrim(title)) between 1 and 240),
  description text,
  type text not null default 'other' check (type in ('call_counterparty','send_payment_reminder','check_payment_status','verify_promise','prepare_claim_docs','internal_review','other')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  status text not null default 'new' check (status in ('new','in_progress','waiting','completed','cancelled')),
  counterparty_id uuid references public.counterparties(id) on delete set null,
  counterparty_name text,
  debt_record_id uuid references public.debt_records(id) on delete set null,
  assigned_to uuid not null references auth.users(id),
  created_by uuid not null references auth.users(id),
  due_date timestamptz not null,
  completed_at timestamptz,
  result text,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_id, organization_id) references public.teams(id, organization_id) on delete restrict
);

create index if not exists tasks_org_due_idx on public.tasks(organization_id, due_date, status);
create index if not exists tasks_assignee_idx on public.tasks(organization_id, assigned_to, status, due_date);
create index if not exists tasks_team_idx on public.tasks(organization_id, team_id, status, due_date);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  counterparty_id uuid references public.counterparties(id) on delete set null,
  counterparty_name text not null,
  debt_record_id uuid references public.debt_records(id) on delete set null,
  type text not null check (type in ('outgoing_call','incoming_call','outgoing_email','incoming_email','messenger','meeting','other')),
  direction text not null default 'neutral' check (direction in ('incoming','outgoing','neutral')),
  contact_date timestamptz not null,
  employee_id uuid not null references auth.users(id),
  summary text not null check (length(btrim(summary)) between 1 and 5000),
  result text check (result is null or result in ('confirmed_payment','promised_payment','documents_requested','failed_to_contact','disputes_debt','payment_not_approved','needs_follow_up','other')),
  result_comment text,
  next_contact_date date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communications_org_counterparty_date_idx on public.communications(organization_id, counterparty_id, contact_date desc);
create index if not exists communications_employee_idx on public.communications(organization_id, employee_id, contact_date desc);

create table if not exists public.payment_promises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  counterparty_id uuid references public.counterparties(id) on delete set null,
  counterparty_name text not null,
  debt_record_id uuid references public.debt_records(id) on delete set null,
  promised_date date not null,
  promised_amount_cents bigint not null check (promised_amount_cents > 0),
  currency text not null default 'RUB' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'expected' check (status in ('expected','fulfilled','partially_fulfilled','broken','cancelled')),
  source text not null default 'other' check (source in ('call','email','messenger','meeting','other')),
  contact_name text not null,
  employee_id uuid not null references auth.users(id),
  comment text,
  actual_received_cents bigint check (actual_received_cents is null or actual_received_cents >= 0),
  actual_receipt_verified boolean not null default false,
  last_check_date date,
  transfer_history jsonb not null default '[]'::jsonb,
  cancellation_reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promises_org_date_status_idx on public.payment_promises(organization_id, promised_date, status);
create index if not exists promises_employee_idx on public.payment_promises(organization_id, employee_id, promised_date);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('task_due_soon','task_overdue','promise_due','promise_broken','task_no_action','critical_task_escalation','new_task_assigned','promise_needs_check')),
  title text not null,
  message text not null,
  related_task_id uuid references public.tasks(id) on delete set null,
  related_promise_id uuid references public.payment_promises(id) on delete set null,
  related_debt_id uuid references public.debt_records(id) on delete set null,
  related_counterparty text,
  is_read boolean not null default false,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, recipient_id, idempotency_key)
);

create index if not exists notifications_recipient_idx on public.notifications(recipient_id, is_read, created_at desc);

create table if not exists public.counterparty_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  counterparty_id uuid references public.counterparties(id) on delete cascade,
  counterparty_name text not null,
  note text not null check (length(btrim(note)) between 1 and 10000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.imported_data_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_key text not null,
  snapshot_date timestamptz not null default now(),
  import_batch_id uuid references public.import_batches(id) on delete set null,
  source_type text not null default 'manual_import' check (source_type in ('manual_import','onec_odata','custom_http')),
  total_debt_cents bigint not null default 0,
  overdue_debt_cents bigint not null default 0,
  documents_count integer not null default 0,
  overdue_documents_count integer not null default 0,
  currency text not null default 'RUB',
  data jsonb not null default '[]'::jsonb,
  is_complete boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, snapshot_key)
);

create index if not exists imported_snapshots_org_date_idx on public.imported_data_snapshots(organization_id, snapshot_date desc);

create table if not exists public.data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  issue_key text not null,
  type text not null check (type in ('missing_due_date','duplicate','missing_counterparty','invalid_amount','invalid_date','unknown_currency','outdated_data','source_conflict','missing_required_field','manual_review')),
  severity text not null check (severity in ('error','warning','info')),
  debt_record_id uuid references public.debt_records(id) on delete set null,
  description text not null,
  source_type text,
  status text not null default 'open' check (status in ('open','reviewed','resolved','ignored')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, issue_key)
);

create index if not exists data_quality_org_status_idx on public.data_quality_issues(organization_id, status, severity, detected_at desc);

create table if not exists public.saved_report_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  report_type text not null,
  filters jsonb not null default '{}'::jsonb,
  sort_by text,
  sort_direction text not null default 'asc' check (sort_direction in ('asc','desc')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, name)
);

-- Integration metadata never stores passwords or API tokens.
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null check (source_type in ('onec_odata','custom_http','manual_import')),
  name text not null,
  endpoint text not null,
  status text not null default 'not_configured' check (status in ('not_configured','configured','verification_failed','ready_for_preview','ready_for_sync','temporarily_unavailable','requires_admin_intervention')),
  config jsonb not null default '{}'::jsonb check (not public.jsonb_contains_secret_key(config)),
  field_mapping jsonb not null default '{}'::jsonb check (not public.jsonb_contains_secret_key(field_mapping)),
  credentials_secret_ref text,
  credentials_status text not null default 'not_set' check (credentials_status in ('not_set','set','expired','invalid')),
  schedule_interval_hours integer check (schedule_interval_hours is null or schedule_interval_hours in (1,6,12,24)),
  next_scheduled_sync timestamptz,
  sync_paused boolean not null default true,
  last_successful_sync timestamptz,
  last_attempt_at timestamptz,
  last_sync_duration_ms bigint,
  last_error_message text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists integration_connections_org_idx on public.integration_connections(organization_id);

create table if not exists public.sync_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.integration_connections(id) on delete set null,
  source_type text not null check (source_type in ('onec_odata','custom_http','manual_import')),
  trigger_type text not null default 'manual' check (trigger_type in ('manual','scheduled','initial')),
  status text not null check (status in ('queued','running','success','success_with_warnings','failed','cancelled','requires_manual_intervention')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms bigint,
  initiated_by uuid references auth.users(id),
  total_records integer not null default 0,
  new_records integer not null default 0,
  updated_records integer not null default 0,
  unchanged_records integer not null default 0,
  error_records integer not null default 0,
  requires_review_records integer not null default 0,
  total_outstanding_cents bigint not null default 0,
  currency text not null default 'RUB',
  summary text,
  error_message text,
  warnings jsonb not null default '[]'::jsonb,
  batch_id uuid references public.import_batches(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sync_history_org_date_idx on public.sync_history(organization_id, started_at desc);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','manager','finance','employee','viewer')),
  team_id uuid,
  status text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_id, organization_id) references public.teams(id, organization_id) on delete restrict
);

create index if not exists invitations_org_status_idx on public.invitations(organization_id, status, created_at desc);
create unique index if not exists invitations_one_pending_email on public.invitations(organization_id, lower(email)) where status = 'pending';

-- Secret token hashes are stored separately and never exposed to authenticated clients.
create table if not exists public.invitation_secrets (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  old_value jsonb,
  new_value jsonb,
  comment text,
  request_id text
);

create index if not exists audit_org_date_idx on public.activity_audit(organization_id, changed_at desc);
create index if not exists audit_actor_idx on public.activity_audit(organization_id, changed_by, changed_at desc);

-- ---------------------------------------------------------------------------
-- Common triggers
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_debitorka on auth.users;
create trigger on_auth_user_created_debitorka
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(coalesce(new.email, '')), updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed_debitorka on auth.users;
create trigger on_auth_user_email_changed_debitorka
after update of email on auth.users
for each row execute function public.handle_auth_user_email_change();

create or replace function public.validate_timezone_name()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.timezone is null or not exists (select 1 from pg_timezone_names z where z.name = new.timezone) then
    raise exception 'INVALID_TIMEZONE';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_profile_timezone on public.profiles;
create trigger validate_profile_timezone before insert or update of timezone on public.profiles
for each row execute function public.validate_timezone_name();
drop trigger if exists validate_organization_timezone on public.organizations;
create trigger validate_organization_timezone before insert or update of timezone on public.organizations
for each row execute function public.validate_timezone_name();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','organizations','organization_memberships','teams','counterparties','import_batches',
    'debt_records','tasks','communications','payment_promises','counterparty_notes','data_quality_issues',
    'saved_report_views','integration_connections','invitations'
  ] LOOP
    EXECUTE format('drop trigger if exists set_updated_at on public.%I', t);
    EXECUTE format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  END LOOP;
END;
$$;

-- Prevent a row from being moved to another tenant by editing organization_id.
create or replace function public.prevent_organization_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'ORGANIZATION_ID_IMMUTABLE';
  end if;
  return new;
end;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organization_memberships','teams','team_memberships','counterparties','import_batches','debt_records',
    'counterparty_assignments','tasks','communications','payment_promises','notifications','counterparty_notes',
    'imported_data_snapshots','data_quality_issues','saved_report_views','integration_connections','sync_history',
    'invitations','activity_audit'
  ] LOOP
    EXECUTE format('drop trigger if exists prevent_organization_change on public.%I', t);
    EXECUTE format('create trigger prevent_organization_change before update on public.%I for each row execute function public.prevent_organization_change()', t);
  END LOOP;
END;
$$;

-- Audit important operational changes without allowing clients to edit/delete audit rows.
create or replace function public.audit_operational_row_change()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_id uuid;
  v_action text;
  v_old jsonb;
  v_new jsonb;
begin
  if TG_OP = 'DELETE' then
    v_org := old.organization_id;
    v_id := old.id;
    v_action := 'deleted';
    v_old := to_jsonb(old) - array['note','summary','description','result_comment','comment','config','field_mapping'];
  elsif TG_OP = 'INSERT' then
    v_org := new.organization_id;
    v_id := new.id;
    v_action := 'created';
    v_new := to_jsonb(new) - array['note','summary','description','result_comment','comment','config','field_mapping'];
  else
    v_org := new.organization_id;
    v_id := new.id;
    v_action := 'updated';
    v_old := to_jsonb(old) - array['note','summary','description','result_comment','comment','config','field_mapping'];
    v_new := to_jsonb(new) - array['note','summary','description','result_comment','comment','config','field_mapping'];
  end if;
  insert into public.activity_audit(organization_id, entity_type, entity_id, action, changed_by, old_value, new_value)
  values (v_org, TG_TABLE_NAME, v_id, v_action, auth.uid(), v_old, v_new);
  if TG_OP = 'DELETE' then return old; else return new; end if;
end;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tasks','communications','payment_promises','counterparties','counterparty_assignments','counterparty_notes','data_quality_issues','integration_connections','teams'] LOOP
    EXECUTE format('drop trigger if exists audit_operational_change on public.%I', t);
    EXECUTE format('create trigger audit_operational_change after insert or update or delete on public.%I for each row execute function public.audit_operational_row_change()', t);
  END LOOP;
END;
$$;

-- Validate team references cannot cross organization boundaries.
create or replace function public.validate_team_relations()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.manager_id is not null and not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = new.organization_id and m.user_id = new.manager_id and m.is_active and m.role = 'manager'
  ) then raise exception 'TEAM_MANAGER_MUST_BE_ACTIVE_MANAGER_IN_ORGANIZATION'; end if;
  if new.parent_id is not null and not exists (
    select 1 from public.teams t where t.id = new.parent_id and t.organization_id = new.organization_id
  ) then raise exception 'PARENT_TEAM_MUST_BE_SAME_ORGANIZATION'; end if;
  return new;
end;
$$;
drop trigger if exists validate_team_relations on public.teams;
create trigger validate_team_relations before insert or update on public.teams for each row execute function public.validate_team_relations();

-- Validate optional references to counterparties, debts and teams stay inside the same organization.
create or replace function public.validate_business_org_references()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if TG_TABLE_NAME = 'debt_records' then
    if new.counterparty_id is not null and not exists(select 1 from public.counterparties c where c.id=new.counterparty_id and c.organization_id=new.organization_id) then raise exception 'COUNTERPARTY_ORG_MISMATCH'; end if;
  elsif TG_TABLE_NAME = 'counterparty_assignments' then
    if new.counterparty_id is not null and not exists(select 1 from public.counterparties c where c.id=new.counterparty_id and c.organization_id=new.organization_id) then raise exception 'COUNTERPARTY_ORG_MISMATCH'; end if;
    if not exists(select 1 from public.organization_memberships m where m.organization_id=new.organization_id and m.user_id=new.assigned_to and m.is_active) then raise exception 'ASSIGNEE_MUST_BE_ACTIVE_ORG_MEMBER'; end if;
  elsif TG_TABLE_NAME = 'communications' or TG_TABLE_NAME = 'payment_promises' then
    if new.counterparty_id is not null and not exists(select 1 from public.counterparties c where c.id=new.counterparty_id and c.organization_id=new.organization_id) then raise exception 'COUNTERPARTY_ORG_MISMATCH'; end if;
    if new.debt_record_id is not null and not exists(select 1 from public.debt_records d where d.id=new.debt_record_id and d.organization_id=new.organization_id) then raise exception 'DEBT_ORG_MISMATCH'; end if;
  elsif TG_TABLE_NAME = 'counterparty_notes' then
    if new.counterparty_id is not null and not exists(select 1 from public.counterparties c where c.id=new.counterparty_id and c.organization_id=new.organization_id) then raise exception 'COUNTERPARTY_ORG_MISMATCH'; end if;
  elsif TG_TABLE_NAME = 'notifications' then
    if new.related_task_id is not null and not exists(select 1 from public.tasks t where t.id=new.related_task_id and t.organization_id=new.organization_id) then raise exception 'TASK_ORG_MISMATCH'; end if;
    if new.related_promise_id is not null and not exists(select 1 from public.payment_promises p where p.id=new.related_promise_id and p.organization_id=new.organization_id) then raise exception 'PROMISE_ORG_MISMATCH'; end if;
    if new.related_debt_id is not null and not exists(select 1 from public.debt_records d where d.id=new.related_debt_id and d.organization_id=new.organization_id) then raise exception 'DEBT_ORG_MISMATCH'; end if;
  elsif TG_TABLE_NAME = 'tasks' then
    if new.counterparty_id is not null and not exists(select 1 from public.counterparties c where c.id=new.counterparty_id and c.organization_id=new.organization_id) then raise exception 'COUNTERPARTY_ORG_MISMATCH'; end if;
    if new.debt_record_id is not null and not exists(select 1 from public.debt_records d where d.id=new.debt_record_id and d.organization_id=new.organization_id) then raise exception 'DEBT_ORG_MISMATCH'; end if;
    if new.team_id is not null and not exists(select 1 from public.teams t where t.id=new.team_id and t.organization_id=new.organization_id) then raise exception 'TEAM_ORG_MISMATCH'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.protect_sensitive_fields()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if TG_TABLE_NAME = 'teams' then
    if public.current_org_role(old.organization_id) = 'manager'
       and (new.manager_id is distinct from old.manager_id
         or new.parent_id is distinct from old.parent_id
         or new.created_by is distinct from old.created_by) then
      raise exception 'TEAM_MANAGER_CANNOT_CHANGE_PROTECTED_FIELDS';
    end if;
  elsif TG_TABLE_NAME = 'tasks' then
    if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'TASK_CREATOR_FIELDS_IMMUTABLE';
    end if;
  elsif TG_TABLE_NAME = 'payment_promises' then
    if new.created_by is distinct from old.created_by
       or new.employee_id is distinct from old.employee_id
       or new.created_at is distinct from old.created_at then
      raise exception 'PROMISE_CREATOR_FIELDS_IMMUTABLE';
    end if;
    if new.actual_receipt_verified is true and old.actual_receipt_verified is distinct from true
       and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
      raise exception 'ONLY_TRUSTED_BACKEND_CAN_VERIFY_RECEIPT';
    end if;
  elsif TG_TABLE_NAME = 'communications' then
    if new.created_by is distinct from old.created_by
       or new.employee_id is distinct from old.employee_id
       or new.created_at is distinct from old.created_at then
      raise exception 'COMMUNICATION_CREATOR_FIELDS_IMMUTABLE';
    end if;
  elsif TG_TABLE_NAME = 'counterparty_assignments' then
    if new.assigned_by is distinct from old.assigned_by or new.assigned_at is distinct from old.assigned_at then
      raise exception 'ASSIGNMENT_AUDIT_FIELDS_IMMUTABLE';
    end if;
  elsif TG_TABLE_NAME = 'counterparty_notes' then
    if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'NOTE_CREATOR_FIELDS_IMMUTABLE';
    end if;
  elsif TG_TABLE_NAME = 'integration_connections' then
    if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'INTEGRATION_CREATOR_FIELDS_IMMUTABLE';
    end if;
  end if;
  return new;
end;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['teams','tasks','payment_promises','communications','counterparty_assignments','counterparty_notes','integration_connections'] LOOP
    EXECUTE format('drop trigger if exists protect_sensitive_fields on public.%I', t);
    EXECUTE format('create trigger protect_sensitive_fields before update on public.%I for each row execute function public.protect_sensitive_fields()', t);
  END LOOP;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['debt_records','counterparty_assignments','communications','payment_promises','counterparty_notes','tasks','notifications'] LOOP
    EXECUTE format('drop trigger if exists validate_business_org_references on public.%I', t);
    EXECUTE format('create trigger validate_business_org_references before insert or update on public.%I for each row execute function public.validate_business_org_references()', t);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Security-definer helper functions used by RLS policies
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists(select 1 from public.platform_admins pa where pa.user_id = auth.uid());
$$;

create or replace function public.current_org_role(p_organization_id uuid)
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.organization_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.is_active = true
  limit 1;
$$;

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = auth.uid() and m.is_active = true
  );
$$;

create or replace function public.has_org_role(p_organization_id uuid, p_roles text[])
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_org_role(p_organization_id) = any(p_roles), false);
$$;

create or replace function public.can_view_member(p_organization_id uuid, p_target_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    p_target_user_id = auth.uid()
    or public.has_org_role(p_organization_id, array['owner','admin'])
    or (
      public.current_org_role(p_organization_id) = 'manager'
      and exists (
        select 1
        from public.teams t
        join public.team_memberships tm on tm.team_id = t.id and tm.organization_id = t.organization_id
        where t.organization_id = p_organization_id
          and t.manager_id = auth.uid()
          and tm.user_id = p_target_user_id
      )
    );
$$;

create or replace function public.can_manage_team(p_organization_id uuid, p_team_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.has_org_role(p_organization_id, array['owner','admin'])
    or exists (
      select 1 from public.teams t
      where t.id = p_team_id and t.organization_id = p_organization_id and t.manager_id = auth.uid()
        and public.current_org_role(p_organization_id) = 'manager'
    );
$$;

create or replace function public.can_read_counterparty(p_organization_id uuid, p_counterparty_id uuid, p_counterparty_name text default null)
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_role text;
begin
  v_role := public.current_org_role(p_organization_id);
  if v_role is null then return false; end if;
  if v_role in ('owner','admin','finance','viewer') then return true; end if;
  if v_role = 'employee' then
    return exists (
      select 1 from public.counterparty_assignments ca
      where ca.organization_id = p_organization_id and ca.assigned_to = auth.uid()
        and (
          (p_counterparty_id is not null and ca.counterparty_id = p_counterparty_id)
          or (p_counterparty_id is null and p_counterparty_name is not null and ca.counterparty_id is null
              and lower(btrim(ca.counterparty_name)) = lower(btrim(p_counterparty_name)))
        )
    );
  end if;
  if v_role = 'manager' then
    return exists (
      select 1 from public.counterparty_assignments ca
      where ca.organization_id = p_organization_id
        and (
          (p_counterparty_id is not null and ca.counterparty_id = p_counterparty_id)
          or (p_counterparty_id is null and p_counterparty_name is not null and ca.counterparty_id is null
              and lower(btrim(ca.counterparty_name)) = lower(btrim(p_counterparty_name)))
        )
        and (
          ca.assigned_to = auth.uid()
          or exists (
            select 1 from public.teams t
            join public.team_memberships tm on tm.team_id = t.id and tm.organization_id = t.organization_id
            where t.organization_id = p_organization_id and t.manager_id = auth.uid() and tm.user_id = ca.assigned_to
          )
        )
    );
  end if;
  return false;
end;
$$;

create or replace function public.can_read_debt(p_organization_id uuid, p_counterparty_id uuid, p_counterparty_name text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.can_read_counterparty(p_organization_id, p_counterparty_id, p_counterparty_name);
$$;

create or replace function public.can_read_task(p_organization_id uuid, p_assigned_to uuid, p_team_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_role text;
begin
  v_role := public.current_org_role(p_organization_id);
  if v_role is null then return false; end if;
  if v_role in ('owner','admin','finance','viewer') then return true; end if;
  if v_role = 'employee' then return p_assigned_to = auth.uid(); end if;
  if v_role = 'manager' then
    return p_assigned_to = auth.uid()
      or exists(select 1 from public.teams t where t.id = p_team_id and t.organization_id = p_organization_id and t.manager_id = auth.uid())
      or exists (
        select 1 from public.teams t
        join public.team_memberships tm on tm.team_id = t.id and tm.organization_id = t.organization_id
        where t.organization_id = p_organization_id and t.manager_id = auth.uid()
          and tm.user_id = p_assigned_to and (p_team_id is null or t.id = p_team_id)
      );
  end if;
  return false;
end;
$$;

create or replace function public.can_assign_to_user(p_organization_id uuid, p_assigned_to uuid, p_team_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_role text;
begin
  v_role := public.current_org_role(p_organization_id);
  if v_role in ('owner','admin','finance') then
    return exists(select 1 from public.organization_memberships m where m.organization_id = p_organization_id and m.user_id = p_assigned_to and m.is_active);
  elsif v_role = 'manager' then
    if p_assigned_to = auth.uid() then
      return p_team_id is null or exists (
        select 1 from public.teams t where t.id = p_team_id and t.organization_id = p_organization_id and t.manager_id = auth.uid()
      );
    end if;
    return p_team_id is not null and exists (
      select 1 from public.teams t
      join public.team_memberships tm on tm.team_id = t.id and tm.organization_id = t.organization_id
      join public.organization_memberships m on m.organization_id = tm.organization_id and m.user_id = tm.user_id and m.is_active
      where t.organization_id = p_organization_id and t.id = p_team_id and t.manager_id = auth.uid() and tm.user_id = p_assigned_to
    );
  elsif v_role = 'employee' then
    return p_assigned_to = auth.uid() and (p_team_id is null or exists (
      select 1 from public.team_memberships tm where tm.organization_id = p_organization_id and tm.team_id = p_team_id and tm.user_id = auth.uid()
    ));
  end if;
  return false;
end;
$$;

create or replace function public.can_manage_counterparty(p_organization_id uuid, p_counterparty_id uuid, p_counterparty_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if public.has_org_role(p_organization_id, array['owner','admin','finance']) then return true; end if;
  return public.can_read_counterparty(p_organization_id, p_counterparty_id, p_counterparty_name)
    and public.current_org_role(p_organization_id) in ('manager','employee');
end;
$$;

create or replace function public.can_manage_task(p_organization_id uuid, p_assigned_to uuid, p_team_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if public.has_org_role(p_organization_id, array['owner','admin','finance']) then return true; end if;
  return public.can_read_task(p_organization_id, p_assigned_to, p_team_id)
    and public.current_org_role(p_organization_id) in ('manager','employee');
end;
$$;

-- ---------------------------------------------------------------------------
-- Safe server-side RPC: create an organization and its first owner
-- ---------------------------------------------------------------------------
create or replace function public.create_organization_for_current_user(p_name text, p_timezone text default 'Europe/Moscow')
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare v_user_id uuid; v_org public.organizations%rowtype;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(btrim(coalesce(p_name,''))) < 2 or length(btrim(p_name)) > 180 then raise exception 'INVALID_ORGANIZATION_NAME'; end if;
  if not exists(select 1 from pg_timezone_names z where z.name = coalesce(nullif(p_timezone,''),'Europe/Moscow')) then raise exception 'INVALID_TIMEZONE'; end if;
  insert into public.organizations(name, timezone, created_by)
  values (btrim(p_name), coalesce(nullif(p_timezone,''),'Europe/Moscow'), v_user_id)
  returning * into v_org;
  insert into public.organization_memberships(organization_id, user_id, role, is_active)
  values (v_org.id, v_user_id, 'owner', true);
  insert into public.activity_audit(organization_id, entity_type, entity_id, action, changed_by, new_value, comment)
  values (v_org.id, 'organization', v_org.id, 'created', v_user_id,
          jsonb_build_object('name', v_org.name, 'role', 'owner'), 'Organization created by authenticated user');
  return jsonb_build_object('id', v_org.id, 'name', v_org.name, 'timezone', v_org.timezone, 'role', 'owner');
end;
$$;

-- ---------------------------------------------------------------------------
-- Safe invitation RPCs. Raw invitation token is returned once to an authorised inviter.
-- Prefer /accept-invitation#token=<token> so the one-time token is not sent in HTTP requests/referrer headers.
-- ---------------------------------------------------------------------------
create or replace function public.create_org_invitation(p_organization_id uuid, p_email text, p_role text, p_team_id uuid default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_caller_role text;
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_token text;
  v_token_hash text;
  v_inv public.invitations%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  v_caller_role := public.current_org_role(p_organization_id);
  if v_caller_role is null then raise exception 'ORG_ACCESS_DENIED'; end if;
  if p_role not in ('admin','manager','finance','employee','viewer') then raise exception 'INVALID_INVITATION_ROLE'; end if;
  if v_caller_role not in ('owner','admin','manager') then raise exception 'INVITE_FORBIDDEN'; end if;
  if v_caller_role = 'admin' and p_role = 'admin' then raise exception 'ONLY_OWNER_CAN_INVITE_ADMIN'; end if;
  if v_caller_role = 'manager' then
    if p_role <> 'employee' or p_team_id is null or not public.can_manage_team(p_organization_id, p_team_id) then
      raise exception 'MANAGER_CAN_ONLY_INVITE_EMPLOYEE_TO_OWN_TEAM';
    end if;
  end if;
  if p_team_id is not null and not exists(select 1 from public.teams t where t.id = p_team_id and t.organization_id = p_organization_id) then
    raise exception 'TEAM_NOT_IN_ORGANIZATION';
  end if;
  if v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then raise exception 'INVALID_EMAIL'; end if;
  if exists (
    select 1 from public.organization_memberships m join public.profiles p on p.id = m.user_id
    where m.organization_id = p_organization_id and lower(p.email) = v_email and m.is_active
  ) then raise exception 'USER_ALREADY_MEMBER'; end if;

  update public.invitations set status = 'revoked', updated_at = now()
  where organization_id = p_organization_id and lower(email) = v_email and status = 'pending';

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');
  insert into public.invitations(organization_id, email, role, team_id, status, invited_by, expires_at)
  values (p_organization_id, v_email, p_role, p_team_id, 'pending', v_user_id, now() + interval '72 hours')
  returning * into v_inv;
  insert into public.invitation_secrets(invitation_id, token_hash) values(v_inv.id, v_token_hash);
  insert into public.activity_audit(organization_id, entity_type, entity_id, action, changed_by, new_value)
  values (p_organization_id, 'invitation', v_inv.id, 'created', v_user_id,
          jsonb_build_object('email', v_email, 'role', p_role, 'team_id', p_team_id, 'expires_at', v_inv.expires_at));
  return jsonb_build_object('id', v_inv.id, 'email', v_inv.email, 'role', v_inv.role,
    'team_id', v_inv.team_id, 'expires_at', v_inv.expires_at, 'token', v_token,
    'warning', 'Token is shown once. Do not log or store it in plaintext.');
end;
$$;

create or replace function public.accept_org_invitation(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_hash text;
  v_inv public.invitations%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(coalesce(p_token,'')) < 32 or length(p_token) > 256 then raise exception 'INVALID_INVITATION_TOKEN'; end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_user_id;
  if v_email is null then raise exception 'AUTH_EMAIL_NOT_FOUND'; end if;
  v_hash := encode(digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  select i.* into v_inv
  from public.invitations i
  join public.invitation_secrets s on s.invitation_id = i.id
  where s.token_hash = v_hash
  for update of i;
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
  if v_inv.status <> 'pending' then raise exception 'INVITATION_NOT_PENDING'; end if;
  if v_inv.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED';
  end if;
  if lower(v_inv.email) <> v_email then raise exception 'INVITATION_EMAIL_MISMATCH'; end if;
  if exists(select 1 from public.organization_memberships m where m.organization_id = v_inv.organization_id and m.user_id = v_user_id and m.is_active) then
    raise exception 'ALREADY_MEMBER';
  end if;

  insert into public.profiles(id, email, full_name)
  values(v_user_id, v_email, split_part(v_email, '@', 1))
  on conflict(id) do update set email = excluded.email, updated_at = now();

  insert into public.organization_memberships(organization_id, user_id, role, is_active)
  values(v_inv.organization_id, v_user_id, v_inv.role, true)
  on conflict(organization_id, user_id) do update set role = excluded.role, is_active = true, updated_at = now();

  if v_inv.team_id is not null then
    insert into public.team_memberships(organization_id, team_id, user_id, created_by)
    values(v_inv.organization_id, v_inv.team_id, v_user_id, v_inv.invited_by)
    on conflict(team_id, user_id) do nothing;
  end if;

  update public.invitations set status = 'accepted', accepted_at = now(), updated_at = now() where id = v_inv.id;
  delete from public.invitation_secrets where invitation_id = v_inv.id;
  insert into public.activity_audit(organization_id, entity_type, entity_id, action, changed_by, new_value)
  values(v_inv.organization_id, 'invitation', v_inv.id, 'accepted', v_user_id,
         jsonb_build_object('user_id', v_user_id, 'role', v_inv.role));
  return jsonb_build_object('organization_id', v_inv.organization_id, 'role', v_inv.role, 'team_id', v_inv.team_id);
end;
$$;

create or replace function public.revoke_org_invitation(p_invitation_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_org_id uuid; v_status text;
begin
  select organization_id, status into v_org_id, v_status from public.invitations where id = p_invitation_id for update;
  if v_org_id is null then raise exception 'INVITATION_NOT_FOUND'; end if;
  if not public.has_org_role(v_org_id, array['owner','admin']) then raise exception 'INVITE_REVOKE_FORBIDDEN'; end if;
  if v_status <> 'pending' then return false; end if;
  update public.invitations set status = 'revoked', updated_at = now() where id = p_invitation_id;
  delete from public.invitation_secrets where invitation_id = p_invitation_id;
  insert into public.activity_audit(organization_id, entity_type, entity_id, action, changed_by)
  values(v_org_id, 'invitation', p_invitation_id, 'revoked', auth.uid());
  return true;
end;
$$;

create or replace function public.update_org_member_role(p_organization_id uuid, p_user_id uuid, p_new_role text)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_actor_role text; v_old_role text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_actor_role := public.current_org_role(p_organization_id);
  if v_actor_role not in ('owner','admin') then raise exception 'ROLE_CHANGE_FORBIDDEN'; end if;
  if p_new_role not in ('admin','manager','finance','employee','viewer') then raise exception 'INVALID_ROLE'; end if;
  select role into v_old_role from public.organization_memberships where organization_id = p_organization_id and user_id = p_user_id and is_active for update;
  if v_old_role is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  if v_old_role = 'owner' then raise exception 'OWNER_ROLE_REQUIRES_SEPARATE_TRANSFER'; end if;
  if v_actor_role = 'admin' and (v_old_role = 'admin' or p_new_role = 'admin') then raise exception 'ONLY_OWNER_CAN_MANAGE_ADMIN_ROLE'; end if;
  update public.organization_memberships set role = p_new_role, updated_at = now() where organization_id = p_organization_id and user_id = p_user_id;
  insert into public.activity_audit(organization_id, entity_type, entity_id, action, changed_by, old_value, new_value)
  values(p_organization_id, 'user', p_user_id, 'role_changed', auth.uid(), jsonb_build_object('role', v_old_role), jsonb_build_object('role', p_new_role));
  return true;
end;
$$;

create or replace function public.set_org_member_active(p_organization_id uuid, p_user_id uuid, p_is_active boolean)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_actor_role text; v_target_role text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_actor_role := public.current_org_role(p_organization_id);
  if v_actor_role not in ('owner','admin') then raise exception 'MEMBER_MANAGEMENT_FORBIDDEN'; end if;
  select role into v_target_role from public.organization_memberships where organization_id = p_organization_id and user_id = p_user_id for update;
  if v_target_role is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  if v_target_role = 'owner' and not p_is_active then raise exception 'OWNER_CANNOT_BE_DEACTIVATED'; end if;
  if v_actor_role = 'admin' and v_target_role = 'admin' then raise exception 'ONLY_OWNER_CAN_CHANGE_ADMIN_STATUS'; end if;
  update public.organization_memberships set is_active = p_is_active, updated_at = now() where organization_id = p_organization_id and user_id = p_user_id;
  insert into public.activity_audit(organization_id, entity_type, entity_id, action, changed_by, old_value, new_value)
  values(p_organization_id, 'user', p_user_id, case when p_is_active then 'member_activated' else 'member_deactivated' end,
         auth.uid(), jsonb_build_object('is_active', not p_is_active), jsonb_build_object('is_active', p_is_active));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Current-day view: overdue days are calculated from calendar date at org timezone.
-- Use this view for UI display; it does not mutate stored financial source data.
-- ---------------------------------------------------------------------------
create or replace view public.debt_records_current
with (security_invoker = true)
as
select
  d.*,
  case when d.due_date is null then null
       else greatest(((now() at time zone coalesce(o.timezone, 'UTC'))::date - d.due_date), 0)
  end as current_overdue_days,
  case
    when d.due_date is null then 'no_due_date'
    when d.due_date >= (now() at time zone coalesce(o.timezone, 'UTC'))::date then 'not_overdue'
    when ((now() at time zone coalesce(o.timezone, 'UTC'))::date - d.due_date) between 1 and 7 then 'days_1_7'
    when ((now() at time zone coalesce(o.timezone, 'UTC'))::date - d.due_date) between 8 and 30 then 'days_8_30'
    when ((now() at time zone coalesce(o.timezone, 'UTC'))::date - d.due_date) between 31 and 60 then 'days_31_60'
    else 'days_60_plus'
  end as current_category
from public.debt_records d
join public.organizations o on o.id = d.organization_id;

-- Server-calculated analytics views. All totals are grouped by currency and exposed as text
-- so JavaScript cannot silently round large integer-cent values.
create or replace view public.debt_analytics_by_currency
with (security_invoker = true)
as
select
  organization_id,
  currency,
  coalesce(sum(amount_cents) filter (where amount_cents > 0), 0)::text as total_debt_cents,
  coalesce(sum(amount_cents) filter (where amount_cents > 0 and current_overdue_days > 0), 0)::text as overdue_debt_cents,
  coalesce(sum(amount_cents) filter (where amount_cents > 0 and current_overdue_days > 30), 0)::text as over_30_debt_cents,
  coalesce(sum(amount_cents) filter (where amount_cents > 0 and current_category = 'no_due_date'), 0)::text as no_due_date_debt_cents,
  count(*) filter (where amount_cents > 0) as positive_documents_count,
  count(*) filter (where amount_cents > 0 and current_overdue_days > 0) as overdue_documents_count,
  count(distinct case when amount_cents > 0 then coalesce(counterparty_id::text, lower(btrim(counterparty_name))) end) as counterparties_count,
  max(last_source_update) as latest_source_update
from public.debt_records_current
group by organization_id, currency;

create or replace view public.debt_aging_by_currency
with (security_invoker = true)
as
select
  organization_id,
  currency,
  current_category as category,
  coalesce(sum(amount_cents) filter (where amount_cents > 0), 0)::text as debt_cents,
  count(*) filter (where amount_cents > 0) as documents_count,
  count(*) filter (where amount_cents > 0 and current_overdue_days > 0) as overdue_documents_count
from public.debt_records_current
group by organization_id, currency, current_category;

create or replace view public.debt_analytics_by_counterparty
with (security_invoker = true)
as
select
  organization_id,
  currency,
  counterparty_id,
  counterparty_name,
  coalesce(sum(amount_cents) filter (where amount_cents > 0), 0)::text as total_debt_cents,
  coalesce(sum(amount_cents) filter (where amount_cents > 0 and current_overdue_days > 0), 0)::text as overdue_debt_cents,
  count(*) filter (where amount_cents > 0) as documents_count,
  count(*) filter (where amount_cents > 0 and current_overdue_days > 0) as overdue_documents_count,
  max(current_overdue_days) filter (where amount_cents > 0 and current_overdue_days > 0) as oldest_overdue_days,
  coalesce(sum(amount_cents) filter (where amount_cents > 0), 0) as total_debt_sort_numeric
from public.debt_records_current
where amount_cents > 0
group by organization_id, currency, counterparty_id, counterparty_name;

-- Safe read view for totals stored as bigint. Preserve exact cents as decimal strings in JS.
create or replace view public.imported_data_snapshots_safe
with (security_invoker = true)
as
select
  id, organization_id, snapshot_key, snapshot_date, import_batch_id, source_type,
  total_debt_cents::text as total_debt_cents,
  overdue_debt_cents::text as overdue_debt_cents,
  documents_count, overdue_documents_count, currency, data, is_complete, created_by, created_at
from public.imported_data_snapshots;

-- Create immutable, database-calculated snapshots only after a completed import.
-- One snapshot is stored per currency to avoid summing unlike currencies.
create or replace function public.create_debt_snapshots_for_import(p_organization_id uuid, p_import_batch_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_batch public.import_batches%rowtype;
  v_currency text;
  v_key text;
  v_total bigint;
  v_overdue bigint;
  v_doc_count integer;
  v_overdue_count integer;
  v_data jsonb;
  v_id uuid;
  v_result jsonb := '[]'::jsonb;
  v_seen integer := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_role(p_organization_id, array['owner','admin','finance']) then raise exception 'SNAPSHOT_FORBIDDEN'; end if;
  select * into v_batch
  from public.import_batches b
  where b.id = p_import_batch_id and b.organization_id = p_organization_id
  for share;
  if not found then raise exception 'IMPORT_BATCH_NOT_FOUND'; end if;
  if v_batch.status not in ('completed','completed_with_warnings') or v_batch.error_count <> 0 then
    raise exception 'SNAPSHOT_REQUIRES_COMPLETE_IMPORT_WITHOUT_ROW_ERRORS';
  end if;

  for v_currency in
    select distinct d.currency from public.debt_records d where d.organization_id = p_organization_id order by d.currency
  loop
    v_seen := v_seen + 1;
    v_key := 'import:' || p_import_batch_id::text || ':' || v_currency;
    select
      coalesce(sum(d.amount_cents) filter (where d.amount_cents > 0), 0)::bigint,
      coalesce(sum(d.amount_cents) filter (where d.amount_cents > 0 and d.current_overdue_days > 0), 0)::bigint,
      count(*) filter (where d.amount_cents > 0)::integer,
      count(*) filter (where d.amount_cents > 0 and d.current_overdue_days > 0)::integer,
      coalesce(jsonb_agg(jsonb_build_object(
        'documentKey', d.document_key,
        'counterpartyName', d.counterparty_name,
        'documentNumber', d.doc_number,
        'amountCents', d.amount_cents::text,
        'currency', d.currency,
        'dueDate', d.due_date,
        'overdueDays', d.current_overdue_days,
        'category', d.current_category
      ) order by d.counterparty_name, d.doc_number), '[]'::jsonb)
    into v_total, v_overdue, v_doc_count, v_overdue_count, v_data
    from public.debt_records_current d
    where d.organization_id = p_organization_id and d.currency = v_currency;

    insert into public.imported_data_snapshots(
      organization_id, snapshot_key, import_batch_id, source_type,
      total_debt_cents, overdue_debt_cents, documents_count, overdue_documents_count,
      currency, data, is_complete, created_by
    ) values (
      p_organization_id, v_key, p_import_batch_id, v_batch.source_type,
      v_total, v_overdue, v_doc_count, v_overdue_count,
      v_currency, v_data, true, auth.uid()
    ) on conflict (organization_id, snapshot_key) do nothing
    returning id into v_id;

    if v_id is null then
      select id into v_id from public.imported_data_snapshots
      where organization_id = p_organization_id and snapshot_key = v_key;
    end if;
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'id', v_id, 'currency', v_currency, 'total_debt_cents', v_total::text,
      'overdue_debt_cents', v_overdue::text, 'documents_count', v_doc_count,
      'overdue_documents_count', v_overdue_count, 'snapshot_key', v_key
    ));
  end loop;

  if v_seen = 0 then
    v_key := 'import:' || p_import_batch_id::text || ':RUB';
    insert into public.imported_data_snapshots(
      organization_id, snapshot_key, import_batch_id, source_type,
      total_debt_cents, overdue_debt_cents, documents_count, overdue_documents_count,
      currency, data, is_complete, created_by
    ) values (p_organization_id, v_key, p_import_batch_id, v_batch.source_type, 0, 0, 0, 0, 'RUB', '[]'::jsonb, true, auth.uid())
    on conflict (organization_id, snapshot_key) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.imported_data_snapshots where organization_id = p_organization_id and snapshot_key = v_key;
    end if;
    v_result := jsonb_build_array(jsonb_build_object('id', v_id, 'currency', 'RUB', 'total_debt_cents', '0', 'overdue_debt_cents', '0', 'documents_count', 0, 'overdue_documents_count', 0, 'snapshot_key', v_key));
  end if;
  return v_result;
end;
$$;

-- Atomic manual import: validate the complete payload, upsert all rows, finalize the batch,
-- and create snapshots in the same database transaction. Partial payloads are rejected.
create or replace function public.commit_manual_import(
  p_organization_id uuid,
  p_import_batch_id uuid,
  p_rows jsonb,
  p_warnings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_batch public.import_batches%rowtype;
  v_row jsonb;
  v_key text;
  v_amount bigint;
  v_date date;
  v_count integer;
  v_distinct_count integer;
  v_new_count integer := 0;
  v_updated_count integer := 0;
  v_unchanged_count integer := 0;
  v_status text;
  v_existing public.debt_records%rowtype;
  v_snapshots jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_role(p_organization_id, array['owner','admin','finance']) then raise exception 'IMPORT_FORBIDDEN'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'IMPORT_ROWS_MUST_BE_ARRAY'; end if;
  if jsonb_typeof(coalesce(p_warnings, '[]'::jsonb)) is distinct from 'array' then raise exception 'IMPORT_WARNINGS_MUST_BE_ARRAY'; end if;
  if jsonb_array_length(coalesce(p_warnings, '[]'::jsonb)) > 500 then raise exception 'TOO_MANY_IMPORT_WARNINGS'; end if;

  select * into v_batch from public.import_batches b
  where b.id = p_import_batch_id and b.organization_id = p_organization_id
  for update;
  if not found then raise exception 'IMPORT_BATCH_NOT_FOUND'; end if;

  -- Idempotent retry: never reapply a batch that has already been committed.
  if v_batch.status in ('completed','completed_with_warnings') and v_batch.error_count = 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'currency', s.currency, 'total_debt_cents', s.total_debt_cents::text,
      'overdue_debt_cents', s.overdue_debt_cents::text, 'documents_count', s.documents_count,
      'overdue_documents_count', s.overdue_documents_count, 'snapshot_key', s.snapshot_key
    ) order by s.currency), '[]'::jsonb)
    into v_snapshots from public.imported_data_snapshots s
    where s.organization_id = p_organization_id and s.import_batch_id = p_import_batch_id;
    return jsonb_build_object('batch_id', v_batch.id, 'status', v_batch.status,
      'new_records', v_batch.new_count, 'updated_records', v_batch.updated_count,
      'unchanged_records', greatest(v_batch.success_count - v_batch.new_count - v_batch.updated_count, 0),
      'snapshots', v_snapshots, 'already_committed', true);
  end if;
  if v_batch.status <> 'preview' then raise exception 'IMPORT_BATCH_NOT_IN_PREVIEW'; end if;
  if v_batch.source_type <> 'manual_import' then raise exception 'WRONG_IMPORT_SOURCE_TYPE'; end if;
  if v_batch.file_hash is not null and exists (
    select 1 from public.import_batches previous
    where previous.organization_id = p_organization_id
      and previous.file_hash = v_batch.file_hash
      and previous.id <> v_batch.id
      and previous.status in ('completed','completed_with_warnings')
  ) then raise exception 'DUPLICATE_FILE_HASH'; end if;

  v_count := jsonb_array_length(p_rows);
  if v_count = 0 then raise exception 'EMPTY_IMPORT_NOT_ALLOWED'; end if;
  if v_count <> v_batch.row_count then raise exception 'IMPORT_ROW_COUNT_MISMATCH'; end if;
  select count(distinct nullif(btrim(value ->> 'documentKey'), '')) into v_distinct_count
  from jsonb_array_elements(p_rows) as t(value);
  if v_distinct_count <> v_count then raise exception 'IMPORT_HAS_EMPTY_OR_DUPLICATE_DOCUMENT_KEYS'; end if;

  -- Validate the entire payload before any data changes.
  for v_row in select value from jsonb_array_elements(p_rows) as t(value) loop
    if jsonb_typeof(v_row) is distinct from 'object' then raise exception 'IMPORT_ROW_MUST_BE_OBJECT'; end if;
    v_key := btrim(coalesce(v_row ->> 'documentKey',''));
    if v_key = '' then raise exception 'DOCUMENT_KEY_REQUIRED'; end if;
    if nullif(btrim(v_row ->> 'counterpartyName'),'') is null then raise exception 'COUNTERPARTY_NAME_REQUIRED'; end if;
    if nullif(btrim(v_row ->> 'docNumber'),'') is null then raise exception 'DOCUMENT_NUMBER_REQUIRED'; end if;
    if coalesce(v_row ->> 'amountCents','') !~ '^-?[0-9]+$' then raise exception 'AMOUNT_CENTS_MUST_BE_INTEGER'; end if;
    v_amount := (v_row ->> 'amountCents')::bigint;
    if abs(v_amount::numeric) > 9007199254740991 then raise exception 'AMOUNT_EXCEEDS_SAFE_FRONTEND_INTEGER'; end if;
    if coalesce(nullif(v_row ->> 'currency',''),'RUB') !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY_CODE'; end if;
    if nullif(v_row ->> 'docDate','') is not null then
      if (v_row ->> 'docDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_DOCUMENT_DATE_FORMAT'; end if;
      v_date := (v_row ->> 'docDate')::date;
    end if;
    if nullif(v_row ->> 'dueDate','') is not null then
      if (v_row ->> 'dueDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_DUE_DATE_FORMAT'; end if;
      v_date := (v_row ->> 'dueDate')::date;
    end if;
    if nullif(v_row ->> 'counterpartyId','') is not null then
      perform 1 from public.counterparties c
      where c.id = (v_row ->> 'counterpartyId')::uuid and c.organization_id = p_organization_id;
      if not found then raise exception 'COUNTERPARTY_ORG_MISMATCH'; end if;
    end if;
  end loop;

  -- Determine new/changed/unchanged counts using the current source state.
  for v_row in select value from jsonb_array_elements(p_rows) as t(value) loop
    v_key := btrim(v_row ->> 'documentKey');
    select * into v_existing from public.debt_records d
    where d.organization_id = p_organization_id and d.document_key = v_key;
    if not found then
      v_new_count := v_new_count + 1;
    else
      v_amount := (v_row ->> 'amountCents')::bigint;
      if v_existing.amount_cents is distinct from v_amount
         or v_existing.counterparty_name is distinct from btrim(v_row ->> 'counterpartyName')
         or v_existing.doc_number is distinct from btrim(v_row ->> 'docNumber')
         or v_existing.currency is distinct from coalesce(nullif(v_row ->> 'currency',''),'RUB')
         or (nullif(v_row ->> 'dueDate','') is not null and v_existing.due_date is distinct from (v_row ->> 'dueDate')::date)
         or (nullif(v_row ->> 'docDate','') is not null and v_existing.doc_date is distinct from (v_row ->> 'docDate')::date)
         or (nullif(v_row ->> 'counterpartyINN','') is not null and v_existing.counterparty_inn is distinct from (v_row ->> 'counterpartyINN'))
         or (nullif(v_row ->> 'ownerEmail','') is not null and v_existing.owner_email is distinct from (v_row ->> 'ownerEmail')) then
        v_updated_count := v_updated_count + 1;
      else
        v_unchanged_count := v_unchanged_count + 1;
      end if;
    end if;
  end loop;

  insert into public.debt_records (
    organization_id, import_batch_id, counterparty_id, external_id, document_key,
    counterparty_name, counterparty_inn, doc_number, doc_date, due_date,
    amount_cents, currency, owner_email, notes, source_type, source_updated_at, last_source_update
  )
  select
    p_organization_id,
    p_import_batch_id,
    nullif(e.value ->> 'counterpartyId','')::uuid,
    nullif(e.value ->> 'externalId',''),
    btrim(e.value ->> 'documentKey'),
    btrim(e.value ->> 'counterpartyName'),
    nullif(e.value ->> 'counterpartyINN',''),
    btrim(e.value ->> 'docNumber'),
    nullif(e.value ->> 'docDate','')::date,
    nullif(e.value ->> 'dueDate','')::date,
    (e.value ->> 'amountCents')::bigint,
    coalesce(nullif(e.value ->> 'currency',''),'RUB'),
    nullif(e.value ->> 'ownerEmail',''),
    nullif(e.value ->> 'notes',''),
    'manual_import',
    nullif(e.value ->> 'lastSourceUpdate','')::timestamptz,
    now()
  from jsonb_array_elements(p_rows) as e(value)
  on conflict (organization_id, document_key) do update set
    import_batch_id = excluded.import_batch_id,
    counterparty_id = coalesce(excluded.counterparty_id, public.debt_records.counterparty_id),
    counterparty_name = excluded.counterparty_name,
    counterparty_inn = coalesce(nullif(excluded.counterparty_inn,''), public.debt_records.counterparty_inn),
    doc_number = excluded.doc_number,
    doc_date = coalesce(excluded.doc_date, public.debt_records.doc_date),
    due_date = coalesce(excluded.due_date, public.debt_records.due_date),
    amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    owner_email = coalesce(nullif(excluded.owner_email,''), public.debt_records.owner_email),
    notes = coalesce(nullif(excluded.notes,''), public.debt_records.notes),
    source_type = 'manual_import',
    source_updated_at = coalesce(excluded.source_updated_at, public.debt_records.source_updated_at),
    last_source_update = now(),
    updated_at = now();

  v_status := case when jsonb_array_length(coalesce(p_warnings, '[]'::jsonb)) > 0 then 'completed_with_warnings' else 'completed' end;
  update public.import_batches set
    success_count = v_count,
    error_count = 0,
    duplicate_count = 0,
    updated_count = v_updated_count,
    new_count = v_new_count,
    missing_from_source = 0,
    status = v_status,
    errors = '[]'::jsonb,
    warnings = coalesce(p_warnings, '[]'::jsonb),
    completed_at = now(),
    updated_at = now()
  where id = p_import_batch_id and organization_id = p_organization_id;

  select public.create_debt_snapshots_for_import(p_organization_id, p_import_batch_id) into v_snapshots;
  insert into public.activity_audit(organization_id, entity_type, entity_id, action, changed_by, new_value, comment)
  values (p_organization_id, 'import_batch', p_import_batch_id, 'manual_import_committed', v_uid,
    jsonb_build_object('rows', v_count, 'new_records', v_new_count, 'updated_records', v_updated_count, 'unchanged_records', v_unchanged_count, 'status', v_status),
    'Atomic import and snapshot creation');

  return jsonb_build_object(
    'batch_id', p_import_batch_id,
    'status', v_status,
    'total_records', v_count,
    'new_records', v_new_count,
    'updated_records', v_updated_count,
    'unchanged_records', v_unchanged_count,
    'snapshots', v_snapshots,
    'already_committed', false
  );
end;
$$;

create or replace function public.fail_manual_import(p_organization_id uuid, p_import_batch_id uuid, p_errors jsonb)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_batch public.import_batches%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_role(p_organization_id, array['owner','admin','finance']) then raise exception 'IMPORT_FORBIDDEN'; end if;
  if jsonb_typeof(p_errors) is distinct from 'array' or jsonb_array_length(p_errors) = 0 then raise exception 'IMPORT_ERRORS_REQUIRED'; end if;
  select * into v_batch from public.import_batches b where b.id=p_import_batch_id and b.organization_id=p_organization_id for update;
  if not found then raise exception 'IMPORT_BATCH_NOT_FOUND'; end if;
  if v_batch.status <> 'preview' then raise exception 'IMPORT_BATCH_NOT_IN_PREVIEW'; end if;
  update public.import_batches set status='failed', error_count=jsonb_array_length(p_errors), errors=p_errors, completed_at=now(), updated_at=now()
  where id=p_import_batch_id and organization_id=p_organization_id;
  insert into public.activity_audit(organization_id, entity_type, entity_id, action, changed_by, new_value, comment)
  values(p_organization_id, 'import_batch', p_import_batch_id, 'manual_import_failed', auth.uid(),
    jsonb_build_object('error_count', jsonb_array_length(p_errors)), 'Import failed validation; no debt rows were changed');
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','organizations','organization_memberships','platform_admins','teams','team_memberships',
    'counterparties','import_batches','debt_records','counterparty_assignments','tasks','communications',
    'payment_promises','notifications','counterparty_notes','imported_data_snapshots','data_quality_issues',
    'saved_report_views','integration_connections','sync_history','invitations','invitation_secrets','activity_audit'
  ] LOOP
    EXECUTE format('alter table public.%I enable row level security', t);
  END LOOP;
END;
$$;

-- Profiles: users may see themselves; org managers/admins may see permitted colleagues.
create policy profiles_select_self_or_authorized on public.profiles for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.organization_memberships mine
    join public.organization_memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and mine.is_active and theirs.user_id = profiles.id and theirs.is_active
      and (mine.role in ('owner','admin') or public.can_view_member(mine.organization_id, profiles.id))
  )
);
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy organizations_select_member on public.organizations for select to authenticated
using (public.is_org_member(id) or public.is_platform_admin());
create policy organizations_update_admin on public.organizations for update to authenticated
using (public.has_org_role(id, array['owner','admin'])) with check (public.has_org_role(id, array['owner','admin']));

create policy memberships_select_authorized on public.organization_memberships for select to authenticated
using (user_id = auth.uid() or public.can_view_member(organization_id, user_id));

create policy teams_select_member on public.teams for select to authenticated
using (public.is_org_member(organization_id));
create policy teams_insert_admin_or_manager on public.teams for insert to authenticated
with check (public.has_org_role(organization_id, array['owner','admin']) and created_by = auth.uid());
create policy teams_update_manager on public.teams for update to authenticated
using (public.can_manage_team(organization_id, id)) with check (public.can_manage_team(organization_id, id));
create policy teams_delete_admin on public.teams for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']));

create policy team_memberships_select_member on public.team_memberships for select to authenticated
using (user_id = auth.uid() or public.can_manage_team(organization_id, team_id) or public.can_view_member(organization_id, user_id));
create policy team_memberships_insert_manager on public.team_memberships for insert to authenticated
with check (
  created_by = auth.uid()
  and public.can_manage_team(organization_id, team_id)
  and exists(select 1 from public.organization_memberships m where m.organization_id = team_memberships.organization_id and m.user_id = team_memberships.user_id and m.is_active)
);
create policy team_memberships_delete_manager on public.team_memberships for delete to authenticated
using (public.can_manage_team(organization_id, team_id));

create policy counterparties_select_allowed on public.counterparties for select to authenticated
using (public.can_read_counterparty(organization_id, id, name));
create policy counterparties_insert_finance on public.counterparties for insert to authenticated
with check (public.has_org_role(organization_id, array['owner','admin','finance']));
create policy counterparties_update_finance on public.counterparties for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','finance'])) with check (public.has_org_role(organization_id, array['owner','admin','finance']));
create policy counterparties_delete_admin on public.counterparties for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']));

create policy import_batches_select_finance on public.import_batches for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin','finance','viewer']));
create policy import_batches_insert_finance on public.import_batches for insert to authenticated
with check (public.has_org_role(organization_id, array['owner','admin','finance']) and (imported_by is null or imported_by = auth.uid()));

create policy debt_records_select_allowed on public.debt_records for select to authenticated
using (public.can_read_debt(organization_id, counterparty_id, counterparty_name));

create policy assignments_select_allowed on public.counterparty_assignments for select to authenticated
using (
  assigned_to = auth.uid()
  or public.has_org_role(organization_id, array['owner','admin','finance'])
  or (public.current_org_role(organization_id) = 'manager' and exists (
      select 1 from public.teams t join public.team_memberships tm on tm.team_id=t.id and tm.organization_id=t.organization_id
      where t.organization_id = counterparty_assignments.organization_id and t.manager_id=auth.uid() and tm.user_id=counterparty_assignments.assigned_to
  ))
);
create policy assignments_insert_authorized on public.counterparty_assignments for insert to authenticated
with check (
  assigned_by = auth.uid()
  and public.is_org_member(organization_id)
  and exists(select 1 from public.organization_memberships m where m.organization_id=counterparty_assignments.organization_id and m.user_id=counterparty_assignments.assigned_to and m.is_active)
  and (
    public.has_org_role(organization_id, array['owner','admin','finance'])
    or (public.current_org_role(organization_id) = 'manager' and exists (
      select 1 from public.team_memberships tm join public.teams t on t.id=tm.team_id and t.organization_id=tm.organization_id
      where t.organization_id=counterparty_assignments.organization_id and t.manager_id=auth.uid() and tm.user_id=counterparty_assignments.assigned_to
    ))
  )
);
create policy assignments_update_authorized on public.counterparty_assignments for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','finance']))
with check (public.has_org_role(organization_id, array['owner','admin','finance']));
create policy assignments_delete_admin on public.counterparty_assignments for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']));

create policy tasks_select_allowed on public.tasks for select to authenticated
using (public.can_read_task(organization_id, assigned_to, team_id));
create policy tasks_insert_allowed on public.tasks for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_org_member(organization_id)
  and public.can_assign_to_user(organization_id, assigned_to, team_id)
  and (counterparty_id is null or public.can_read_counterparty(organization_id, counterparty_id, counterparty_name))
  and (debt_record_id is null or exists(select 1 from public.debt_records d where d.id=debt_record_id and d.organization_id=tasks.organization_id))
);
create policy tasks_update_allowed on public.tasks for update to authenticated
using (public.can_manage_task(organization_id, assigned_to, team_id))
with check (public.can_manage_task(organization_id, assigned_to, team_id) and public.can_assign_to_user(organization_id, assigned_to, team_id) and (counterparty_id is null or public.can_read_counterparty(organization_id, counterparty_id, counterparty_name)) and (debt_record_id is null or exists(select 1 from public.debt_records d where d.id=debt_record_id and d.organization_id=tasks.organization_id)));

create policy communications_select_allowed on public.communications for select to authenticated
using (public.can_read_counterparty(organization_id, counterparty_id, counterparty_name));
create policy communications_insert_allowed on public.communications for insert to authenticated
with check (
  created_by = auth.uid() and employee_id = auth.uid()
  and public.can_read_counterparty(organization_id, counterparty_id, counterparty_name)
  and (debt_record_id is null or exists(select 1 from public.debt_records d where d.id=debt_record_id and d.organization_id=communications.organization_id))
);

create policy promises_select_allowed on public.payment_promises for select to authenticated
using (public.can_read_counterparty(organization_id, counterparty_id, counterparty_name));
create policy promises_insert_allowed on public.payment_promises for insert to authenticated
with check (
  created_by = auth.uid() and employee_id = auth.uid()
  and public.can_read_counterparty(organization_id, counterparty_id, counterparty_name)
  and (debt_record_id is null or exists(select 1 from public.debt_records d where d.id=debt_record_id and d.organization_id=payment_promises.organization_id))
);
create policy promises_update_allowed on public.payment_promises for update to authenticated
using (employee_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin','finance']) or (public.current_org_role(organization_id) = 'manager' and public.can_read_counterparty(organization_id, counterparty_id, counterparty_name)))
with check (public.is_org_member(organization_id) and public.can_read_counterparty(organization_id, counterparty_id, counterparty_name) and (debt_record_id is null or exists(select 1 from public.debt_records d where d.id=debt_record_id and d.organization_id=payment_promises.organization_id)));

create policy notifications_select_recipient on public.notifications for select to authenticated
using (recipient_id = auth.uid() and public.is_org_member(organization_id));
create policy notifications_update_recipient on public.notifications for update to authenticated
using (recipient_id = auth.uid() and public.is_org_member(organization_id))
with check (recipient_id = auth.uid() and public.is_org_member(organization_id));
create policy notifications_insert_self on public.notifications for insert to authenticated
with check (recipient_id = auth.uid() and public.is_org_member(organization_id));

create policy notes_select_allowed on public.counterparty_notes for select to authenticated
using (public.can_read_counterparty(organization_id, counterparty_id, counterparty_name));
create policy notes_insert_allowed on public.counterparty_notes for insert to authenticated
with check (created_by = auth.uid() and public.can_read_counterparty(organization_id, counterparty_id, counterparty_name));
create policy notes_update_allowed on public.counterparty_notes for update to authenticated
using (created_by = auth.uid() or public.has_org_role(organization_id, array['owner','admin','finance']))
with check (public.can_read_counterparty(organization_id, counterparty_id, counterparty_name));
create policy notes_delete_allowed on public.counterparty_notes for delete to authenticated
using (created_by = auth.uid() or public.has_org_role(organization_id, array['owner','admin']));

create policy snapshots_select_finance on public.imported_data_snapshots for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin','finance','viewer']));

create policy quality_select_allowed on public.data_quality_issues for select to authenticated
using (
  public.has_org_role(organization_id, array['owner','admin','finance','viewer'])
  or (debt_record_id is not null and exists(select 1 from public.debt_records d where d.id=data_quality_issues.debt_record_id and public.can_read_debt(d.organization_id,d.counterparty_id,d.counterparty_name)))
);
create policy quality_update_finance on public.data_quality_issues for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','finance']))
with check (public.has_org_role(organization_id, array['owner','admin','finance']));
create policy quality_insert_finance on public.data_quality_issues for insert to authenticated
with check (public.has_org_role(organization_id, array['owner','admin','finance']));

create policy saved_views_select_own on public.saved_report_views for select to authenticated
using (user_id = auth.uid() and public.is_org_member(organization_id));
create policy saved_views_insert_own on public.saved_report_views for insert to authenticated
with check (user_id = auth.uid() and public.is_org_member(organization_id));
create policy saved_views_update_own on public.saved_report_views for update to authenticated
using (user_id = auth.uid() and public.is_org_member(organization_id))
with check (user_id = auth.uid() and public.is_org_member(organization_id));
create policy saved_views_delete_own on public.saved_report_views for delete to authenticated
using (user_id = auth.uid() and public.is_org_member(organization_id));

create policy integration_select_authorized on public.integration_connections for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin']));
create policy integration_insert_admin on public.integration_connections for insert to authenticated
with check (public.has_org_role(organization_id, array['owner','admin']) and created_by = auth.uid());
create policy integration_update_admin on public.integration_connections for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin']))
with check (public.has_org_role(organization_id, array['owner','admin']));
create policy integration_delete_admin on public.integration_connections for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']));

create policy sync_history_select_finance on public.sync_history for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin','finance','viewer']));

create policy invitations_select_admin on public.invitations for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin']) or invited_by = auth.uid());

create policy audit_select_allowed on public.activity_audit for select to authenticated
using (changed_by = auth.uid() or public.has_org_role(organization_id, array['owner','admin']));

-- No policy is intentionally defined for platform_admins or invitation_secrets.
-- Normal authenticated users cannot read or mutate these tables directly.

-- ---------------------------------------------------------------------------
-- Grants: RLS is the primary row security layer; grants restrict table operations.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, position, timezone, preferences) on table public.profiles to authenticated;

revoke all on table public.organizations from anon, authenticated;
grant select on table public.organizations to authenticated;
grant update (name, timezone, stale_data_threshold_hours) on table public.organizations to authenticated;

revoke all on table public.organization_memberships from anon, authenticated;
grant select on table public.organization_memberships to authenticated;

revoke all on table public.platform_admins from anon, authenticated;
revoke all on table public.invitation_secrets from anon, authenticated;

revoke all on table public.teams from anon, authenticated;
grant select, insert, update, delete on table public.teams to authenticated;
revoke all on table public.team_memberships from anon, authenticated;
grant select, insert, delete on table public.team_memberships to authenticated;

revoke all on table public.counterparties from anon, authenticated;
grant select, insert, update, delete on table public.counterparties to authenticated;
revoke all on table public.import_batches from anon, authenticated;
grant select on table public.import_batches to authenticated;
grant insert (organization_id, file_name, file_hash, source_type, row_count, imported_by) on table public.import_batches to authenticated;
revoke all on table public.debt_records from anon, authenticated;
grant select on table public.debt_records to authenticated;
revoke all on table public.counterparty_assignments from anon, authenticated;
grant select, insert, update, delete on table public.counterparty_assignments to authenticated;
revoke all on table public.tasks from anon, authenticated;
grant select, insert, update on table public.tasks to authenticated;
revoke all on table public.communications from anon, authenticated;
grant select, insert on table public.communications to authenticated;
revoke all on table public.payment_promises from anon, authenticated;
grant select, insert, update on table public.payment_promises to authenticated;
revoke all on table public.notifications from anon, authenticated;
grant select, insert, update on table public.notifications to authenticated;
revoke all on table public.counterparty_notes from anon, authenticated;
grant select, insert, update, delete on table public.counterparty_notes to authenticated;
revoke all on table public.imported_data_snapshots from anon, authenticated;
grant select on table public.imported_data_snapshots to authenticated;
revoke all on table public.data_quality_issues from anon, authenticated;
grant select, insert, update on table public.data_quality_issues to authenticated;
revoke all on table public.saved_report_views from anon, authenticated;
grant select, insert, update, delete on table public.saved_report_views to authenticated;
revoke all on table public.integration_connections from anon, authenticated;
grant select, insert, update, delete on table public.integration_connections to authenticated;
revoke all on table public.sync_history from anon, authenticated;
grant select on table public.sync_history to authenticated;
revoke all on table public.invitations from anon, authenticated;
grant select on table public.invitations to authenticated;
revoke all on table public.activity_audit from anon, authenticated;
grant select on table public.activity_audit to authenticated;

-- Views are security invoker, so base-table RLS is enforced for the caller.
grant select on table public.debt_records_current to authenticated;
grant select on table public.debt_analytics_by_currency to authenticated;
grant select on table public.debt_aging_by_currency to authenticated;
grant select on table public.debt_analytics_by_counterparty to authenticated;
grant select on table public.imported_data_snapshots_safe to authenticated;

-- RPC permissions. Authenticated clients only; anonymous calls are rejected by function checks and grants.
revoke all on function public.create_organization_for_current_user(text,text) from public, anon;
revoke all on function public.create_org_invitation(uuid,text,text,uuid) from public, anon;
revoke all on function public.accept_org_invitation(text) from public, anon;
revoke all on function public.revoke_org_invitation(uuid) from public, anon;
revoke all on function public.update_org_member_role(uuid,uuid,text) from public, anon;
revoke all on function public.set_org_member_active(uuid,uuid,boolean) from public, anon;
revoke all on function public.create_debt_snapshots_for_import(uuid,uuid) from public, anon;
revoke all on function public.commit_manual_import(uuid,uuid,jsonb,jsonb) from public, anon;
revoke all on function public.fail_manual_import(uuid,uuid,jsonb) from public, anon;
grant execute on function public.create_organization_for_current_user(text,text) to authenticated;
grant execute on function public.create_org_invitation(uuid,text,text,uuid) to authenticated;
grant execute on function public.accept_org_invitation(text) to authenticated;
grant execute on function public.revoke_org_invitation(uuid) to authenticated;
grant execute on function public.update_org_member_role(uuid,uuid,text) to authenticated;
grant execute on function public.set_org_member_active(uuid,uuid,boolean) to authenticated;
grant execute on function public.commit_manual_import(uuid,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.fail_manual_import(uuid,uuid,jsonb) to authenticated;

-- Helpers are callable by authenticated users because RLS policies invoke them.
revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.current_org_role(uuid) from public, anon;
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.has_org_role(uuid,text[]) from public, anon;
revoke all on function public.can_view_member(uuid,uuid) from public, anon;
revoke all on function public.can_manage_team(uuid,uuid) from public, anon;
revoke all on function public.can_read_counterparty(uuid,uuid,text) from public, anon;
revoke all on function public.can_read_debt(uuid,uuid,text) from public, anon;
revoke all on function public.can_read_task(uuid,uuid,uuid) from public, anon;
revoke all on function public.can_assign_to_user(uuid,uuid,uuid) from public, anon;
revoke all on function public.can_manage_counterparty(uuid,uuid,text) from public, anon;
revoke all on function public.can_manage_task(uuid,uuid,uuid) from public, anon;
revoke all on function public.jsonb_contains_secret_key(jsonb) from public, anon;
revoke all on function public.set_updated_at() from public, anon;
revoke all on function public.prevent_organization_change() from public, anon;
revoke all on function public.audit_operational_row_change() from public, anon;
revoke all on function public.validate_team_relations() from public, anon;
revoke all on function public.validate_business_org_references() from public, anon;
revoke all on function public.protect_sensitive_fields() from public, anon;
revoke all on function public.handle_new_auth_user() from public, anon;
revoke all on function public.handle_auth_user_email_change() from public, anon;
revoke all on function public.validate_timezone_name() from public, anon;
grant execute on function public.jsonb_contains_secret_key(jsonb) to authenticated;
grant execute on function public.prevent_organization_change() to authenticated;
grant execute on function public.validate_team_relations() to authenticated;
grant execute on function public.validate_business_org_references() to authenticated;
grant execute on function public.protect_sensitive_fields() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.current_org_role(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid,text[]) to authenticated;
grant execute on function public.can_view_member(uuid,uuid) to authenticated;
grant execute on function public.can_manage_team(uuid,uuid) to authenticated;
grant execute on function public.can_read_counterparty(uuid,uuid,text) to authenticated;
grant execute on function public.can_read_debt(uuid,uuid,text) to authenticated;
grant execute on function public.can_read_task(uuid,uuid,uuid) to authenticated;
grant execute on function public.can_assign_to_user(uuid,uuid,uuid) to authenticated;
grant execute on function public.can_manage_counterparty(uuid,uuid,text) to authenticated;
grant execute on function public.can_manage_task(uuid,uuid,uuid) to authenticated;

commit;
