# Excelr8 - AI Automation Services Dashboard

A modern React application for managing leads, dossiers, and file ingestion workflows with AI automation capabilities.

## 🚀 Features

- **Dashboard**: Real-time analytics and visualizations of lead data from Supabase and Airtable
- **File Ingestion**: CSV upload functionality with test and production endpoints
- **Dossiers**: View and manage AI-generated lead dossiers stored in S3

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher)
- npm or yarn
- A Supabase account and project
- An Airtable account with API access
- n8n webhook endpoints configured

## 🛠️ Installation

### Step 1: Clone and Install Dependencies

```bash
cd excelr8-app
npm install
```

### Step 2: Configure Environment Variables

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Then update the `.env` file with your actual credentials:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Airtable Configuration
VITE_AIRTABLE_API_KEY=your-airtable-api-key
VITE_AIRTABLE_BASE_ID=your-airtable-base-id
VITE_AIRTABLE_TABLE_NAME=Leads

# n8n Webhook Configuration
VITE_N8N_WEBHOOK_URL=https://excelr8.app.n8n.cloud
VITE_N8N_TEST_ENDPOINT=webhook-test
VITE_N8N_PROD_ENDPOINT=webhook

# S3 Configuration
VITE_S3_BUCKET=excelr8-dossiers
VITE_S3_REGION=us-east-1
```

### Step 3: Set Up Supabase Database

#### Create the `leads` table in Supabase

Run this SQL in your Supabase SQL Editor:

```sql
-- Create leads table
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  status TEXT,
  description TEXT,
  company_name TEXT,
  profile_url TEXT,
  identifier TEXT,
  email TEXT,
  about_summary TEXT,
  personality TEXT,
  expertise TEXT,
  tech_stack_tags TEXT,
  company_description TEXT,
  profile_picture_url TEXT,
  followers_count BIGINT,
  connections_count BIGINT,
  phone TEXT,
  tier TEXT,
  score SMALLINT,
  title TEXT,
  location TEXT,
  is_dossier BOOLEAN DEFAULT FALSE,
  dossier_url TEXT
);

-- Create index for better query performance
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_is_dossier ON leads(is_dossier) WHERE is_dossier = TRUE;
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_tier ON leads(tier);

-- Enable Row Level Security (RLS)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now (adjust based on your auth needs)
CREATE POLICY "Allow all operations on leads" ON leads
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

#### Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the "Project URL" → use as `VITE_SUPABASE_URL`
4. Copy the "anon public" key → use as `VITE_SUPABASE_ANON_KEY`

### Step 4: Set Up Airtable

1. Go to https://airtable.com/create/tokens
2. Create a new personal access token with `data.records:read` and `data.records:write` scopes
3. Copy the token → use as `VITE_AIRTABLE_API_KEY`
4. Get your Base ID from the Airtable API documentation for your base
5. Set your table name (default: "Leads")

### Step 5: Configure n8n Webhooks

Ensure your n8n workflows are set up with these endpoints:
- Test: `https://excelr8.app.n8n.cloud/webhook-test/clay`
- Production: `https://excelr8.app.n8n.cloud/webhook/clay`

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

The application will open at `http://localhost:3000`

### Production Build

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
excelr8-app/
├── src/
│   ├── components/
│   │   ├── Layout.jsx          # Main layout with navigation
│   │   └── LoadingSpinner.jsx  # Reusable loading component
│   ├── pages/
│   │   ├── Dashboard.jsx       # Analytics and charts
│   │   ├── FileIngestion.jsx   # CSV upload page
│   │   └── Dossiers.jsx        # Dossiers viewer
│   ├── lib/
│   │   ├── supabase.js         # Supabase client & queries
│   │   └── airtable.js         # Airtable API client
│   ├── styles/
│   │   └── index.css           # Global styles
│   ├── App.jsx                 # Main app with routing
│   └── main.jsx                # Entry point
├── .env                        # Environment variables
├── .env.example               # Environment template
├── package.json               # Dependencies
├── vite.config.js            # Vite configuration
├── tailwind.config.js        # Tailwind CSS config
└── README.md                 # This file
```

## 🧪 Testing

### Test Each Feature

#### 1. Dashboard
- Navigate to http://localhost:3000
- Verify that stats cards show data
- Check that charts render correctly
- Verify recent leads table displays

#### 2. File Ingestion
- Navigate to http://localhost:3000/ingestion
- Test drag-and-drop CSV upload
- Test file browser upload
- Try both Test and Production endpoints
- Verify success/error messages

#### 3. Dossiers
- Navigate to http://localhost:3000/dossiers
- Verify dossiers load and display
- Test search functionality
- Test tier and status filters
- Click on a dossier to view details
- Test download and view buttons

### Test Data for Supabase

Insert some test data into your `leads` table:

```sql
INSERT INTO leads (
  full_name,
  company_name,
  title,
  email,
  phone,
  location,
  status,
  tier,
  score,
  is_dossier,
  dossier_url,
  about_summary,
  profile_picture_url
) VALUES
(
  'John Doe',
  'Tech Corp',
  'Software Engineer',
  'john@techcorp.com',
  '+1-555-0123',
  'San Francisco, CA',
  'qualified',
  'Gold',
  85,
  TRUE,
  'https://example.com/dossier1.pdf',
  'Experienced software engineer specializing in cloud architecture and DevOps.',
  'https://i.pravatar.cc/150?img=1'
),
(
  'Jane Smith',
  'Innovation Labs',
  'Product Manager',
  'jane@innovationlabs.com',
  '+1-555-0124',
  'New York, NY',
  'contacted',
  'Silver',
  75,
  TRUE,
  'https://example.com/dossier2.pdf',
  'Product manager with expertise in AI/ML product development.',
  'https://i.pravatar.cc/150?img=2'
),
(
  'Bob Johnson',
  'StartupXYZ',
  'CEO',
  'bob@startupxyz.com',
  '+1-555-0125',
  'Austin, TX',
  'new',
  'Bronze',
  60,
  FALSE,
  NULL,
  'Serial entrepreneur with multiple successful exits.',
  'https://i.pravatar.cc/150?img=3'
);
```

## 🔧 Common Issues & Solutions

### Issue: "Missing Supabase environment variables"
**Solution**: Ensure `.env` file exists and contains valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Issue: No data showing on Dashboard
**Solution**: 
1. Check Supabase connection
2. Verify RLS policies allow read access
3. Ensure leads table has data

### Issue: File upload fails
**Solution**: 
1. Verify n8n webhook URLs are correct
2. Check CORS settings on n8n
3. Test webhook endpoint with curl

### Issue: Dossiers not loading
**Solution**: 
1. Check that `is_dossier` column is set to `TRUE` for some leads
2. Verify `dossier_url` contains valid URLs
3. Check browser console for errors

## 📊 Features Breakdown

### Dashboard Page
- **Stats Cards**: Total leads, dossiers count, average score, data sources
- **Charts**: 
  - Pie chart for status distribution
  - Bar chart for tier distribution
  - Line chart for lead growth timeline
- **Recent Leads Table**: Last 10 leads with key information

### File Ingestion Page
- Drag-and-drop CSV upload
- File browser selection
- Test/Production endpoint toggle
- Upload progress indicator
- Success/error notifications
- Auto-clear after successful upload

### Dossiers Page
- Grid view of all dossiers
- Search by name, company, or email
- Filter by tier (Gold/Silver/Bronze)
- Filter by status
- Detailed modal view
- Download PDF functionality
- External profile links

## 🎨 Customization

### Colors & Branding
Edit `tailwind.config.js` to customize the color scheme:

```javascript
colors: {
  primary: {
    500: '#0ea5e9', // Change to your brand color
    // ... other shades
  },
}
```

### Adding New Pages
1. Create a new component in `src/pages/`
2. Add route in `src/App.jsx`
3. Add navigation link in `src/components/Layout.jsx`

## 📦 Deployment

### Netlify
```bash
npm run build
# Deploy the 'dist' folder
```

### Vercel
```bash
npm run build
# Deploy with Vercel CLI or GitHub integration
```

### Environment Variables in Production
Make sure to add all environment variables in your hosting platform's settings.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - feel free to use this project for your needs.

## 🆘 Support

For issues or questions:
1. Check the Common Issues section above
2. Review Supabase and Airtable documentation
3. Open an issue in the repository

---

Built with ❤️ by Excelr8 - AI Automation Services
