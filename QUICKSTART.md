# ⚡ Quick Start Guide

Get your Excelr8 application running in 5 minutes!

## 📦 Step 1: Install Dependencies (1 min)

```bash
cd excelr8-app
npm install
```

## 🔐 Step 2: Configure Environment (2 min)

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your credentials
# Use nano, vim, or any text editor
nano .env
```

### Required Credentials:

**Supabase** (Get from: https://app.supabase.com/project/_/settings/api)
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Airtable** (Get from: https://airtable.com/create/tokens)
```
VITE_AIRTABLE_API_KEY=patxxxxxxxxxxxxxxxxx
VITE_AIRTABLE_BASE_ID=appxxxxxxxxxxxxxxxxx
VITE_AIRTABLE_TABLE_NAME=Leads
```

**n8n Webhooks** (Already configured)
```
VITE_N8N_WEBHOOK_URL=https://excelr8.app.n8n.cloud
VITE_N8N_TEST_ENDPOINT=webhook-test
VITE_N8N_PROD_ENDPOINT=webhook
```

## 🗄️ Step 3: Set Up Database (1 min)

Go to your Supabase SQL Editor and run:

```sql
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

CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_is_dossier ON leads(is_dossier) WHERE is_dossier = TRUE;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on leads" ON leads
  FOR ALL USING (true) WITH CHECK (true);
```

### Add Test Data:

```sql
INSERT INTO leads (full_name, company_name, title, email, status, tier, score, is_dossier, dossier_url, about_summary, profile_picture_url) 
VALUES
('John Doe', 'Tech Corp', 'Software Engineer', 'john@techcorp.com', 'qualified', 'Gold', 85, TRUE, 'https://example.com/dossier1.pdf', 'Experienced software engineer specializing in cloud architecture.', 'https://i.pravatar.cc/150?img=1'),
('Jane Smith', 'Innovation Labs', 'Product Manager', 'jane@innovationlabs.com', 'contacted', 'Silver', 75, TRUE, 'https://example.com/dossier2.pdf', 'Product manager with AI/ML expertise.', 'https://i.pravatar.cc/150?img=2');
```

## 🚀 Step 4: Start the App (1 min)

```bash
npm run dev
```

The app will open at: **http://localhost:3000**

## ✅ Step 5: Verify Setup

```bash
# Make the verification script executable
chmod +x verify-setup.sh

# Run it
./verify-setup.sh
```

## 🎯 What to Test First

1. **Dashboard** (/)
   - Check if stats cards show numbers
   - Verify charts are rendering
   - See the recent leads table

2. **File Ingestion** (/ingestion)
   - Try drag-and-drop CSV upload
   - Test both endpoints (Test & Production)

3. **Dossiers** (/dossiers)
   - View the list of dossiers
   - Click on a dossier to see details
   - Try search and filters

## 🐛 Quick Troubleshooting

**Problem: No data on Dashboard**
- Check your .env file has correct Supabase credentials
- Verify the leads table has data in Supabase

**Problem: File upload fails**
- Verify n8n webhook URL is accessible
- Check browser console for errors

**Problem: Dossiers page empty**
- Make sure some leads have `is_dossier = TRUE` in database
- Check that `dossier_url` column is populated

## 📚 Full Documentation

- **README.md** - Complete setup guide
- **TESTING.md** - Comprehensive testing guide

## 🎨 Customization

Edit these files to customize:
- `src/components/Layout.jsx` - Navigation and branding
- `tailwind.config.js` - Colors and styling
- `src/lib/supabase.js` - Database queries

## 🤝 Need Help?

1. Check the full README.md
2. Review TESTING.md for detailed test cases
3. Check browser console for errors
4. Verify all environment variables are set

---

**That's it!** You should now have a fully functional Excelr8 application running locally. 🎉
