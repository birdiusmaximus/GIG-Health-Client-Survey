// GET /api/public — sanitized aggregate stats + curated anonymous quotes
// for the public showcase page. No auth required. Never returns project
// names, referral info, or any PII.

import { createClient } from '@supabase/supabase-js';

const cleanUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const cleanKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabase = (cleanUrl && cleanKey)
  ? createClient(cleanUrl, cleanKey, { auth: { persistSession: false } })
  : null;

const QUALITY_KEYS    = ['excellent', 'high', 'fair', 'not_everything', 'disappointing'];
const CREATIVITY_KEYS = ['groundbreaking', 'really_creative', 'quite_creative', 'average', 'lacking'];

function countByKey(rows, field, keys) {
  return Object.fromEntries(keys.map(k => [k, rows.filter(r => r[field] === k).length]));
}

// Strip the project name (case-insensitive) from a quote so client
// names can't leak even if the client mentioned theirs mid-quote.
function stripProjectName(quote, projectName) {
  if (!quote || !projectName) return quote;
  const escaped = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return quote.replace(new RegExp(escaped, 'gi'), 'the project').trim();
}

function curateQuotes(rows, limit = 8) {
  const candidates = rows.filter(r =>
    r.q6_permission === 'yes' &&
    (r.q2_quality === 'excellent' || r.q2_quality === 'high') &&
    r.q5_experience && r.q5_experience.trim().length >= 80
  );
  candidates.sort((a, b) => b.q5_experience.length - a.q5_experience.length);
  return candidates.slice(0, limit).map(r => ({
    text: stripProjectName(r.q5_experience.trim(), r.q1_project_name),
    attribution: 'Healthcare client',
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured on server' });
  }

  // q1_project_name only used server-side for stripProjectName(); never leaves
  const { data, error } = await supabase
    .from('responses')
    .select('q1_project_name, q2_quality, q3_creativity, q4_budget, q5_experience, q6_permission');

  if (error) {
    console.error('[public] supabase error', error);
    return res.status(500).json({ error: error.message });
  }

  const rows = data || [];
  const total = rows.length;
  const pct = (n) => total ? Math.round((n / total) * 100) : 0;

  const qBreakdown = countByKey(rows, 'q2_quality',    QUALITY_KEYS);
  const cBreakdown = countByKey(rows, 'q3_creativity', CREATIVITY_KEYS);

  const highQual = qBreakdown.excellent + qBreakdown.high;
  const highCrea = cBreakdown.groundbreaking + cBreakdown.really_creative;

  const cntHigher  = rows.filter(r => r.q4_budget === 'higher').length;
  const cntOnPar   = rows.filter(r => r.q4_budget === 'on_par').length;
  const cntCheaper = rows.filter(r => r.q4_budget === 'cheaper').length;
  const budgetTotal = cntHigher + cntOnPar + cntCheaper;
  const budgetMarkerPos = budgetTotal > 0
    ? (((cntCheaper - cntHigher) / budgetTotal + 1) / 2) * 100
    : 50;

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  return res.status(200).json({
    total,
    quality: {
      pct: pct(highQual),
      breakdown: qBreakdown,   // counts per rating, in QUALITY_KEYS order
    },
    creativity: {
      pct: pct(highCrea),
      breakdown: cBreakdown,
    },
    budget: {
      higher: cntHigher, on_par: cntOnPar, cheaper: cntCheaper,
      markerPos: budgetMarkerPos, total: budgetTotal,
    },
    quotes: curateQuotes(rows),
  });
}
