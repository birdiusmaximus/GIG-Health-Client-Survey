// GET /api/public — sanitized aggregate stats + curated anonymous quotes
// for the public showcase page. No auth required. Never returns project
// names, referral info, or any PII.

import { createClient } from '@supabase/supabase-js';

const cleanUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const cleanKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabase = (cleanUrl && cleanKey)
  ? createClient(cleanUrl, cleanKey, { auth: { persistSession: false } })
  : null;

// Q2 rating scale was renamed mid-2026; both key sets can appear in
// historical rows. Aggregates count them together.
const QUALITY_KEYS = [
  'exceptional', 'strong', 'satisfactory', 'below_expectations', 'unsatisfactory',
  'excellent', 'high', 'fair', 'not_everything', 'disappointing',
];
const QUALITY_HIGH_TIER = ['exceptional', 'strong', 'excellent', 'high'];
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

// Build the public quote list.
// Single hard rule: the client must have answered 'yes' to Q6
// ("Happy for us to share your response on our channels?"). No quality
// or length filters — every permitted, non-empty Q5 answer shows up
// in the carousel. Sorted longest-first so the lead quote is the most
// substantive, then it auto-rotates through the rest.
function curateQuotes(rows) {
  return rows
    .filter(r =>
      r.q6_permission === 'yes' &&
      typeof r.q5_experience === 'string' &&
      r.q5_experience.trim().length > 0
    )
    .sort((a, b) => b.q5_experience.length - a.q5_experience.length)
    .map(r => ({
      text: stripProjectName(r.q5_experience.trim(), r.q1_project_name),
      attribution: 'Healthcare client',
    }));
}

// CORS — endpoint is already public-by-design, but we have to set the
// header explicitly so localhost dev pages can fetch it cross-origin.
// Allow our deployed origin + any localhost/127.0.0.1 port; everything
// else gets no CORS header → browser blocks it cleanly.
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!supabase) {
    return res.status(500).json({ error: 'server not configured' });
  }

  // q1_project_name only used server-side for stripProjectName(); never leaves
  const { data, error } = await supabase
    .from('responses')
    .select('q1_project_name, q2_quality, q3_creativity, q4_budget, q5_experience, q6_permission');

  if (error) {
    console.error('[public] supabase error', error);
    return res.status(500).json({ error: 'failed to load aggregates' });
  }

  const rows = data || [];
  const total = rows.length;
  const pct = (n) => total ? Math.round((n / total) * 100) : 0;

  const qBreakdown = countByKey(rows, 'q2_quality',    QUALITY_KEYS);
  const cBreakdown = countByKey(rows, 'q3_creativity', CREATIVITY_KEYS);

  const highQual = QUALITY_HIGH_TIER.reduce((sum, k) => sum + (qBreakdown[k] || 0), 0);
  const highCrea = cBreakdown.groundbreaking + cBreakdown.really_creative;

  const cntHigher  = rows.filter(r => r.q4_budget === 'higher').length;
  const cntOnPar   = rows.filter(r => r.q4_budget === 'on_par').length;
  const cntCheaper = rows.filter(r => r.q4_budget === 'cheaper').length;
  const budgetTotal = cntHigher + cntOnPar + cntCheaper;
  const budgetMarkerPos = budgetTotal > 0
    ? (((cntCheaper - cntHigher) / budgetTotal + 1) / 2) * 100
    : 50;

  // Edge cache: fresh for 60 s, then serve stale instantly for up to
  // 10 min while a background fetch refreshes. Browser keeps its own
  // 60 s copy so a back-button hit is instant too. The combination
  // means almost every showcase visit gets a precomputed response.
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=600');
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
