# Vercel Serverless Functions for R2 API

This folder contains Vercel serverless functions that handle R2 API calls.

## How It Works

**No separate server needed!** Vercel automatically:
1. Detects files in the `api/` folder
2. Converts them to serverless functions
3. Serves them at `/api/*` routes

## Files

- `r2/date-folders.js` - Lists all date folders in R2 bucket
- `r2/files.js` - Lists files in a specific date folder
- `r2/file-content.js` - Gets content of a specific file

## Environment Variables Required

Make sure these are set in your Vercel project settings:
- `VITE_CLOUDFLARE_R2_ACCOUNT_ID`
- `VITE_CLOUDFLARE_R2_ACCESS_KEY_ID`
- `VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `VITE_CLOUDFLARE_R2_BUCKET_NAME`
- `VITE_CLOUDFLARE_R2_ENDPOINT`

## How It's Different

**Before:** Needed to run `server.js` separately
**Now:** Vercel handles everything automatically - just deploy!

## Testing Locally

Vercel CLI will automatically detect and serve these functions:
```bash
vercel dev
```

Or use the Vite dev server (which uses `vite-r2-plugin.js` for development).

