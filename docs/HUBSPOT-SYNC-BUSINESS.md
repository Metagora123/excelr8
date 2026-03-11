# Supabase → HubSpot Sync — Business Guide

Plain-language guide: what data goes where in HubSpot and what you’ll see. For anyone using the HubSpot export (no technical background required).

---

## What This Does

The **HubSpot Export** feature copies your Excelr8 data into HubSpot so you can:

- See your leads as **contacts**
- See your campaigns as **deals**
- See which lead is in which campaign (contact linked to deal)
- See dossier links and LinkedIn post activity as **notes** on each contact

**Important:** Excelr8 (Supabase) stays the source of truth. HubSpot is a snapshot for viewing and reporting. When you run sync again, existing contacts and deals are updated; we don’t create duplicates.

---

## What Shows Up Where in HubSpot

### 1. Leads → Contacts

Every **lead** in Excelr8 becomes (or updates) a **Contact** in HubSpot.

| What you have in Excelr8 | What you see in HubSpot |
|---------------------------|--------------------------|
| Lead name | Contact first & last name |
| Email | Contact email |
| Company | Company name |
| Job title | Job title |
| Phone | Phone number |
| Location | Address |
| Lead status (e.g. new, qualified) | Lead status |
| LinkedIn profile link | LinkedIn URL |
| Short bio / about | LinkedIn bio |

So in HubSpot **Contacts** you get the same people you manage in Excelr8, with the same core info.

---

### 2. Campaigns → Deals

Every **campaign** in Excelr8 becomes (or updates) a **Deal** in HubSpot.

| What you have in Excelr8 | What you see in HubSpot |
|---------------------------|--------------------------|
| Campaign name | Deal name |
| Campaign description | Deal description |

So in HubSpot **Deals** you see your outreach campaigns. You can use HubSpot’s pipeline and reporting on these deals to see how many campaigns you have and how they’re doing.

---

### 3. “This lead is in this campaign” → Contact linked to Deal

When a lead is **in** a campaign in Excelr8 (recorded in our system), that same contact in HubSpot is **linked** to the matching deal.

So in HubSpot you can:

- Open a **Contact** and see which **Deals** (campaigns) they’re in.
- Open a **Deal** (campaign) and see which **Contacts** (leads) are in it.

No extra tables—just the standard contact–deal link in HubSpot.

---

### 4. Dossiers → Notes on the contact

If a lead has a **dossier** in Excelr8 (and we have a dossier link for them), we add a **Note** on their HubSpot contact.

- **What you see:** A note whose text is: **Dossier:** followed by the link.
- **Where:** On the contact record, in the activity/notes area.

So you can click from HubSpot straight to the dossier if you need it.

---

### 5. LinkedIn posts → Notes on the contact

If we have **LinkedIn posts** for a lead in Excelr8, we add a **Note** on their HubSpot contact.

- **What you see:** A note like **LinkedIn: 5 post(s). Latest:** and a link to the most recent post (if we have it).
- **Where:** On the contact record, with the other notes.

So you can see at a glance that this person has LinkedIn activity and jump to the latest post.

---

## Summary Table (at a glance)

| In Excelr8 | In HubSpot |
|------------|------------|
| Lead | Contact (name, email, company, title, etc.) |
| Campaign | Deal (name, description) |
| “Lead X is in Campaign Y” | Contact X linked to Deal Y |
| Dossier link for a lead | Note on that contact: “Dossier: [link]” |
| LinkedIn posts for a lead | Note on that contact: “LinkedIn: N post(s). Latest: [link]” |

---

## When to Sync

- **On demand:** Use the **Sync to HubSpot** button on the HubSpot Export page whenever you want HubSpot updated.
- **Frequency:** There’s no automatic schedule. Run it after big imports or when you need HubSpot to match Excelr8 (e.g. before a report or meeting).

---

## One Portal for Now

Right now we use **one HubSpot portal** and one token. All synced data goes to that portal. Support for multiple portals (e.g. one per client like Excelr8 vs Metagora) can be added later; the mapping above will stay the same, just filtered by client.

---

## If Something’s Missing in HubSpot

- **Contact not there or not updated:** Make sure that lead exists in Excelr8 and has at least an email (or we’ll use a placeholder). Then run sync again.
- **Deal not there or wrong name:** Campaign name in Excelr8 becomes the deal name in HubSpot. Change the campaign name in Excelr8 and sync again if you want a different deal name.
- **Note (dossier or LinkedIn) not there:** We only add those notes when the lead has a dossier link or at least one LinkedIn post in Excelr8. Add that data in Excelr8 and sync again.

For technical details (fields, APIs, code locations), see **HUBSPOT-SYNC-DEV.md**.
