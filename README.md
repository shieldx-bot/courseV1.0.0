# Ascendly — Premium Learning Membership Platform

Full-stack subscription learning platform built with Next.js, FastAPI, MongoDB, and Redis.

## Quick start

```bash
# Start supporting services
docker compose up -d

# Install backend
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Install frontend (new terminal)
cd apps/web
npm install
npm run dev
```

## Project structure

- `apps/web` — Next.js 15 + TypeScript + Tailwind CSS frontend
- `apps/api` — FastAPI Python backend
- `docker/` — local development Docker Compose
- `k8s/` — Kubernetes manifests

## Public pages

Homepage, course catalog, course detail, pricing, FAQ, about, reviews, blog, contact, privacy, terms.

## Authenticated pages

Learning dashboard, course player, account + billing, checkout.

## Admin pages

Dashboard, course management, user management, orders, coupons, AI analytics & forecasting.

## Environment

Copy `.env.example` to `.env` and fill in your secrets. Never commit `.env`.
