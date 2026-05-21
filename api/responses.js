// /api/responses
//   GET                      → all responses (newest first)
//   PATCH ?id=<uuid>         → update a response (whitelisted fields only)
//   DELETE ?id=<uuid>        → delete a response
//
// Auth on every method: HTTP Basic with env vars DASHBOARD_USERNAME +
// DASHBOARD_PASSWORD. Comparison is constant-time to avoid leaking
// credential length / prefix via response timing.

import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

// Strip trailing slashes / whitespace defensively
const cleanUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const cleanKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabase = (cleanUrl && cleanKey)
  ? createClient(cleanUrl, cleanKey, { auth: { persistSession: false } })
  : null;

// Allowed enum values per radio question — guards PATCH from writing
// arbitrary values into the columns we treat as enums client-side
const ALLOWED = {
  q2_quality:    ['excellent', 'high', 'fair', 'not_everything', 'disappointing'],
  q3_creativity: ['groundbreaking', 'really_creative', 'quite_creative', 'average', 'lacking'],
  q4_budget:     ['higher', 'on_par', 'cheaper', 'na'],
  q6_permission: ['yes', 'no'],
  q8_marketing:  ['yes_as_is', 'yes_adapted', 'possibly', 'no'],
};
const TEXT_FIELDS = [
  'q1_project_name', 'q5_experience', 'q7_improvement',
  'q9_referral', 'q10_trends',
];
const NULLABLE_TEXT_FIELDS = new Set(['q9_referral', 'q10_trends']);

// UUID v1-v5 shape — we use this to reject garbage `id` values fast
// rather than letting them hit Supabase and bounce back as PG errors.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Length-checked, constant-time string comparison. Returns true iff
// both inputs are non-empty, equal length, and equal content.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 || b.length === 0) return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

function unauthorised(res, message) {
  res.setHeader('WWW-Authenticate', 'Basic realm="GIG admin", charset="UTF-8"');
  return res.status(401).json({ error: message || 'unauthorised' });
}

// CORS — admins do local-dev work against the live API by entering
// their dashboard credentials. We allow our deployed origin plus any
// localhost / 127.0.0.1 (any port) so `python -m http.server` and Vite
// alike just work. Other origins get no CORS header → browser blocks.
const ALLOWED_ORIGINS = new Set([
  'https://gig-health-client-survey.vercel.app',
]);
function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
  } catch {}
  return false;
}
function applyCors(req, res) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}

export default async function handler(req, res) {
  applyCors(req, res);
  // Pre-flight: respond before doing auth so the browser can check
  // CORS without sending credentials yet.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // ── Auth (HTTP Basic, constant-time comparison) ──────────────
  // Required env vars (no defaults, no fail-open):
  //   DASHBOARD_USERNAME — required
  //   DASHBOARD_PASSWORD — required (DASHBOARD_TOKEN accepted as alias)
  const expectedUser = process.env.DASHBOARD_USERNAME;
  const expectedPass = process.env.DASHBOARD_PASSWORD || process.env.DASHBOARD_TOKEN;
  if (!expectedUser || !expectedPass) {
    console.error('[responses] DASHBOARD_USERNAME and/or DASHBOARD_PASSWORD env vars not set');
    return res.status(500).json({ error: 'server not configured' });
  }

  const authHeader = req.headers.authorization || '';
  let providedUser = '';
  let providedPass = '';

  if (authHeader.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      providedUser = idx !== -1 ? decoded.slice(0, idx) : '';
      providedPass = idx !== -1 ? decoded.slice(idx + 1) : '';
    } catch { /* malformed base64 → empty creds → 401 below */ }
  }
  // NB: legacy Bearer / ?token= fallbacks were removed — Basic only

  // Run both comparisons unconditionally so timing is constant regardless
  // of which (if either) credential is wrong.
  const userOk = safeEqual(providedUser, expectedUser);
  const passOk = safeEqual(providedPass, expectedPass);
  if (!(userOk && passOk)) return unauthorised(res, 'invalid username or password');

  if (!supabase) {
    return res.status(500).json({ error: 'server not configured' });
  }

  // ── GET: list all ────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (error) {
      console.error('[responses GET] supabase error', error);
      return res.status(500).json({ error: 'failed to load responses' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  }

  // ── PATCH: update a single response (whitelisted fields) ─────
  if (req.method === 'PATCH') {
    const id = req.query?.id;
    if (!id || !UUID_RE.test(String(id))) {
      return res.status(400).json({ error: 'invalid id' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : null;
    if (!body) return res.status(400).json({ error: 'invalid body' });

    const updates = {};

    // Radio / enum fields — must be in the allowed list
    for (const [field, allowed] of Object.entries(ALLOWED)) {
      if (field in body) {
        if (!allowed.includes(body[field])) {
          return res.status(400).json({ error: `invalid value for ${field}` });
        }
        updates[field] = body[field];
      }
    }
    // Text fields — trim, length-cap, nullify empties for nullable ones
    for (const field of TEXT_FIELDS) {
      if (field in body) {
        const value = typeof body[field] === 'string' ? body[field].trim().slice(0, 5000) : '';
        if (!value) {
          if (NULLABLE_TEXT_FIELDS.has(field)) {
            updates[field] = null;
          } else {
            return res.status(400).json({ error: `${field} cannot be empty` });
          }
        } else {
          updates[field] = value;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'no valid fields to update' });
    }

    const { data, error } = await supabase
      .from('responses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[responses PATCH] supabase error', error);
      return res.status(500).json({ error: 'failed to update response' });
    }
    return res.status(200).json(data);
  }

  // ── DELETE: remove a single response ─────────────────────────
  if (req.method === 'DELETE') {
    const id = req.query?.id;
    if (!id || !UUID_RE.test(String(id))) {
      return res.status(400).json({ error: 'invalid id' });
    }

    const { error } = await supabase
      .from('responses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[responses DELETE] supabase error', error);
      return res.status(500).json({ error: 'failed to delete response' });
    }
    return res.status(200).json({ ok: true, id });
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
