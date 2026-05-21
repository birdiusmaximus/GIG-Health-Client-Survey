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

## 4. Pick a dashboard username + password

The dashboard sign-in form takes both. Pick a username (e.g. `gig` or your name) and generate a strong password — from your terminal:

```bash
openssl rand -hex 24
```

You can also use any long passphrase from your password manager. Save both somewhere safe.

## 5. Add env vars to Vercel

In your Vercel project: **Settings → Environment Variables**. Add four vars (apply them to Production, Preview, and Development):

```
SUPABASE_URL                = https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY   = eyJhbGc... (from step 3)
DASHBOARD_USERNAME          = (your username from step 4)
DASHBOARD_PASSWORD          = (your generated password from step 4)
```

> **Note**: `DASHBOARD_TOKEN` (used in earlier versions) still works as a fallback for the password. If you already have it set, add `DASHBOARD_USERNAME` and optionally rename `DASHBOARD_TOKEN` → `DASHBOARD_PASSWORD` for clarity.

Then **redeploy** (Vercel needs a new build to pick up new env vars).

## 6. Test it

- Go to `https://YOUR-SITE.vercel.app/` and complete the survey. Submitting the last question should respond `{"ok": true, "persisted": true, "id": "..."}`.
- In Supabase, **Table Editor → responses** — you should see the row.
- Go to `https://YOUR-SITE.vercel.app/dashboard`. The branded sign-in overlay asks for your `DASHBOARD_USERNAME` + `DASHBOARD_PASSWORD`. Credentials are validated against the live API before being stored in your browser's localStorage, so wrong values never get cached.

## 7. Who else can read the dashboard?

Anyone you share the credentials with. Send them via Signal / 1Password / your password manager of choice — don't paste them in Slack or email. To revoke access, rotate `DASHBOARD_PASSWORD` (or `DASHBOARD_TOKEN`) in Vercel and redeploy.

If you want proper auth later (e.g. Google sign-in restricted to `@gig.health` emails), Supabase Auth handles that for free — happy to wire it up.

---

## Optional · Email notifications on each response

When a client submits the survey, send a formatted email to the GIG team (or an inbox shared in Slack). Free via **Resend** — 100 emails/day on the free tier, more than enough for a feedback survey.

### 1. Sign up for Resend

1. Go to https://resend.com and sign in with GitHub or email.
2. **API Keys** → **Create API Key** → name it "GIG Survey", scope "Sending access". Copy the `re_…` key — you only see it once.
3. (Optional but recommended) **Domains** → **Add Domain** → add `gig.health`. Resend shows DNS records to add. Once verified, emails can be sent from `surveys@gig.health` instead of the default `onboarding@resend.dev`. Without this, emails work but come from the Resend domain.

### 2. Add env vars to Vercel

In **Settings → Environment Variables**, add:

```
RESEND_API_KEY  = re_xxxxxxxxxxxx
NOTIFY_EMAIL    = tim@gig.health,aidan@gig.health    # comma-separated for multiple recipients
NOTIFY_FROM     = GIG Surveys <surveys@gig.health>    # OPTIONAL — needs a verified Resend domain
SITE_URL        = https://survey.gig.health           # OPTIONAL — used for the "Open in dashboard" link in the email
```

`RESEND_API_KEY` and `NOTIFY_EMAIL` are the only required ones. If they're not set, submissions still save to Supabase — the email step is silently skipped.

### 3. Redeploy and submit a test

Trigger a redeploy in Vercel, fill out the survey, and the recipient inbox should get a branded email with the answers + a link back to the admin dashboard. Submissions never fail because of email errors — the email send is fire-and-forget after the Supabase write succeeds.

---

## Optional · Custom domain (e.g. survey.gig.health)

Pointing the site at a `gig.health` subdomain takes about five minutes. No code change required.

### 1. Add the domain in Vercel

1. Vercel project → **Settings → Domains**.
2. Type `survey.gig.health` (or whatever subdomain you want) → **Add**.
3. Vercel shows one DNS record you need to add at your registrar:
   - **Type**: `CNAME`
   - **Name**: `survey` (or whatever subdomain)
   - **Value**: `cname.vercel-dns.com`

### 2. Add the DNS record at the GIG registrar

Wherever `gig.health`'s DNS is managed (likely Cloudflare, Namecheap, Squarespace, etc.):

1. Open the DNS settings for `gig.health`.
2. Add a new CNAME record matching what Vercel showed.
3. Save. Propagation usually takes 1–10 minutes.

### 3. Verify

Back in Vercel's Domains page, the domain should flip from "Pending" to a green checkmark. Vercel automatically provisions a free SSL certificate. The site is now available at https://survey.gig.health as well as the old `…vercel.app` URL.

### 4. Update `SITE_URL` env var

If you set `SITE_URL` for email notifications, update it to the new domain:

```
SITE_URL = https://survey.gig.health
```

Then redeploy so the email "Open in dashboard" link uses the new domain.

---

## Local development

Locally (running `python3 -m http.server 8000`), `/api/*` isn't available, so the dashboard auto-falls-back to mock data with a yellow banner. To test the real API locally, install Vercel CLI:

```bash
npm install -g vercel
vercel link        # link this folder to your Vercel project
vercel env pull    # download env vars to .env.local
vercel dev         # runs static server + functions, ~vercel.app emulation
```

Then visit `http://localhost:3000`.
