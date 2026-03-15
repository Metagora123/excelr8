-- Auto Like / Auto Comment automations: one row per campaign that has an Auto Like Airtable table.
-- Run generates 4 comments (comment_a–d) per post and writes them back to Airtable.

CREATE TABLE public.in_app_auto_comment_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,

  -- Config: which Airtable table (Auto Like table) to read post_content from and write comment_a/b/c/d to
  airtable_base_id text NOT NULL,
  airtable_table_id text NOT NULL,

  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_run_status text,

  -- Logs: append one object per run. Each element: { run_date, started_at, finished_at, status, processed_count, failed_count, records: [ { record_id, lead_name?, error? } ] }
  run_logs jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (campaign_id)
);

CREATE INDEX idx_in_app_auto_comment_automations_campaign_id
  ON public.in_app_auto_comment_automations (campaign_id);

ALTER TABLE public.in_app_auto_comment_automations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.in_app_auto_comment_automations IS 'Auto Like / Auto Comment automation: generate 4 comments per post and write to Airtable.';
