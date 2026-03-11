-- In-app campaign automations: one row per campaign that has hitlist automation.
-- Holds config, metrics, and run_logs (append per run) for the Campaign Automation UI.

CREATE TABLE public.in_app_campaign_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,

  -- Config
  airtable_base_id text NOT NULL,
  airtable_table_id text NOT NULL,
  schedule_cron text NOT NULL DEFAULT '0 6 * * *',
  is_active boolean NOT NULL DEFAULT true,
  default_unipile_sender_id uuid REFERENCES public.unipile_accounts(id),

  -- Metrics (updated when invites sent / to_be_messaged / rejected)
  total_invites_sent integer NOT NULL DEFAULT 0,
  invites_sent_today integer NOT NULL DEFAULT 0,
  total_to_be_messaged integer NOT NULL DEFAULT 0,
  total_rejected integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  last_run_status text,

  -- Logs: append one object per run. UI shows by run_date.
  -- Each element: { run_date, started_at, finished_at, status, invited_count, to_be_messaged_count, rejected_count, leads: [ { lead_id?, airtable_record_id?, linkedin_url?, step, unipile_degree?, unipile_response_snippet?, request_curl?, decision, error? } ] }
  run_logs jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (campaign_id)
);

CREATE INDEX idx_in_app_campaign_automations_campaign_id
  ON public.in_app_campaign_automations (campaign_id);

CREATE INDEX idx_in_app_campaign_automations_is_active
  ON public.in_app_campaign_automations (is_active);

ALTER TABLE public.in_app_campaign_automations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.in_app_campaign_automations IS 'Hitlist automation config, metrics, and run logs per campaign. Logs displayed on Campaign Automation page.';
