# 🏗️ Excelr8 Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Excelr8 Frontend                         │
│                      (React + Vite + Tailwind)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Dashboard   │  │     File     │  │   Dossiers   │          │
│  │     Page     │  │  Ingestion   │  │     Page     │          │
│  │              │  │     Page     │  │              │          │
│  │  • Stats     │  │  • CSV Drop  │  │  • Grid View │          │
│  │  • Charts    │  │  • Upload    │  │  • Search    │          │
│  │  • Tables    │  │  • Endpoints │  │  • Filters   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
└─────────┼─────────────────┼──────────────────┼───────────────────┘
          │                 │                  │
          │                 │                  │
          ▼                 ▼                  ▼
     ┌────────────────────────────────────────────┐
     │           React Router Navigation           │
     └────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Supabase    │  │   Airtable   │  │  n8n Webhook │
│   Client     │  │    Client    │  │    Client    │
│  (supabase.js)│  │(airtable.js) │  │ (fetch API)  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│              │  │              │  │              │
│  Supabase    │  │  Airtable    │  │     n8n      │
│  PostgreSQL  │  │     API      │  │   Workflow   │
│              │  │              │  │              │
│  • leads     │  │  • Leads     │  │  • webhook-  │
│    table     │  │    table     │  │    test      │
│              │  │              │  │  • webhook   │
│  • RLS       │  │  • REST      │  │              │
│  • Indexes   │  │    API       │  │  • Clay      │
│              │  │              │  │    ingestion │
└──────────────┘  └──────────────┘  └──────┬───────┘
                                           │
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │      S3      │
                                    │    Bucket    │
                                    │              │
                                    │  • Dossier   │
                                    │    PDFs      │
                                    │  • URLs in   │
                                    │    Supabase  │
                                    └──────────────┘
```

## Data Flow Diagrams

### Dashboard Page Data Flow
```
User Opens Dashboard
        │
        ▼
  Fetch from Supabase
    (leadQueries.getStats)
    (leadQueries.getAll)
        │
        ▼
   Process Data
    • Calculate stats
    • Prepare chart data
    • Format table data
        │
        ▼
  Render Components
    • Stat Cards
    • Charts (Recharts)
    • Recent Leads Table
```

### File Ingestion Flow
```
User Selects CSV
        │
        ▼
  Drag & Drop or Browse
        │
        ▼
   File Validation
    (Must be .csv)
        │
        ▼
  Select Endpoint
  (Test or Production)
        │
        ▼
   Create FormData
        │
        ▼
  POST to n8n Webhook
  /webhook-test/clay OR
  /webhook/clay
        │
        ▼
   n8n Processes File
    • Parses CSV
    • Enriches data
    • Stores in Supabase
        │
        ▼
  Response to User
   (Success/Error)
```

### Dossiers Page Data Flow
```
User Opens Dossiers
        │
        ▼
  Fetch from Supabase
   (leadQueries.getWithDossiers)
        │
        ▼
  Filter where is_dossier = TRUE
        │
        ▼
  Display Dossier Cards
    • Profile picture
    • Basic info
    • Tags
    • Actions
        │
        ▼
  User Interactions:
        │
        ├─ Search ──────> Filter in memory
        │
        ├─ Filter Tier ─> Filter in memory
        │
        ├─ Filter Status > Filter in memory
        │
        ├─ Click Card ──> Open Modal
        │                  (Full details)
        │
        ├─ Download ────> Open dossier_url
        │                  (S3 PDF link)
        │
        └─ View Profile > Open profile_url
                          (LinkedIn/etc)
```

## Component Hierarchy

```
App.jsx (Router)
  │
  └─ Layout.jsx (Navigation + Footer)
      │
      ├─ Dashboard.jsx
      │   ├─ StatCard (x4)
      │   ├─ PieChart (Status)
      │   ├─ BarChart (Tier)
      │   ├─ LineChart (Growth)
      │   └─ LeadsTable
      │
      ├─ FileIngestion.jsx
      │   ├─ EndpointSelector
      │   ├─ DropZone
      │   ├─ FilePreview
      │   ├─ StatusMessage
      │   └─ UploadButton
      │
      └─ Dossiers.jsx
          ├─ SearchBar
          ├─ TierFilter
          ├─ StatusFilter
          ├─ DossierCard (x N)
          │   ├─ ProfileImage
          │   ├─ BasicInfo
          │   ├─ Badges
          │   └─ ActionButtons
          └─ DossierModal
              ├─ DetailedInfo
              ├─ AIInsights
              ├─ SocialStats
              └─ DownloadButtons
```

## State Management

```
Global State (React Router)
  └─ Current Route

Page-Level State (useState)
  │
  ├─ Dashboard.jsx
  │   ├─ loading: boolean
  │   ├─ stats: object
  │   ├─ leads: array
  │   └─ refreshing: boolean
  │
  ├─ FileIngestion.jsx
  │   ├─ file: File | null
  │   ├─ uploading: boolean
  │   ├─ status: object | null
  │   ├─ isDragging: boolean
  │   └─ endpoint: string
  │
  └─ Dossiers.jsx
      ├─ loading: boolean
      ├─ dossiers: array
      ├─ filteredDossiers: array
      ├─ searchTerm: string
      ├─ filterTier: string
      ├─ filterStatus: string
      └─ selectedDossier: object | null
```

## API Endpoints

### Supabase REST API
```
GET  /rest/v1/leads
  → Query all leads
  
GET  /rest/v1/leads?is_dossier=eq.true
  → Query leads with dossiers
  
GET  /rest/v1/leads?select=*&status=eq.qualified
  → Query by status
  
POST /rest/v1/leads
  → Create new lead
```

### Airtable API
```
GET  https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}
  → Get all records
  
GET  https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}/{RECORD_ID}
  → Get single record
  
POST https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}
  → Create record
```

### n8n Webhooks
```
POST https://excelr8.app.n8n.cloud/webhook-test/clay
  → Test environment upload
  
POST https://excelr8.app.n8n.cloud/webhook/clay
  → Production environment upload
```

## Security Architecture

```
Frontend (Browser)
  │
  ├─ Environment Variables
  │   └─ VITE_* (exposed to client)
  │
  ├─ Supabase Client
  │   ├─ Anon Key (public)
  │   └─ RLS Policies (server)
  │
  └─ API Calls
      │
      ├─ Supabase
      │   └─ Row Level Security
      │       ├─ Check user auth
      │       └─ Filter data
      │
      ├─ Airtable
      │   └─ Personal Access Token
      │       └─ Bearer auth
      │
      └─ n8n
          └─ Webhook URL
              └─ No auth (internal)
```

## Performance Optimizations

```
Frontend
  │
  ├─ React.memo
  │   └─ Memoize expensive components
  │
  ├─ useCallback
  │   └─ Prevent function recreation
  │
  ├─ Lazy Loading
  │   └─ Code splitting (optional)
  │
  └─ Debouncing
      └─ Search input delay

Database
  │
  ├─ Indexes
  │   ├─ created_at (DESC)
  │   ├─ is_dossier (WHERE TRUE)
  │   ├─ status
  │   └─ tier
  │
  └─ Selective Queries
      └─ Only fetch needed columns
```

## Deployment Architecture

```
Development
  │
  ├─ Local: http://localhost:3000
  ├─ Vite Dev Server
  └─ Hot Module Replacement

Production
  │
  ├─ Build: npm run build
  │   └─ Outputs to dist/
  │
  ├─ Static Hosting
  │   ├─ Vercel (recommended)
  │   ├─ Netlify
  │   └─ Any static host
  │
  └─ Environment Variables
      └─ Set in hosting platform
```

## Error Handling Flow

```
API Call Error
  │
  ├─ Network Error
  │   └─ Show "Connection failed" message
  │
  ├─ Auth Error
  │   └─ Redirect to login (if implemented)
  │
  ├─ Permission Error
  │   └─ Show "Access denied" message
  │
  └─ Server Error
      └─ Show error details
      └─ Log to console
```

---

This architecture provides:
- ✅ Separation of concerns
- ✅ Scalable component structure
- ✅ Clear data flow
- ✅ Security best practices
- ✅ Performance optimizations
- ✅ Error resilience
