// GET /api/public — sanitized aggregate stats + curated anonymous quotes
// + extracted theme keywords for the public showcase page.
// No auth required. Never returns project names, referral info, or any PII.

import { createClient } from '@supabase/supabase-js';

const cleanUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const cleanKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabase = (cleanUrl && cleanKey)
  ? createClient(cleanUrl, cleanKey, { auth: { persistSession: false } })
  : null;

// ─────────────────────────────────────────────────────────────
// Stopwords — common English + GIG-specific + sector words we don't
// want to highlight. Tuned for healthcare-comms feedback.
// ─────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  // English fillers
  'the','and','for','that','this','with','have','from','they','them','their',
  'were','been','will','would','could','should','about','into','than','then',
  'also','more','very','just','some','what','when','where','which','while',
  'because','through','during','within','without','being','having','really',
  'much','many','make','made','take','took','give','gave','need','want',
  'good','great','well','best','better','quite','still','here','there','your',
  'mine','ours','him','her','his','hers','our','out','off','over','under',
  'each','every','any','all','none','both','either','neither','same','other',
  // common verbs
  'said','says','say','went','goes','come','came','keep','kept','know','knew',
  'think','thought','feel','felt','seem','seemed','look','looked','find','found',
  'work','worked','working','works','used','using','done','help','helped',
  // pronouns + articles already in defaults but be thorough
  'they','them','their','there','these','those','those','about',
  // GIG / agency context — don't surface our own brand or generic biz words
  'gig','team','project','client','clients','agency','brand','brands','work',
  'projects','workings','company','partner','partners',
  // pharma-specific verbal noise
  'pharma','launch','campaign','product','products','market','sector',
  // generic positive adjectives that aren't insight ("good" is everywhere)
  'good','nice','okay','fine','bad','best','worst','really','very',
]);

function extractKeywords(texts, limit = 18) {
  const counts = new Map();
  for (const t of texts) {
    if (!t || typeof t !== 'string') continue;
    const words = t.toLowerCase()
      .replace(/[^a-z\s'-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 5 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
    for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

// Remove the project name from a quote (case-insensitive) so client names
// can't leak even if the client mentioned their own project mid-quote.
function stripProjectName(quote, projectName) {
  if (!quote || !projectName) return quote;
  const escaped = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return quote.replace(new RegExp(escaped, 'gi'), 'the project').trim();
}

// Pick the best quotes — only from rows where client granted permission,
// only from positive-rated experiences, length-filtered for substance.
function curateQuotes(rows, limit = 8) {
  const candidates = rows.filter(r =>
    r.q6_permission === 'yes' &&
    (r.q2_quality === 'excellent' || r.q2_quality === 'high') &&
    r.q5_experience && r.q5_experience.trim().length >= 80
  );
  // Sort by quote length desc (longer = more substance), then shuffle ties
  candidates.sort((a, b) => b.q5_experience.length - a.q5_experience.length);
  return candidates.slice(0, limit).map(r => ({
    text: stripProjectName(r.q5_experience.trim(), r.q1_project_name),
    // attribution stays anonymous for now
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

  // For quote curation we DO need q1_project_name (to strip it from quotes)
  // and q6_permission (to filter). q1 never leaves the server — it's only
  // used as input to stripProjectName before discarding.
  const { data, error } = await supabase
    .from('responses')
    .select('q1_project_name, q2_quality, q3_creativity, q4_budget, q5_experience, q6_permission, q7_improvement');

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
  const budgetMarkerPos = budgetTotal > 0
    ? (((cntCheaper - cntHigher) / budgetTotal + 1) / 2) * 100
    : 50;

  const quotes = curateQuotes(rows);
  // Extract themes from Q5 (experience) + Q7 (improvement) feedback combined
  const themes = extractKeywords(rows.map(r => `${r.q5_experience || ''} ${r.q7_improvement || ''}`));

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  return res.status(200).json({
    total,
    quality:    { pct: pct(highQual) },
    creativity: { pct: pct(highCrea) },
    budget: {
      higher: cntHigher, on_par: cntOnPar, cheaper: cntCheaper,
      markerPos: budgetMarkerPos, total: budgetTotal,
    },
    quotes,
    themes,
  });
}
