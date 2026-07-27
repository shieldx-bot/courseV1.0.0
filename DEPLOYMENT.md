# Cloudflare Deployment Guide

This guide covers deploying the Ascendly platform to Cloudflare Workers (API) and Cloudflare Pages (Frontend).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Edge Network                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐     ┌─────────────────────────┐   │
│  │  Cloudflare Pages   │     │   Cloudflare Workers    │   │
│  │  (Frontend - Next.js)│     │   (Backend - Hono)      │   │
│  │  ascendly.io        │────▶│   api.ascendly.io       │   │
│  └─────────────────────┘     └─────────────────────────┘   │
│         │                            │                       │
│         │                            ▼                       │
│         │                   ┌─────────────────────────┐     │
│         │                   │   Cloudflare D1         │     │
│         │                   │   (SQLite Database)     │     │
│         │                   └─────────────────────────┘     │
│         │                            │                       │
│         │                            ▼                       │
│         │                   ┌─────────────────────────┐     │
│         │                   │   Cloudflare KV         │     │
│         │                   │   (Cache/Sessions)      │     │
│         │                   └─────────────────────────┘     │
│         │                            │                       │
│         │                            ▼                       │
│         │                   ┌─────────────────────────┐     │
│         └──────────────────▶│   Cloudflare R2         │     │
│                             │   (Video Storage)       │     │
│                             └─────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Cloudflare Account** with Workers and Pages enabled
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **Node.js 18+** installed
4. **Custom Domain** (optional but recommended): `ascendly.io`

## Step 1: Create Cloudflare Resources

### 1.1 Create D1 Database
```bash
wrangler d1 create ascendly-db
# Note the database_id from output
```

### 1.2 Create KV Namespace
```bash
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview
# Note the namespace IDs from output
```

### 1.3 Create R2 Bucket
```bash
wrangler r2 bucket create ascendly-videos
wrangler r2 bucket create ascendly-videos-preview
```

### 1.4 Create Queue (for background jobs)
```bash
wrangler queues create ascendly-background-jobs
```

## Step 2: Configure Wrangler

Update `apps/api/wrangler.jsonc` with your actual IDs:

```jsonc
{
  "account_id": "YOUR_ACCOUNT_ID",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "ascendly-db",
      "database_id": "YOUR_D1_DATABASE_ID",
      "preview_database_id": "YOUR_PREVIEW_D1_DATABASE_ID"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "YOUR_KV_NAMESPACE_ID",
      "preview_id": "YOUR_PREVIEW_KV_NAMESPACE_ID"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2_BUCKET",
      "bucket_name": "ascendly-videos",
      "preview_bucket_name": "ascendly-videos-preview"
    }
  ]
}
```

## Step 3: Set Secrets

### API Worker Secrets
```bash
cd apps/api
wrangler secret put JWT_SECRET
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put PAYPAL_CLIENT_SECRET
wrangler secret put SMTP_PASSWORD
wrangler secret put OPENAI_API_KEY
wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
wrangler secret put MEILI_MASTER_KEY
wrangler secret put SENTRY_DSN
```

### Pages Environment Variables
Set in Cloudflare Dashboard > Pages > Settings > Environment Variables:

**Build-time variables:**
- `NEXT_PUBLIC_API_BASE_URL` = `https://api.ascendly.io`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_xxx`
- `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` = `xxx.apps.googleusercontent.com`

**Runtime variables (set in Functions):**
- `NEXT_PUBLIC_JWT_SECRET` = (same as worker JWT_SECRET)

## Step 4: Run Database Migrations

```bash
cd apps/api
wrangler d1 execute ascendly-db --file=./schema.sql
wrangler d1 execute ascendly-db --file=./seed.sql
```

## Step 5: Deploy API Worker

```bash
cd apps/api
npm install
npm run deploy
```

This deploys to `https://ascendly-api.YOUR_SUBDOMAIN.workers.dev`

### Configure Custom Domain
1. Go to Cloudflare Dashboard > Workers > ascendly-api > Settings > Triggers
2. Add Custom Domain: `api.ascendly.io`
3. Ensure DNS record points to Cloudflare

## Step 6: Deploy Frontend to Pages

### Option A: Git Integration (Recommended)
1. Push code to GitHub/GitLab
2. Go to Cloudflare Dashboard > Pages > Create a project
3. Connect to your repository
4. Configure build settings:
   - **Build command**: `cd apps/web && npm install && npm run build`
   - **Build output directory**: `apps/web/out`
   - **Root directory**: `/` (repository root)
5. Add environment variables from `.env.example`
6. Deploy!

### Option B: Direct Upload
```bash
cd apps/web
npm install
npm run build
wrangler pages deploy out --project-name=ascendly-web
```

### Configure Custom Domain
1. Go to Cloudflare Dashboard > Pages > ascendly-web > Custom domains
2. Add `ascendly.io` and `www.ascendly.io`
3. DNS records will be created automatically

## Step 7: Configure DNS

In Cloudflare DNS settings for `ascendly.io`:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | @ | ascendly-web.pages.dev | Proxied |
| CNAME | www | ascendly-web.pages.dev | Proxied |
| CNAME | api | ascendly-api.YOUR_SUBDOMAIN.workers.dev | Proxied |

## Step 8: Verify Deployment

### Test API Health
```bash
curl https://api.ascendly.io/api/v1/health
# Should return: {"status":"ok","runtime":"cloudflare-workers"}
```

### Test Frontend
Visit `https://ascendly.io` - should load the homepage

### Test Authentication Flow
1. Go to `https://ascendly.io/login`
2. Sign up for a new account
3. Verify JWT cookies are set (HttpOnly, Secure, SameSite=Lax)
4. Access protected route like `/account`

## Environment Variables Checklist

### Worker (API) - Set as Secrets
- [ ] `JWT_SECRET` (min 32 chars)
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `PAYPAL_CLIENT_SECRET`
- [ ] `SMTP_PASSWORD`
- [ ] `OPENAI_API_KEY`
- [ ] `GOOGLE_OAUTH_CLIENT_SECRET`
- [ ] `MEILI_MASTER_KEY`
- [ ] `SENTRY_DSN`

### Worker (API) - Set as Variables
- [ ] `ENVIRONMENT=production`
- [ ] `FRONTEND_URL=https://ascendly.io`
- [ ] `API_BASE_URL=https://api.ascendly.io`
- [ ] `JWT_ACCESS_EXPIRE_MINUTES=15`
- [ ] `JWT_REFRESH_EXPIRE_DAYS=30`
- [ ] `R2_BUCKET_NAME=ascendly-videos`
- [ ] `R2_SIGNED_URL_EXPIRY_SECONDS=3600`
- [ ] `R2_AUTO_DELETE_DAYS=1`

### Pages (Frontend) - Build-time
- [ ] `NEXT_PUBLIC_API_BASE_URL=https://api.ascendly.io`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`
- [ ] `NEXT_PUBLIC_GA_ID` (optional)

## Troubleshooting

### Worker Deployment Fails
```bash
# Check logs
wrangler tail ascendly-api

# Common issues:
# 1. Missing bindings - verify wrangler.jsonc IDs
# 2. TypeScript errors - run `npx tsc --noEmit` in apps/api
# 3. Bundle size > 1MB - check for large dependencies
```

### Pages Build Fails
```bash
# Test build locally
cd apps/web
npm run build

# Common issues:
# 1. Missing environment variables
# 2. TypeScript errors - run `npx tsc --noEmit`
# 3. Image optimization - ensure `unoptimized: true` in next.config.mjs
```

### CORS Issues
- Verify `FRONTEND_URL` in worker matches your Pages domain
- Check CORS headers in worker response
- Ensure `credentials: true` in fetch requests

### Database Issues
```bash
# Check D1 connection
wrangler d1 execute ascendly-db --command="SELECT 1"

# View tables
wrangler d1 execute ascendly-db --command=".tables"
```

### Authentication Not Working
1. Verify `JWT_SECRET` matches between worker and frontend
2. Check cookie settings: `Secure`, `HttpOnly`, `SameSite=Lax`
3. Ensure API domain and frontend domain share same root domain
4. Check middleware.ts cookie parsing logic

## Monitoring & Observability

### Worker Logs
```bash
# Real-time logs
wrangler tail ascendly-api --format=json

# Filter by level
wrangler tail ascendly-api --filter="level:error"
```

### Pages Logs
- Cloudflare Dashboard > Pages > ascendly-web > Functions > Logs

### Analytics
- Workers Analytics: Dashboard > Workers > ascendly-api > Metrics
- Pages Analytics: Dashboard > Pages > ascendly-web > Analytics

## Rollback Procedure

### Worker Rollback
```bash
# List deployments
wrangler deployments list ascendly-api

# Rollback to specific version
wrangler rollback ascendly-api <deployment-id>
```

### Pages Rollback
- Dashboard > Pages > ascendly-web > Deployments > Click "Rollback" on previous deployment

## Cost Optimization

1. **Workers**: Free tier includes 100k requests/day
2. **Pages**: Free tier includes 500 builds/month, unlimited requests
3. **D1**: Free tier includes 5GB storage, 5M reads/day
4. **KV**: Free tier includes 1GB storage, 100k reads/day
5. **R2**: Free tier includes 10GB storage, 1M Class A operations

## Security Checklist

- [ ] All secrets stored in Cloudflare (not in code)
- [ ] CORS configured for specific domains only
- [ ] Security headers set in `_headers` and worker
- [ ] JWT cookies: HttpOnly, Secure, SameSite=Lax
- [ ] Rate limiting enabled (Durable Object)
- [ ] WAF rules configured in Cloudflare Dashboard
- [ ] Bot Fight Mode enabled
- [ ] SSL/TLS set to "Full (Strict)"

## Support Commands

```bash
# View worker info
wrangler whoami

# List all resources
wrangler d1 list
wrangler kv:namespace list
wrangler r2 bucket list
wrangler queues list

# Delete resources (careful!)
wrangler d1 delete ascendly-db
wrangler kv:namespace delete <namespace-id>
wrangler r2 bucket delete ascendly-videos