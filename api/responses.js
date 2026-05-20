// GET /api/responses — returns all survey responses (most recent first).
//
// Auth: requires a bearer token matching env var DASHBOARD_TOKEN.
//   Authorization: Bearer <token>
//   …or query string fallback for easy browser testing:
//   /api/responses?token=<token>
//
// Requires env vars (see SUPABASE_SETUP.md):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   DASHBOARD_TOKEN              — any random string; gates dashboard access

import { createClient } from '@supabase/supabase-js';

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )
  : null;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  // Token check
  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected) {
    return res.status(500).json({ error: 'DASHBOARD_TOKEN env var not set on server' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ')
    ? auth.slice(7)
    : (req.query?.token || '');
  if (!token || token !== expected) {
    return res.status(401).json({ error: 'invalid or missing token' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured on server' });
  }

  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('[responses] supabase select error', error);
    return res.status(500).json({ error: error.message });
  }

  // Cache-control: no-store so the dashboard always sees fresh data
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(data);
}
