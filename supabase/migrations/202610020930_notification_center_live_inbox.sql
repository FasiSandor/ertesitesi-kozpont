-- Notification Center live inbox bridge
create table if not exists core.notification_center_tokens (
  token_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  token_hash text not null unique,
  label text not null default 'iPhone',
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create table if not exists core.notification_inbox_items (
  item_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  source text not null,
  sender text,
  title text,
  subtitle text,
  body text not null,
  received_at timestamptz not null default now(),
  deep_link text,
  avatar_url text,
  unread boolean not null default true,
  starred boolean not null default false,
  calendar_status text not null default 'none' check (calendar_status in ('none','ignored','created','error')),
  calendar_event_id uuid references core.naptar_calendar_events(event_id) on delete set null,
  ai_summary text,
  dedupe_key text not null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id,dedupe_key)
);
alter table core.notification_center_tokens enable row level security;
alter table core.notification_inbox_items enable row level security;
grant usage on schema core to service_role;
grant select,insert,update,delete on core.notification_center_tokens to service_role;
grant select,insert,update,delete on core.notification_inbox_items to service_role;

create table if not exists core.notification_center_pair_codes (
  pair_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  code_hash text not null unique,
  label text not null default 'iPhone',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table core.notification_center_pair_codes enable row level security;
grant select,insert,update,delete on core.notification_center_pair_codes to service_role;
