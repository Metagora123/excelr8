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

What happens when a **Hitlist automation** runs (Run now or cron).

```mermaid
flowchart TD
  Start([Run: cron or Run now]) --> Load[Load automation + Airtable base/table]
  Load --> Fetch[Fetch Airtable rows with status = fresh]
  Fetch --> Loop{For each row}
  Loop --> HasURL{Has LinkedIn URL?}
  HasURL -->|No| Reject[Reject count]
  HasURL -->|Yes| Messages{Message_1 set?}
  Messages -->|No| Gen[Generate Message_1/2/3 from leads + lead_posts]
  Gen --> UpdateMsg[Update Airtable: Message_1, 2, 3]
  UpdateMsg --> Invite
  Messages -->|Yes| Invite[Resolve profile → Unipile invite]
  Invite --> Result{Invite OK?}
  Result -->|Yes| UpdateInvited[Update Airtable: status = invited]
  UpdateInvited --> UpdateCampaign[Update campaigns.invites_sent]
  UpdateCampaign --> Log[Log run + update in_app_campaign_automations]
  Result -->|No| ToBeMsg[Update Airtable: status = to_be_messaged]
  ToBeMsg --> Log
  Reject --> Loop
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
    API->>Unipile: Resolve profile + send invite
    API->>Airtable: PATCH status=invited
    API->>Supabase: Update campaigns.invites_sent + run_logs
  end
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
