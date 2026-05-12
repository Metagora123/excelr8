# Flow diagrams

Visual flows for main actions. **More diagrams, less text.**

---

## Create In-App Campaign

What happens when you click **Create Campaign In-App** (CSV + client + options).

```mermaid
flowchart LR
  subgraph Input
    A[CSV file]
    B[Client, category, managed by]
    C[Options: Airtable, n8n, enrichment]
  end

  subgraph Step1["1. Supabase"]
    D[Campaign row]
    E[Leads upsert]
    F[lead_campaigns]
  end

  subgraph Step2["2. Enrichment"]
    G[Unipile: profile + posts]
    H[lead_posts]
  end

  subgraph Step3["3. Airtable"]
    I[Hitlist table + rows]
    J[Auto Like table + rows from lead_posts]
  end

  subgraph Step4["4. n8n"]
    K[Duplicate Hitlist workflow]
    L[Duplicate Auto Like workflow]
  end

  A --> D
  B --> D
  D --> E --> F
  E --> G --> H
  H --> J
  F --> I
  I --> K
  J --> L
```

```mermaid
flowchart TD
  Start([Click Create In-App]) --> Parse[Parse CSV, apply exclude rows]
  Parse --> CreateCampaign[Create campaign row]
  CreateCampaign --> Upsert[Upsert leads + lead_campaigns]
  Upsert --> Enrich[Enrich leads: Unipile profile + posts → lead_posts]
  Enrich --> Hitlist[Airtable: create Hitlist table, append leads]
  Enrich --> AutoLike[Airtable: create Auto Like table, append from lead_posts]
  Hitlist --> N8NHitlist[n8n: duplicate Hitlist workflow]
  AutoLike --> N8NAutoLike[n8n: duplicate Auto Like workflow]
  N8NHitlist --> Done([Done: campaign + tables + workflows])
  N8NAutoLike --> Done
```

---

## Hitlist automations

As of Mar 11, `runCampaignAutomation` is an **orchestrator** that runs three passes in order: **Invite → Acceptance → Messaging** (the last one only when the per-campaign `messaging_runner` toggle is `in_app`). Errors are classified as **transient** (retry next run, status stays unchanged) or **permanent** (status flips to one of the new terminal states).

```mermaid
flowchart LR
  fresh[fresh] -->|invite OK| invited[invited]
  invited -->|degree=1| to_be_messaged[to_be_messaged]
  to_be_messaged -->|Tempo_1 elapsed| m1[message_1_sent]
  m1 -->|Tempo_2 elapsed| m2[message_2_sent]
  m2 -->|Tempo_3 elapsed| messaged[messaged]
  fresh -->|permanent invite fail| invite_failed[invite_failed]
  to_be_messaged -->|send permanently fails| messaging_failed[messaging_failed]
  m1 --> messaging_failed
  m2 --> messaging_failed
```

The legacy "all-in-one" flow below is now the **Invite pass only**. The acceptance and messaging passes follow after.

```mermaid
flowchart TD
  Start([Run: cron or Run now]) --> Load[Load automation + Airtable base/table]
  Load --> Fetch[Fetch Airtable rows with status = fresh]
  Fetch --> Loop{For each row}
  Loop --> HasURL{Has LinkedIn URL?}
  HasURL -->|No| Skip[step = skip<br/>total_rejected++<br/>no Airtable change]
  HasURL -->|Yes| Messages{Message_1 set?}
  Messages -->|No| Gen[Generate Message_1/2/3<br/>from leads + lead_posts]
  Gen --> UpdateMsg[Update Airtable: Message_1, 2, 3]
  UpdateMsg --> Profile
  Messages -->|Yes| Profile[Resolve profile via Unipile]
  Profile --> ProfErr{Profile error?}
  ProfErr -->|Transient<br/>429 / 5xx / network| RetryProf[step = retry_pending<br/>Airtable stays fresh<br/>retry next run]
  ProfErr -->|Permanent<br/>404 / 4xx / no provider_id| ProfFail[step = profile_not_found or<br/>unipile_profile_error<br/>Airtable status = to_be_messaged<br/>total_to_be_messaged++]
  ProfErr -->|None| Invite[Send Unipile invite]
  Invite --> Result{Invite result?}
  Result -->|OK| UpdateInvited[Airtable status = invited<br/>total_invites_sent++<br/>mirror campaigns.invites_sent]
  Result -->|Transient<br/>429 / 5xx / network| RetryInvite[step = retry_pending<br/>Airtable stays fresh<br/>retry next run]
  Result -->|Permanent<br/>4xx other than 429| InviteFail[step = invite_failed<br/>Airtable status = to_be_messaged<br/>total_to_be_messaged++]
  UpdateInvited --> Log[Append entry to run_logs]
  ProfFail --> Log
  InviteFail --> Log
  RetryProf --> Log
  RetryInvite --> Log
  Skip --> Log
  Log --> Loop
  Loop --> End([End])
```

```mermaid
sequenceDiagram
  participant Cron as Cron / Run now
  participant API as Dashboard API
  participant Supabase
  participant Airtable
  participant Unipile

  Cron->>API: Trigger run
  API->>Supabase: Load automation
  API->>Airtable: List rows status=fresh
  loop Each row
    API->>Supabase: Get lead + lead_posts (for messages)
    API->>API: Generate Message_1/2/3 if empty
    API->>Airtable: PATCH Message_1, 2, 3
    API->>Unipile: Resolve profile
    alt Profile transient error (429 / 5xx / network)
      API->>API: step=retry_pending, transient=true
      Note over Airtable: status stays "fresh" — retry next run
    else Profile permanent error
      API->>Airtable: PATCH status=to_be_messaged
    else Profile OK
      API->>Unipile: Send invite
      alt Invite OK
        API->>Airtable: PATCH status=invited
        API->>Supabase: total_invites_sent++ (source of truth)
        API->>Supabase: mirror campaigns.invites_sent (back-compat)
      else Invite transient (429 / 5xx / network)
        API->>API: step=retry_pending, transient=true
        Note over Airtable: status stays "fresh" — retry next run
      else Invite permanent
        API->>Airtable: PATCH status=to_be_messaged
      end
    end
    API->>Supabase: Append to in_app_campaign_automations.run_logs
  end
```

### Acceptance pass (always-on)

```mermaid
sequenceDiagram
  participant Cron as Daily cron
  participant API as Dashboard API
  participant Airtable
  participant Unipile
  participant Supabase

  Cron->>API: runAcceptancePass(automationId)
  API->>Airtable: List rows status=invited
  loop Each invited row
    API->>Unipile: GET profile (with degree)
    alt Transient
      API->>API: step=retry_pending (no change)
    else degree != 1
      API->>API: step=still_invited (no change)
    else degree == 1 (accepted)
      API->>Airtable: PATCH status=to_be_messaged
      API->>Supabase: lead_campaigns.message_status=to_be_messaged, acceptance_detected_at=now
      API->>API: step=accepted
    end
  end
```

### Messaging pass (toggle: in_app)

```mermaid
sequenceDiagram
  participant Cron as Daily cron / Run messaging now
  participant API as Dashboard API
  participant Airtable
  participant Unipile
  participant Supabase

  Cron->>API: runMessagingPass(automationId)
  Note over API: if messaging_runner != 'in_app' AND !force → return
  API->>API: Reset messages_sent_today if day changed
  API->>Airtable: List rows in {to_be_messaged, message_1_sent, message_2_sent}
  loop Each row (stops at messaging_quota_daily)
    API->>API: nextMessage = M1/M2/M3 based on status
    API->>Supabase: Read baseline timestamp from lead_campaigns
    API->>API: Parse Tempo_X (else default 0/3/3); write back if blank
    alt Not due yet
      API->>API: step=not_due, skip
    else Due
      API->>Unipile: Re-fetch profile (confirm degree=1)
      alt Lead un-accepted
        API->>Airtable: PATCH status=messaging_failed
        API->>Supabase: message_status=messaging_failed
      else OK
        API->>Unipile: POST /api/v1/chats {attendees_ids, text}
        alt Transient
          API->>API: step=retry_pending (no change)
        else Permanent fail
          API->>Airtable: PATCH status=messaging_failed
        else Success
          API->>Airtable: PATCH status=next (message_X_sent or messaged)
          API->>Supabase: message_status=next, message_X_sent_at=now
          API->>API: messages_sent_today++
        end
      end
    end
  end
```

### Airtable in-app button trigger

```mermaid
sequenceDiagram
  participant User
  participant Airtable
  participant API as /api/airtable/trigger
  participant Supabase

  User->>Airtable: Click In_App_Button on a row
  Airtable->>API: GET ?campaign_id=&record_id=&token=
  API->>Supabase: Find automation by campaign_id; verify token
  alt Token mismatch
    API-->>User: HTML 401 page
  else Token OK
    API->>Airtable: GET row to read current status
    alt status=fresh
      API->>API: runInvitePass(recordIds=[id])
    else status=invited
      API->>API: runAcceptancePass(recordIds=[id])
    else status in {to_be_messaged, message_1_sent, message_2_sent}
      API->>API: runMessagingPass(recordIds=[id], force=true)
    else terminal
      API->>API: noop
    end
    API-->>User: HTML confirmation page + link to /campaign-status
  end
```

### KPI bucket mapping (read side)

The KPI dashboard reads `run_logs[].leads[].step` and groups them as follows. The `total_*` counter columns on `in_app_campaign_automations` continue to track cumulatives, but the dashboard's per-bucket counts come from the run log to give an honest split.

```mermaid
flowchart LR
  subgraph RunLogs["in_app_campaign_automations.run_logs[].leads[].step"]
    invited[invited]
    invite_failed[invite_failed]
    profile_not_found[profile_not_found]
    unipile_profile_error[unipile_profile_error]
    skip[skip]
    retry_pending[retry_pending]
  end

  subgraph KPI["KPI dashboard tiles"]
    InvSent[Invites Sent]
    SendFail[Send failed]
    ProfUnreach[Profile unreachable]
    Skipped[Skipped — bad input]
    Retry[Retry pending]
  end

  invited --> InvSent
  invite_failed --> SendFail
  profile_not_found --> ProfUnreach
  unipile_profile_error --> ProfUnreach
  skip --> Skipped
  retry_pending --> Retry
```

---

## Auto Like / Auto Comment

How the **Auto Like / Auto Comment** table and automation fit together.

```mermaid
flowchart LR
  subgraph Create["Create In-App (one-time)"]
    P[lead_posts]
    T[Create Auto Like table]
    Append[Append rows: post_content, commentators, reactioners]
    Dup[Duplicate n8n Auto Like workflow]
  end

  subgraph Run["Ongoing (n8n)"]
    N8N[n8n workflow]
    Read[Read Airtable rows]
    Act[Like / comment on LinkedIn]
  end

  P --> T --> Append
  Append --> Dup
  Dup --> N8N
  N8N --> Read --> Act
```

```mermaid
flowchart TD
  A[Campaign created with Auto Like option] --> B[lead_posts populated by enrichment]
  B --> C[Create Airtable table: AUTO-LIKE-COMMENT-...]
  C --> D[Append one row per post: lead_name, post_content, commentators, reactioners]
  D --> E[Duplicate n8n workflow → linked to table]
  E --> F[n8n runs on schedule or trigger]
  F --> G[Read rows → like/comment via Unipile or integration]
```

---

## HubSpot sync

What happens when you run **HubSpot sync**.

```mermaid
flowchart LR
  subgraph Source["Supabase"]
    L[leads]
    C[campaigns]
    LC[lead_campaigns]
  end

  subgraph Sync["Sync"]
    Map[Map leads → contacts]
    Deals[Map campaigns → deals]
    KPIs[Invites, messages, replies, etc.]
  end

  subgraph Target["HubSpot"]
    Contacts[Contacts]
    DealsOut[Deals]
  end

  L --> Map --> Contacts
  C --> Deals --> DealsOut
  LC --> Map
  C --> KPIs --> DealsOut
```

```mermaid
flowchart TD
  Start([Run HubSpot sync]) --> Read[Read leads + campaigns from Supabase]
  Read --> Contacts[Create/update HubSpot contacts]
  Read --> Deals[Create/update HubSpot deals]
  Contacts --> Link[Associate contacts to deals]
  Deals --> KPIs[Update deal properties: invites_sent, messages_sent, ...]
  KPIs --> End([Done])
```

---

## Post Radar

How **Post Radar** gets and uses data.

```mermaid
flowchart LR
  subgraph Data["Data source"]
    LP[lead_posts]
    L[leads]
  end

  subgraph Radar["Post Radar"]
    Load[Load posts + commentators + reactioners]
    UI[Show top posts, comment/reaction counts]
    ICP[Optional: ICP scoring via OpenAI]
  end

  LP --> Load --> UI
  L --> Load
  UI --> ICP
```

```mermaid
flowchart TD
  A[lead_posts in Supabase] --> B[Radar page loads posts]
  B --> C[Display: post content, commentators, reactioners]
  C --> D{Use ICP?}
  D -->|Yes| E[Send people to OpenAI with criteria]
  E --> F[Show match scores]
  D -->|No| G[Browse only]
  F --> H[Prioritize outreach]
  G --> H
```
