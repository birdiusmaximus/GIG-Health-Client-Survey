// /api/responses
//   GET                      → all responses (newest first)
//   PATCH ?id=<uuid>         → update a response (whitelisted fields only)
//   DELETE ?id=<uuid>        → delete a response
//
// Auth on every method: bearer token matching env var DASHBOARD_TOKEN.
//   Authorization: Bearer <token>
//   …or query string fallback for easy browser testing:
//   /api/responses?token=<token>

import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req, res) {
  // ── Auth (Basic username + password, with legacy Bearer fallback) ──
  // Env vars:
  //   DASHBOARD_USERNAME — required for username check (if unset, any user is accepted)
  //   DASHBOARD_PASSWORD — required password
  //   DASHBOARD_TOKEN    — legacy alias for DASHBOARD_PASSWORD
  const expectedUser = process.env.DASHBOARD_USERNAME;
  const expectedPass = process.env.DASHBOARD_PASSWORD || process.env.DASHBOARD_TOKEN;
  if (!expectedPass) {
    return res.status(500).json({ error: 'DASHBOARD_PASSWORD (or DASHBOARD_TOKEN) env var not set on server' });
  }

  const authHeader = req.headers.authorization || '';
  let providedUser = '';
  let providedPass = '';

  if (authHeader.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      providedUser = idx !== -1 ? decoded.slice(0, idx) : '';
      providedPass = idx !== -1 ? decoded.slice(idx + 1) : decoded;
    } catch { /* malformed base64 → empty creds → 401 below */ }
  } else if (authHeader.startsWith('Bearer ')) {
    // Legacy: bare bearer token, treat as the password (any username accepted)
    providedPass = authHeader.slice(7);
  } else if (req.query?.token) {
    // Convenience for browser testing — token as ?token=…
    providedPass = req.query.token;
  }

  const userOk = !expectedUser || providedUser === expectedUser;
  const passOk = providedPass === expectedPass;
  if (!userOk || !passOk) {
    return res.status(401).json({ error: 'invalid username or password' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured on server' });
  }

  // ── GET: list all ────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (error) {
      console.error('[responses GET] supabase error', error);
      return res.status(500).json({ error: error.message });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  }

  // ── PATCH: update a single response (whitelisted fields) ─────
  if (req.method === 'PATCH') {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'id query param required' });

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
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data);
  }

  // ── DELETE: remove a single response ─────────────────────────
  if (req.method === 'DELETE') {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'id query param required' });

    const { error } = await supabase
      .from('responses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[responses DELETE] supabase error', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ ok: true, id });
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
