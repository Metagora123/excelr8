-- Schema-only dump from current Supabase project (public schema)
-- Run this in your NEW project: Supabase Dashboard → SQL Editor → paste & Run
-- No data is included.

-- 1. Custom enum type
CREATE TYPE public.lead_status AS ENUM (
  'new',
  'interested',
  'not interested',
  'qualified',
  'enriched',
  'invited',
  'messaged',
  'renewed'
);

-- 2. Tables (order respects foreign keys)
CREATE TABLE public.persons (
  personid integer,
  lastname character varying(255),
  firstname character varying(255),
  address character varying(255),
  city character varying(255)
);

CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (name)
);

COMMENT ON TABLE public.clients IS 'Clients (e.g. EXCELR8, Metagora). One campaign per lead per client.';

CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  status public.lead_status DEFAULT 'new'::public.lead_status,
  description text,
  company_name text,
  profile_url text,
  identifier text,
  email text,
  about_summary text,
  personality text,
  expertise text,
  tech_stack_tags text,
  company_description text,
  profile_picture_url text,
  followers_count bigint,
  connections_count bigint,
  phone text,
  tier text,
  score smallint,
  title text,
  location text,
  is_dossier boolean DEFAULT false,
  dossier_url text,
  is_campaigned text,
  PRIMARY KEY (id)
);

CREATE TABLE public.campaigns (
  id uuid NOT NULL,
  name text NOT NULL,
  description text,
  campaign_type text,
  target_criteria jsonb,
  tags text[],
  total_leads integer DEFAULT 0,
  engaged_leads integer DEFAULT 0,
  conversion_rate numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  created_by text,
  assigned_to text,
  notes text,
  goals jsonb,
  client_id uuid,
  status text DEFAULT 'draft'::text,
  messages_sent integer NOT NULL DEFAULT 0,
  invites_sent integer NOT NULL DEFAULT 0,
  replies_received integer NOT NULL DEFAULT 0,
  comments_made integer NOT NULL DEFAULT 0,
  likes_reactions integer NOT NULL DEFAULT 0,
  airtable_url text,
  PRIMARY KEY (id),
  CONSTRAINT campaigns_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);

COMMENT ON COLUMN public.campaigns.messages_sent IS 'LinkedIn messages sent (outreach count)';
COMMENT ON COLUMN public.campaigns.invites_sent IS 'LinkedIn connection invites sent';
COMMENT ON COLUMN public.campaigns.replies_received IS 'Replies received from leads (intent signal)';
COMMENT ON COLUMN public.campaigns.comments_made IS 'Comments made (engagement)';
COMMENT ON COLUMN public.campaigns.likes_reactions IS 'Likes / reactions added (light engagement)';

CREATE TABLE public.unipile_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  username text NOT NULL,
  account_id text NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE public.lead_campaigns (
  lead_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  client_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  status text,
  PRIMARY KEY (lead_id, client_id),
  CONSTRAINT lead_campaigns_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id),
  CONSTRAINT lead_campaigns_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT lead_campaigns_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);

COMMENT ON TABLE public.lead_campaigns IS 'Which campaign each lead is in per client. One row per (lead, client).';

CREATE TABLE public.lead_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  sender_type character varying(20) NOT NULL,
  messages json NOT NULL,
  notes text,
  authority_level text,
  intent_signal text,
  interest_level text,
  message_id text,
  chat_id text,
  capmaign_id uuid,
  CONSTRAINT lead_messages_sender_type_check CHECK (sender_type::text = ANY (ARRAY['agent'::character varying, 'human'::character varying, 'unipile-bot'::character varying]::text[])),
  PRIMARY KEY (id),
  CONSTRAINT lead_messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id),
  CONSTRAINT lead_messages_capmaign_id_fkey FOREIGN KEY (capmaign_id) REFERENCES public.campaigns(id)
);

CREATE TABLE public.lead_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  linkedin_post_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  lead_name text,
  content text,
  comments smallint,
  reactions smallint,
  post_url text,
  topic text,
  is_repost boolean,
  status text DEFAULT 'new'::text,
  lead_company text,
  updated_at timestamptz,
  commentators json,
  reactioners json,
  PRIMARY KEY (id),
  UNIQUE (linkedin_post_id),
  CONSTRAINT lead_posts_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id)
);

CREATE TABLE public.dossiers (
  id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
  created_at timestamptz NOT NULL DEFAULT now(),
  html_snippet text,
  dossier_data json,
  lead_id uuid DEFAULT gen_random_uuid(),
  lead_name text,
  PRIMARY KEY (id),
  CONSTRAINT dossiers_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id)
);

-- in_app_campaign_automations: one row per campaign with hitlist automation (Campaign Automations page).
CREATE TABLE public.in_app_campaign_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  airtable_base_id text NOT NULL,
  airtable_table_id text NOT NULL,
  schedule_cron text NOT NULL DEFAULT '0 6 * * *',
  is_active boolean NOT NULL DEFAULT true,
  default_unipile_sender_id uuid REFERENCES public.unipile_accounts(id),
  total_invites_sent integer NOT NULL DEFAULT 0,
  invites_sent_today integer NOT NULL DEFAULT 0,
  total_to_be_messaged integer NOT NULL DEFAULT 0,
  total_rejected integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  last_run_status text,
  run_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id)
);

CREATE INDEX idx_in_app_campaign_automations_campaign_id ON public.in_app_campaign_automations (campaign_id);
CREATE INDEX idx_in_app_campaign_automations_is_active ON public.in_app_campaign_automations (is_active);

COMMENT ON TABLE public.in_app_campaign_automations IS 'Hitlist automation config, metrics, and run logs per campaign. Campaign Automations page + KPI.';

-- 3. Non-primary-key indexes
CREATE INDEX idx_campaigns_client_id ON public.campaigns USING btree (client_id);
CREATE INDEX idx_lead_campaigns_lead_id ON public.lead_campaigns USING btree (lead_id);
CREATE INDEX idx_lead_campaigns_campaign_id ON public.lead_campaigns USING btree (campaign_id);

-- 4. Enable RLS (same as source; no policies defined in source)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unipile_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_campaigns ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.in_app_campaign_automations ENABLE ROW LEVEL SECURITY;

-- Done. Tables: persons, clients, leads, campaigns, unipile_accounts, lead_campaigns, lead_messages, lead_posts, dossiers, in_app_campaign_automations
