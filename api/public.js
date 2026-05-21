// GET /api/public — sanitized aggregate stats for the public showcase page.
// No auth required. Returns ONLY aggregates and (in a future step) curated
// anonymous quotes. Never returns project names or individual response IDs.

import { createClient } from '@supabase/supabase-js';

const cleanUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const cleanKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabase = (cleanUrl && cleanKey)
  ? createClient(cleanUrl, cleanKey, { auth: { persistSession: false } })
  : null;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured on server' });
  }

  // Pull only the columns we need for the public page — never select
  // q1_project_name or q9_referral (contains client names + emails)
  const { data, error } = await supabase
    .from('responses')
    .select('q2_quality, q3_creativity, q4_budget, q6_permission, q7_improvement, q5_experience');

  if (error) {
    console.error('[public] supabase error', error);
    return res.status(500).json({ error: error.message });
  }

  const rows = data || [];
  const total = rows.length;
  const pct = (n) => total ? Math.round((n / total) * 100) : 0;

  const highQual = rows.filter(r => r.q2_quality === 'excellent' || r.q2_quality === 'high').length;
  const highCrea = rows.filter(r => r.q3_creativity === 'groundbreaking' || r.q3_creativity === 'really_creative').length;

  const cntHigher  = rows.filter(r => r.q4_budget === 'higher').length;
  const cntOnPar   = rows.filter(r => r.q4_budget === 'on_par').length;
  const cntCheaper = rows.filter(r => r.q4_budget === 'cheaper').length;
  const budgetTotal = cntHigher + cntOnPar + cntCheaper;
  // Marker position 0–100 on the budget scale (0 = far-left/higher, 100 = far-right/cheaper)
  const budgetMarkerPos = budgetTotal > 0
    ? (((cntCheaper - cntHigher) / budgetTotal + 1) / 2) * 100
    : 50;

  // Cache 60 seconds — public endpoint, fine to serve slightly stale
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  return res.status(200).json({
    total,
    quality:    { pct: pct(highQual) },
    creativity: { pct: pct(highCrea) },
    budget: {
      higher:    cntHigher,
      on_par:    cntOnPar,
      cheaper:   cntCheaper,
      markerPos: budgetMarkerPos,
      total:     budgetTotal,
    },
    // quotes + keywords ship in step 4 — endpoint stable, additive change
  });
}
