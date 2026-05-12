-- =============================================================================
-- Mar 11, 2026 — Supabase migration for in-app messaging + Airtable dual-button
-- =============================================================================
--
-- HOW TO APPLY:
--   1. Open Supabase → SQL editor.
--   2. Paste the entire file and run on the `sales2k25` project.
--   3. Repeat on the `prod2k26` project.
--   4. Idempotent: re-running is safe (every statement uses IF NOT EXISTS).
--
-- ROLLBACK: see the very bottom of this file (commented out).
--
-- Owner: Musab. Generated alongside docs/MAR-11-IMPLEMENTATION-PLAN.md.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) in_app_campaign_automations — messaging toggle, daily DM quota,
--    per-campaign Airtable-button secret, and a "legacy migration done" flag.
-- -----------------------------------------------------------------------------

alter table in_app_campaign_automations
  add column if not exists messaging_runner text not null default 'off'
    check (messaging_runner in ('off', 'in_app')),

  add column if not exists messaging_quota_daily integer not null default 30,

  add column if not exists messages_sent_today integer not null default 0,

  add column if not exists messages_sent_today_date date,

  add column if not exists airtable_button_token text not null default gen_random_uuid(),

  add column if not exists legacy_migrated boolean not null default false;


-- -----------------------------------------------------------------------------
-- 2) lead_campaigns — internal mirror of message lifecycle + per-message
--    timestamps used for tempo math. Nothing here is mirrored to Airtable;
--    `acceptance_detected_at` is the baseline the scheduler uses to compute
--    when Message_1 is due (Tempo_1 days after acceptance), and so on.
-- -----------------------------------------------------------------------------

alter table lead_campaigns
  add column if not exists message_status text default 'fresh'
    check (message_status in (
      'fresh',
      'invited',
      'to_be_messaged',
      'message_1_sent',
      'message_2_sent',
      'messaged',
      'invite_failed',
      'messaging_failed'
    )),

  add column if not exists acceptance_detected_at timestamptz,

  add column if not exists message_1_sent_at timestamptz,

  add column if not exists message_2_sent_at timestamptz,

  add column if not exists message_3_sent_at timestamptz;


-- -----------------------------------------------------------------------------
-- 3) Indexes — the scheduler runs the same lookup every cron tick, so an
--    index on (campaign_id, message_status) avoids a full scan as
--    lead_campaigns grows.
-- -----------------------------------------------------------------------------

create index if not exists idx_lead_campaigns_campaign_message_status
  on lead_campaigns (campaign_id, message_status);

create index if not exists idx_lead_campaigns_message_status
  on lead_campaigns (message_status)
  where message_status not in ('messaged', 'invite_failed', 'messaging_failed');


-- -----------------------------------------------------------------------------
-- 4) Sanity-check views (read-only, no behavioural impact).
--    Quick way to spot stuck or anomalous leads from the SQL editor.
-- -----------------------------------------------------------------------------

create or replace view v_lead_campaigns_status_summary as
  select
    campaign_id,
    message_status,
    count(*) as lead_count,
    min(joined_at) as first_lead_joined_at,
    max(joined_at) as last_lead_joined_at
  from lead_campaigns
  group by campaign_id, message_status
  order by campaign_id, message_status;


-- -----------------------------------------------------------------------------
-- 5) NOTHING IS BACKFILLED HERE ON PURPOSE.
--    Existing rows get message_status='fresh' by default. The new code will
--    reconcile statuses as it processes leads through the cron passes
--    (invite → accept → message). The migration of legacy `to_be_messaged`
--    rows that were actually invite failures is handled at runtime in
--    `migrateLegacyToBeMessaged()` per-automation, gated by `legacy_migrated`.
-- -----------------------------------------------------------------------------


-- =============================================================================
-- ROLLBACK (DO NOT RUN unless deliberately reverting Mar-11):
-- =============================================================================
--
-- drop view if exists v_lead_campaigns_status_summary;
--
-- drop index if exists idx_lead_campaigns_campaign_message_status;
-- drop index if exists idx_lead_campaigns_message_status;
--
-- alter table lead_campaigns
--   drop column if exists message_status,
--   drop column if exists acceptance_detected_at,
--   drop column if exists message_1_sent_at,
--   drop column if exists message_2_sent_at,
--   drop column if exists message_3_sent_at;
--
-- alter table in_app_campaign_automations
--   drop column if exists messaging_runner,
--   drop column if exists messaging_quota_daily,
--   drop column if exists messages_sent_today,
--   drop column if exists messages_sent_today_date,
--   drop column if exists airtable_button_token,
--   drop column if exists legacy_migrated;
--
-- =============================================================================
