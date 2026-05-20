# Supabase setup

This wires the survey to persist responses to a free Supabase Postgres database, and lets the dashboard read them back.

## 1. Create a Supabase project (free)

1. Go to https://supabase.com and sign up.
2. Click **New project**. Pick any name (e.g. "gig-survey"), generate a database password (save it, you won't need it for this app but Supabase wants it), pick the region closest to your Vercel deploy.
3. Wait ~2 minutes while it provisions.

## 2. Create the `responses` table

In the Supabase project, open **SQL Editor** (left sidebar) and run:

```sql
create table responses (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  q1_project_name text not null,
  q2_quality      text not null,
  q3_creativity   text not null,
  q4_budget       text not null,
  q5_experience   text not null,
  q6_permission   text not null,
  q7_improvement  text not null,
  q8_marketing    text not null,
  q9_referral     text,
  q10_trends      text
);

-- Row-level security: nobody can read or write via the public/anon
-- key. Our serverless functions use the SERVICE_ROLE key which
-- bypasses RLS, so they're the only thing that can touch this table.
alter table responses enable row level security;
```

(Note: `gen_random_uuid()` is built into Supabase's Postgres 13+ by default — no extension needed. If you see "permission denied" on `gen_random_uuid`, your Supabase project is on an older version and you'll need `create extension if not exists "pgcrypto";` run as a *separate* query first.)

## 3. Grab your project credentials

In Supabase, go to **Settings → API**. You need:

| Variable | Where it is on Supabase |
|---|---|
| `SUPABASE_URL`              | "Project URL" |
| `SUPABASE_SERVICE_ROLE_KEY` | "Project API keys" → **service_role** secret (NOT the anon key) |

The service role key is sensitive — it bypasses RLS. Only use it in serverless functions, never in client-side code.

## 4. Generate a dashboard access token

Pick any long random string to gate `/dashboard.html`. From your terminal:

```bash
openssl rand -hex 32
```

Copy the output — this is your `DASHBOARD_TOKEN`.

## 5. Add env vars to Vercel

In your Vercel project: **Settings → Environment Variables**. Add three vars (apply them to Production, Preview, and Development):

```
SUPABASE_URL                = https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY   = eyJhbGc... (from step 3)
DASHBOARD_TOKEN             = (your random string from step 4)
```

Then **redeploy** (Vercel needs a new build to pick up new env vars).

## 6. Test it

- Go to `https://YOUR-SITE.vercel.app/` and complete the survey. Submitting the last question should respond `{"ok": true, "persisted": true, "id": "..."}`.
- In Supabase, **Table Editor → responses** — you should see the row.
- Go to `https://YOUR-SITE.vercel.app/dashboard.html`. It'll prompt for your `DASHBOARD_TOKEN`. Paste it. Hit OK. The token is stored in your browser's localStorage so you'll only be prompted once per browser.

## 7. Who else can read the dashboard?

Anyone you give the token to. Send it via Signal/1Password/whatever — don't paste it in Slack or email. To revoke access, generate a new `DASHBOARD_TOKEN` and redeploy.

If you want proper auth later (e.g. Google sign-in restricted to `@gig.health` emails), Supabase Auth handles that for free — happy to wire it up.

## Local development

Locally (running `python3 -m http.server 8000`), `/api/*` isn't available, so the dashboard auto-falls-back to mock data with a yellow banner. To test the real API locally, install Vercel CLI:

```bash
npm install -g vercel
vercel link        # link this folder to your Vercel project
vercel env pull    # download env vars to .env.local
vercel dev         # runs static server + functions, ~vercel.app emulation
```

Then visit `http://localhost:3000`.
