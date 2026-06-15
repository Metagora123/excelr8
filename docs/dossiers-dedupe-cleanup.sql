-- Cleanup: remove duplicate dossier rows (keep newest per lead_id).
-- Cause: n8n / enrichment pipeline INSERTs a new dossiers row on each run instead of upserting.
--
-- Run in Supabase SQL Editor for the project you want to clean (e.g. prod2k26):
--   1. Run STEP 1 (preview) — confirm rows to delete look correct.
--   2. Run STEP 2 inside a transaction — COMMIT or ROLLBACK after reviewing counts.
--   3. Optionally run STEP 3 to block future duplicates (requires pipeline upsert on conflict).
--
-- Keeps: one row per lead_id — highest id, then latest created_at (tie-breaker: id DESC).

-- =============================================================================
-- STEP 1 — Preview (read-only)
-- =============================================================================

-- Summary before cleanup
SELECT
  COUNT(*) AS total_dossiers,
  COUNT(DISTINCT lead_id) AS unique_leads,
  COUNT(*) - COUNT(DISTINCT lead_id) AS rows_to_delete
FROM public.dossiers
WHERE lead_id IS NOT NULL;

-- Rows that WILL BE DELETED (all but the newest per lead_id)
SELECT
  d.id,
  d.lead_id,
  d.lead_name,
  d.created_at,
  l.full_name,
  l.profile_url
FROM public.dossiers d
LEFT JOIN public.leads l ON l.id = d.lead_id
WHERE d.lead_id IS NOT NULL
  AND d.id NOT IN (
    SELECT DISTINCT ON (lead_id) id
    FROM public.dossiers
    WHERE lead_id IS NOT NULL
    ORDER BY lead_id, created_at DESC NULLS LAST, id DESC
  )
ORDER BY d.lead_name NULLS LAST, d.lead_id, d.created_at;

-- Rows that WILL BE KEPT (newest per lead_id)
SELECT
  d.id,
  d.lead_id,
  d.lead_name,
  d.created_at,
  l.full_name,
  l.profile_url
FROM public.dossiers d
LEFT JOIN public.leads l ON l.id = d.lead_id
WHERE d.lead_id IS NOT NULL
  AND d.id IN (
    SELECT DISTINCT ON (lead_id) id
    FROM public.dossiers
    WHERE lead_id IS NOT NULL
    ORDER BY lead_id, created_at DESC NULLS LAST, id DESC
  )
ORDER BY d.lead_name NULLS LAST, d.lead_id;

-- Optional: spot-check a known duplicate (Lyndon Bendall example)
-- SELECT id, lead_id, lead_name, created_at
-- FROM public.dossiers
-- WHERE lead_name ILIKE '%Lyndon Bendall%'
-- ORDER BY created_at;


-- =============================================================================
-- STEP 2 — Delete duplicates (run in a transaction)
-- =============================================================================

BEGIN;

-- Count before
SELECT COUNT(*) AS dossiers_before FROM public.dossiers;

DELETE FROM public.dossiers d
WHERE d.lead_id IS NOT NULL
  AND d.id NOT IN (
    SELECT DISTINCT ON (lead_id) id
    FROM public.dossiers
    WHERE lead_id IS NOT NULL
    ORDER BY lead_id, created_at DESC NULLS LAST, id DESC
  );

-- Count after (should equal unique lead_id count + any NULL lead_id rows)
SELECT COUNT(*) AS dossiers_after FROM public.dossiers;

-- Verify no lead still has more than one dossier
SELECT lead_id, COUNT(*) AS cnt
FROM public.dossiers
WHERE lead_id IS NOT NULL
GROUP BY lead_id
HAVING COUNT(*) > 1;

-- If the verification query returns 0 rows and counts look good:
COMMIT;
-- If anything looks wrong:
-- ROLLBACK;


-- =============================================================================
-- STEP 3 — Optional: prevent future duplicate inserts (one dossier per lead)
-- =============================================================================
-- Only run this AFTER your n8n pipeline upserts on lead_id (ON CONFLICT DO UPDATE).
-- Otherwise the next dossier run will fail with a unique violation.

-- CREATE UNIQUE INDEX IF NOT EXISTS dossiers_lead_id_unique_idx
--   ON public.dossiers (lead_id)
--   WHERE lead_id IS NOT NULL;
