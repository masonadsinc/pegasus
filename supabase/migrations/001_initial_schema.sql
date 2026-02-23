-- ============================================================
-- Agency Command — Initial Schema
-- Multi-tenant agency operating system
-- ============================================================

-- Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  primary_color text default '#000000',
  plan text default 'starter',
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Organization Members
create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('owner', 'admin', 'operator', 'viewer', 'ai_agent')),
  display_name text,
  created_at timestamptz default now(),
  unique(org_id, user_id)
);

-- Clients
create table clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  slug text not null,
  industry text,
  website text,
  status text default 'active' check (status in ('active', 'pipeline', 'inactive', 'churned')),
  monthly_retainer numeric(10,2),
  rev_share_pct numeric(5,2),
  contract_start date,
  contract_end date,
  primary_contact_name text,
  primary_contact_email text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, slug)
);

-- Ad Accounts (platform-agnostic)
create table ad_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  platform text not null default 'meta' check (platform in ('meta', 'google', 'tiktok', 'linkedin')),
  platform_account_id text not null,
  name text,
  currency text default 'USD',
  timezone text default 'America/Los_Angeles',
  objective text check (objective in ('leads', 'purchases', 'schedule', 'traffic', 'awareness')),
  target_cpl numeric(10,2),
  target_roas numeric(5,2),
  is_active boolean default true,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  unique(org_id, platform, platform_account_id)
);

-- Campaigns
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  ad_account_id uuid references ad_accounts(id) on delete cascade not null,
  platform_campaign_id text not null,
  name text,
  status text,
  objective text,
  daily_budget numeric(10,2),
  lifetime_budget numeric(10,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(ad_account_id, platform_campaign_id)
);

-- Ad Sets
create table ad_sets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  campaign_id uuid references campaigns(id) on delete cascade not null,
  ad_account_id uuid references ad_accounts(id) on delete cascade not null,
  platform_ad_set_id text not null,
  name text,
  status text,
  daily_budget numeric(10,2),
  lifetime_budget numeric(10,2),
  targeting jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(ad_account_id, platform_ad_set_id)
);

-- Ads
create table ads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  ad_set_id uuid references ad_sets(id) on delete cascade not null,
  ad_account_id uuid references ad_accounts(id) on delete cascade not null,
  platform_ad_id text not null,
  name text,
  status text,
  creative_url text,
  creative_body text,
  creative_headline text,
  creative_cta text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(ad_account_id, platform_ad_id)
);

-- Daily Ad Insights
create table ad_insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  ad_account_id uuid references ad_accounts(id) on delete cascade not null,
  campaign_id uuid references campaigns(id) on delete set null,
  ad_set_id uuid references ad_sets(id) on delete set null,
  ad_id uuid references ads(id) on delete set null,
  platform_campaign_id text,
  platform_ad_set_id text,
  platform_ad_id text,
  date date not null,
  spend numeric(10,2) default 0,
  impressions integer default 0,
  clicks integer default 0,
  reach integer default 0,
  leads integer default 0,
  purchases integer default 0,
  purchase_value numeric(10,2) default 0,
  schedules integer default 0,
  cpl numeric(10,2),
  cpc numeric(10,2),
  ctr numeric(8,4),
  roas numeric(8,4),
  synced_at timestamptz default now(),
  unique(ad_account_id, platform_ad_id, date)
);

-- Breakdowns (demographics, device, placement, geo)
create table ad_breakdowns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  ad_account_id uuid references ad_accounts(id) on delete cascade not null,
  date date not null,
  breakdown_type text not null check (breakdown_type in ('age_gender', 'device', 'placement', 'region')),
  dimension_1 text,
  dimension_2 text,
  spend numeric(10,2) default 0,
  impressions integer default 0,
  clicks integer default 0,
  leads integer default 0,
  purchases integer default 0,
  purchase_value numeric(10,2) default 0,
  synced_at timestamptz default now()
);

-- Integrations
create table integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  platform text not null,
  credentials jsonb,
  status text default 'active',
  last_used_at timestamptz,
  created_at timestamptz default now(),
  unique(org_id, platform)
);

-- Financial Records
create table financial_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  date date not null,
  mrr numeric(10,2),
  collected_revenue numeric(10,2),
  payroll numeric(10,2),
  software numeric(10,2),
  contractors numeric(10,2),
  ad_spend_total numeric(10,2),
  other_costs numeric(10,2),
  cash_position numeric(12,2),
  net_profit numeric(10,2),
  profit_margin numeric(5,2),
  synced_at timestamptz default now(),
  unique(org_id, date)
);

-- Activity Log
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  actor_type text not null check (actor_type in ('human', 'ai', 'system')),
  actor_id text,
  actor_name text,
  action text not null,
  target_type text,
  target_id text,
  target_name text,
  details jsonb,
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz default now()
);

-- AI Insights
create table ai_insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade,
  ad_account_id uuid references ad_accounts(id) on delete cascade,
  insight_type text not null check (insight_type in ('fatigue', 'opportunity', 'anomaly', 'recommendation')),
  severity text default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text not null,
  data jsonb,
  is_read boolean default false,
  is_actioned boolean default false,
  created_at timestamptz default now()
);

-- Portal Access
create table portal_access (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  email text not null,
  name text,
  token text unique not null,
  last_accessed_at timestamptz,
  created_at timestamptz default now(),
  unique(org_id, client_id, email)
);

-- Creatives
create table creatives (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  image_url text,
  headline text,
  body_copy text,
  cta text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'launched')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejected_reason text,
  generated_by text,
  generation_prompt text,
  created_at timestamptz default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_ad_insights_account_date on ad_insights(ad_account_id, date desc);
create index idx_ad_insights_org_date on ad_insights(org_id, date desc);
create index idx_ad_insights_campaign_date on ad_insights(campaign_id, date desc);
create index idx_ad_insights_ad_set_date on ad_insights(ad_set_id, date desc);
create index idx_ad_breakdowns_account_date on ad_breakdowns(ad_account_id, date desc, breakdown_type);
create index idx_activity_log_org on activity_log(org_id, created_at desc);
create index idx_ai_insights_org on ai_insights(org_id, created_at desc);
create index idx_clients_org on clients(org_id);
create index idx_ad_accounts_client on ad_accounts(client_id);
create index idx_campaigns_account on campaigns(ad_account_id);
create index idx_ad_sets_campaign on ad_sets(campaign_id);
create index idx_ads_ad_set on ads(ad_set_id);
create index idx_creatives_client on creatives(client_id, status);

-- ============================================================
-- RLS Policies
-- ============================================================

alter table organizations enable row level security;
alter table org_members enable row level security;
alter table clients enable row level security;
alter table ad_accounts enable row level security;
alter table campaigns enable row level security;
alter table ad_sets enable row level security;
alter table ads enable row level security;
alter table ad_insights enable row level security;
alter table ad_breakdowns enable row level security;
alter table integrations enable row level security;
alter table financial_records enable row level security;
alter table activity_log enable row level security;
alter table ai_insights enable row level security;
alter table portal_access enable row level security;
alter table creatives enable row level security;

-- Helper function: get user's org IDs
create or replace function auth.user_org_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select org_id from org_members where user_id = auth.uid()
$$;

-- Organizations: members can see their orgs
create policy "org_member_select" on organizations
  for select using (id in (select auth.user_org_ids()));

-- Org Members: members can see their org's members
create policy "org_member_select" on org_members
  for select using (org_id in (select auth.user_org_ids()));

-- All other tables: org-scoped select
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'clients', 'ad_accounts', 'campaigns', 'ad_sets', 'ads',
    'ad_insights', 'ad_breakdowns', 'integrations', 'financial_records',
    'activity_log', 'ai_insights', 'portal_access', 'creatives'
  ]) loop
    execute format(
      'create policy "org_scoped_select" on %I for select using (org_id in (select auth.user_org_ids()))',
      t
    );
  end loop;
end;
$$;

-- Service role bypasses RLS (for sync jobs + Pegasus)
-- This is automatic in Supabase when using service_role key
