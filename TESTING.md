# 🧪 Testing Guide for Excelr8 Application

This guide will walk you through testing each feature of the Excelr8 application.

## Prerequisites for Testing

Before you start testing, ensure:
1. ✅ All dependencies installed (`npm install`)
2. ✅ `.env` file configured with valid credentials
3. ✅ Supabase database set up with the `leads` table
4. ✅ Test data inserted into Supabase
5. ✅ Development server running (`npm run dev`)

## Test Checklist

### 1. Initial Setup ✓

```bash
# 1. Navigate to project directory
cd excelr8-app

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Edit .env with your credentials
# (Use your text editor)

# 5. Make verification script executable
chmod +x verify-setup.sh

# 6. Run verification
./verify-setup.sh

# 7. Start development server
npm run dev
```

Expected: Browser opens at `http://localhost:3000`

---

### 2. Dashboard Page Testing

#### Test 2.1: Page Load
- [ ] Navigate to `http://localhost:3000`
- [ ] Dashboard loads without errors
- [ ] All stat cards display numbers
- [ ] Charts render properly

#### Test 2.2: Stats Cards
Verify the following cards display:
- [ ] Total Leads (number)
- [ ] With Dossiers (number and percentage)
- [ ] Average Score (decimal number)
- [ ] Data Sources (shows "2")

#### Test 2.3: Charts
- [ ] **Pie Chart** (Leads by Status):
  - [ ] Shows different status segments
  - [ ] Displays percentages
  - [ ] Hover shows tooltip
  
- [ ] **Bar Chart** (Leads by Tier):
  - [ ] Shows tier distribution
  - [ ] Bars have proper labels
  - [ ] Hover shows values

- [ ] **Line Chart** (Lead Growth Timeline):
  - [ ] Two lines display (leads and score)
  - [ ] X-axis shows days
  - [ ] Y-axis shows values
  - [ ] Legend is visible

#### Test 2.4: Recent Leads Table
- [ ] Table shows last 10 leads
- [ ] Profile pictures display (or initials)
- [ ] All columns visible: Name, Company, Status, Tier, Score, Dossier
- [ ] Status and Tier badges have colors
- [ ] Dossier column shows ✓ or -

#### Test 2.5: Refresh Button
- [ ] Click refresh button
- [ ] Button shows loading spinner
- [ ] Data reloads successfully
- [ ] No errors in console

**Expected Result**: Dashboard displays all analytics correctly with live data from Supabase.

---

### 3. File Ingestion Page Testing

Navigate to: `http://localhost:3000/ingestion`

#### Test 3.1: Page Load
- [ ] Page loads without errors
- [ ] Title shows "CSV File Ingestion"
- [ ] Endpoint selector shows two buttons
- [ ] Upload area is visible

#### Test 3.2: Endpoint Selection
- [ ] Click "Test Webhook" button
  - [ ] Button highlights with gradient
  - [ ] Endpoint URL updates at bottom
- [ ] Click "Production" button
  - [ ] Button highlights with gradient
  - [ ] Endpoint URL updates at bottom

#### Test 3.3: File Upload - Drag & Drop
- [ ] Drag a CSV file over the upload area
  - [ ] Border color changes to blue
  - [ ] Background changes to blue tint
- [ ] Drop the CSV file
  - [ ] File name appears
  - [ ] File size shows in KB
  - [ ] Remove button (X) appears

#### Test 3.4: File Upload - Browse
- [ ] Click "or click to browse"
- [ ] File picker opens
- [ ] Select a CSV file
  - [ ] File name appears
  - [ ] File size displays

#### Test 3.5: File Type Validation
- [ ] Try to upload a non-CSV file (e.g., .txt, .jpg)
  - [ ] Error message appears: "Please upload a CSV file"
  - [ ] Error has red styling

#### Test 3.6: Remove File
- [ ] Upload a file
- [ ] Click the X (remove) button
  - [ ] File is removed
  - [ ] Upload area returns to initial state

#### Test 3.7: Upload Process
**With Test Endpoint:**
- [ ] Select Test Webhook
- [ ] Upload a valid CSV file
- [ ] Click "Upload to Test" button
  - [ ] Button shows "Uploading..." with spinner
  - [ ] Button is disabled during upload
- [ ] Wait for response
  - [ ] Success: Green message appears
  - [ ] File auto-clears after 3 seconds
  - OR
  - [ ] Error: Red message appears with details

**With Production Endpoint:**
- [ ] Repeat above steps with Production selected
- [ ] Verify endpoint in URL at bottom changes

#### Test 3.8: Upload Button States
- [ ] No file selected: Button is grey and disabled
- [ ] File selected: Button is blue gradient and enabled
- [ ] During upload: Button shows spinner and is disabled

**Expected Result**: CSV files upload successfully to the correct n8n webhook endpoint.

---

### 4. Dossiers Page Testing

Navigate to: `http://localhost:3000/dossiers`

#### Test 4.1: Page Load
- [ ] Page loads without errors
- [ ] Title shows "Dossiers"
- [ ] Lead count displays
- [ ] Search and filter boxes visible
- [ ] Dossier cards display

#### Test 4.2: Dossier Cards Display
For each dossier card, verify:
- [ ] Profile picture or initial circle shows
- [ ] Full name is bold and prominent
- [ ] Title/position displays
- [ ] Company name shows with building icon
- [ ] Location shows with map pin icon
- [ ] Email shows with mail icon (if available)
- [ ] Phone shows with phone icon (if available)
- [ ] Tier badge displays with purple styling
- [ ] Status badge displays with blue styling
- [ ] Created date shows
- [ ] About summary displays (truncated)
- [ ] "Download" and "View" buttons are visible

#### Test 4.3: Search Functionality
- [ ] Type in search box: "John"
  - [ ] Only matching leads display
- [ ] Type company name
  - [ ] Filters correctly
- [ ] Type email address
  - [ ] Filters correctly
- [ ] Clear search
  - [ ] All dossiers return

#### Test 4.4: Tier Filter
- [ ] Select "All Tiers"
  - [ ] Shows all dossiers
- [ ] Select "Gold"
  - [ ] Shows only Gold tier leads
- [ ] Select "Silver"
  - [ ] Shows only Silver tier leads
- [ ] Select "Bronze"
  - [ ] Shows only Bronze tier leads

#### Test 4.5: Status Filter
- [ ] Select "All Statuses"
  - [ ] Shows all dossiers
- [ ] Select "New"
  - [ ] Shows only new status leads
- [ ] Select "Contacted"
  - [ ] Shows only contacted leads
- [ ] Try other status options

#### Test 4.6: Combined Filters
- [ ] Set search term + tier filter
  - [ ] Both filters apply
- [ ] Set search + tier + status
  - [ ] All three filters apply
- [ ] Verify count updates correctly

#### Test 4.7: Dossier Card Actions
- [ ] Click "Download" button
  - [ ] Opens dossier URL in new tab
  - [ ] Doesn't open modal
- [ ] Click "View" button
  - [ ] Opens dossier URL in new tab
  - [ ] Doesn't open modal

#### Test 4.8: Dossier Modal
- [ ] Click anywhere on a dossier card (not on buttons)
  - [ ] Modal opens with full details
- [ ] Verify modal shows:
  - [ ] Large profile picture/initial
  - [ ] Full name and title
  - [ ] Contact information section
  - [ ] Status, tier, and score badges
  - [ ] About section (full text)
  - [ ] Personality section (if available)
  - [ ] Expertise section (if available)
  - [ ] Tech stack tags (if available)
  - [ ] Company overview (if available)
  - [ ] Social reach stats (followers/connections)
  - [ ] Download and View Profile buttons

#### Test 4.9: Modal Actions
- [ ] Click X button to close
  - [ ] Modal closes
- [ ] Click outside modal (dark area)
  - [ ] Modal closes
- [ ] Click "Download Dossier" in modal
  - [ ] Opens in new tab
- [ ] Click "View Profile" in modal
  - [ ] Opens in new tab

#### Test 4.10: Refresh Button
- [ ] Click refresh button
- [ ] Spinner animates
- [ ] Data reloads
- [ ] Filters reset or maintain state

#### Test 4.11: Empty State
- [ ] Set filters that return no results
  - [ ] Shows "No dossiers found" message
  - [ ] Shows icon and helpful text

**Expected Result**: All dossiers display correctly with full details, search and filtering work properly.

---

### 5. Navigation Testing

#### Test 5.1: Desktop Navigation
- [ ] Click "Dashboard" in navbar
  - [ ] Navigates to dashboard
  - [ ] Link highlights
- [ ] Click "File Ingestion" in navbar
  - [ ] Navigates to ingestion page
  - [ ] Link highlights
- [ ] Click "Dossiers" in navbar
  - [ ] Navigates to dossiers page
  - [ ] Link highlights

#### Test 5.2: Mobile Navigation
- [ ] Resize browser to mobile width (< 768px)
- [ ] Verify hamburger menu appears
- [ ] Click hamburger menu
  - [ ] Menu slides open
  - [ ] Shows all nav links
- [ ] Click a nav link
  - [ ] Navigates to page
  - [ ] Menu closes automatically
- [ ] Click X to close menu
  - [ ] Menu closes

#### Test 5.3: Logo
- [ ] Click Excelr8 logo
  - [ ] Returns to dashboard

#### Test 5.4: Active Page Highlighting
- [ ] Navigate to each page
- [ ] Verify active page link has gradient background
- [ ] Verify inactive links are grey

**Expected Result**: Navigation works smoothly on all screen sizes.

---

### 6. Responsive Design Testing

Test on different screen sizes:

#### Test 6.1: Desktop (1920x1080)
- [ ] Dashboard: All cards in 4 columns
- [ ] Charts: Side by side
- [ ] Navigation: Full horizontal menu
- [ ] Dossiers: Cards full width

#### Test 6.2: Tablet (768x1024)
- [ ] Dashboard: Cards in 2 columns
- [ ] Charts: Stacked vertically
- [ ] Navigation: Full menu still visible
- [ ] Dossiers: Cards full width

#### Test 6.3: Mobile (375x667)
- [ ] Dashboard: Cards in 1 column
- [ ] Charts: Full width, stacked
- [ ] Navigation: Hamburger menu
- [ ] Dossiers: Cards full width
- [ ] All text readable
- [ ] Buttons properly sized

**Expected Result**: App is fully responsive and usable on all screen sizes.

---

### 7. Performance Testing

#### Test 7.1: Load Times
- [ ] Dashboard loads in < 2 seconds
- [ ] File Ingestion loads instantly
- [ ] Dossiers page loads in < 3 seconds
- [ ] Modal opens instantly

#### Test 7.2: Large Data Sets
- [ ] Test with 100+ leads
  - [ ] Dashboard charts render smoothly
  - [ ] Dossiers page scrolls smoothly
  - [ ] Search/filter is responsive

#### Test 7.3: Network Throttling
- [ ] Open DevTools Network tab
- [ ] Set to "Slow 3G"
- [ ] Test page loads
  - [ ] Loading spinners show
  - [ ] No crashes or errors

**Expected Result**: App performs well even with poor network conditions.

---

### 8. Error Handling Testing

#### Test 8.1: Invalid Supabase Credentials
- [ ] Set wrong Supabase URL in .env
- [ ] Reload app
- [ ] Verify graceful error handling
- [ ] Check console for error logs

#### Test 8.2: Network Errors
- [ ] Disconnect internet
- [ ] Try to refresh dashboard
- [ ] Verify error message shows
- [ ] Try file upload
- [ ] Verify error handling

#### Test 8.3: Invalid File Upload
- [ ] Try uploading 100MB file
- [ ] Try uploading corrupted CSV
- [ ] Verify proper error messages

**Expected Result**: App handles errors gracefully without crashing.

---

### 9. Browser Compatibility Testing

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

Verify:
- [ ] All features work
- [ ] Styling is consistent
- [ ] No console errors

---

### 10. Console Checks

For each page, open DevTools Console and verify:
- [ ] No red errors
- [ ] No warning messages
- [ ] Network requests succeed (Status 200)

---

## Test Data Verification

### Supabase Test Query

Run in Supabase SQL Editor:

```sql
-- Verify leads exist
SELECT COUNT(*) FROM leads;

-- Verify dossiers exist
SELECT COUNT(*) FROM leads WHERE is_dossier = TRUE;

-- Check data quality
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN is_dossier THEN 1 END) as with_dossiers,
  AVG(score) as avg_score
FROM leads;
```

Expected: At least 3 leads, at least 2 with dossiers

---

## Troubleshooting Common Test Failures

### Dashboard shows no data
1. Check Supabase credentials in .env
2. Verify leads table has data
3. Check RLS policies allow read
4. Check browser console for errors

### File upload fails
1. Verify n8n webhook URL is correct
2. Test webhook with curl:
   ```bash
   curl -X POST https://excelr8.app.n8n.cloud/webhook-test/clay \
     -F "data=@test.csv"
   ```
3. Check CORS settings on n8n

### Dossiers don't load
1. Verify `is_dossier = TRUE` for some leads
2. Check that `dossier_url` is populated
3. Verify Supabase connection

### Styling looks broken
1. Check that Tailwind CSS is loading
2. Verify PostCSS is configured
3. Clear cache and rebuild:
   ```bash
   rm -rf node_modules/.vite
   npm run dev
   ```

---

## Sign-off Checklist

After completing all tests above:

- [ ] All core features working
- [ ] No console errors
- [ ] Responsive on all devices
- [ ] Data loads from Supabase correctly
- [ ] File upload works
- [ ] Dossiers display properly
- [ ] Navigation functions correctly
- [ ] Performance is acceptable

**Testing Complete!** 🎉

---

## Automated Testing (Optional)

For automated testing, you could add:

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest
```

But for now, manual testing with this guide is sufficient.

---

**Last Updated**: 2024
**Tested By**: _____________
**Date**: _____________
