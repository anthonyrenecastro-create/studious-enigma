# Vercel Deployment (Preview + Production)

This project deploys as:
- Frontend on Vercel (Vite static output)
- Backend on a separate host (for example Render/Fly/Railway/VM)

## Vercel Project Settings

Use these values in Vercel Project -> Settings -> Build and Output:

- Framework Preset: Vite
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

`vercel.json` in this repo already aligns with these values and includes SPA fallback routing.

## Environment Variables

Set these in Vercel Project -> Settings -> Environment Variables.

### Preview (copy/paste)

Name: `VITE_ATLANTEAN_API_BASE`
Value: `https://preview-api.example.com/api/atlantean`
Environment: `Preview`

Name: `VITE_ATLANTEAN_HEALTH_URL`
Value: `https://preview-api.example.com/health`
Environment: `Preview`

### Production (copy/paste)

Name: `VITE_ATLANTEAN_API_BASE`
Value: `https://api.example.com/api/atlantean`
Environment: `Production`

Name: `VITE_ATLANTEAN_HEALTH_URL`
Value: `https://api.example.com/health`
Environment: `Production`

## Optional: Vercel CLI commands

```bash
# Preview env vars
vercel env add VITE_ATLANTEAN_API_BASE preview
vercel env add VITE_ATLANTEAN_HEALTH_URL preview

# Production env vars
vercel env add VITE_ATLANTEAN_API_BASE production
vercel env add VITE_ATLANTEAN_HEALTH_URL production
```

Then redeploy so Vite build-time env vars are applied.

## Backend CORS allowlist

Your backend must allow Vercel origins via `ALLOWED_ORIGINS`.

Example:

```bash
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-app-git-main-your-team.vercel.app
```

Notes:
- Add your stable Production domain (`*.vercel.app` or custom domain).
- For Preview, prefer a stable branch URL if available.
- If preview URLs are fully ephemeral in your setup, you will need to keep `ALLOWED_ORIGINS` updated.

## Aurora table setup for AWS persistence

If you enable `AWS_DB_MODE=aurora` or `AWS_DB_MODE=both`, create the Aurora tables before startup:

```sql
-- Run the SQL in db/aurora_tables.sql
```

The default table names in that file match `.env.example`:
- `atlantean_events`
- `atlantean_snapshots`
- `atlantean_checkpoints`

If you override `AWS_AURORA_*_TABLE` env vars, use matching table names in Aurora.
