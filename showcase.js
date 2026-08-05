// Showcase page — minimal editorial layout. Loads from /api/public.
// Falls back to a small sample if the API is unreachable.

import { escapeHtml } from './util.js?v=1';

const QUALITY_LABELS = {
  // Current form values
  exceptional: 'Exceptional',
  strong: 'Strong',
  satisfactory: 'Satisfactory',
  below_expectations: 'Below expectations',
  unsatisfactory: 'Unsatisfactory',
  // Legacy values still present on older rows
  excellent: 'Excellent',
  high: 'High standard',
  fair: 'Fair',
  not_everything: "Didn't fully land",
  disappointing: 'Disappointing',
};
const CREATIVITY_LABELS = {
  groundbreaking: 'Groundbreaking',
  really_creative: 'Really creative',
  quite_creative: 'Quite creative',
  average: 'Average',
  lacking: 'Lacking',
};
// Restrained mapping — Copper/Sodium/Flame variants only (no Potassium card chrome)
const QUALITY_COLORS = {
  // Current form values
  exceptional:        'var(--copper)',
  strong:             '#7BC8B6',
  satisfactory:       'var(--sodium)',
  below_expectations: '#F58A7E',
  unsatisfactory:     'var(--flame)',
  // Legacy values still present on older rows
  excellent:          'var(--copper)',
  high:               '#7BC8B6',
  fair:               'var(--sodium)',
  not_everything:     '#F58A7E',
  disappointing:      'var(--flame)',
};
const CREATIVITY_COLORS = {
  groundbreaking:  'var(--copper)',
  really_creative: '#7BC8B6',
  quite_creative:  'var(--sodium)',
  average:         '#F58A7E',
  lacking:         'var(--flame)',
};

const QUOTE_INTERVAL_MS = 6000;

const FALLBACK = {
  total: 8,
  quality: {
    pct: 88,
    breakdown: { excellent: 4, high: 3, fair: 1, not_everything: 0, disappointing: 0 },
  },
  creativity: {
    pct: 75,
    breakdown: { groundbreaking: 1, really_creative: 5, quite_creative: 2, average: 0, lacking: 0 },
  },
  budget: { higher: 2, on_par: 4, cheaper: 1, markerPos: 42.86, total: 7 },
  quotes: [
    { text: 'GIG turned a dense Phase 3 dataset into a story that resonated with our HCP audience. The team\'s creative instinct sharpened our positioning in a crowded oncology space.', attribution: 'Healthcare client' },
    { text: 'Honestly the best agency work we\'ve commissioned this decade. The repositioning gave the brand five more years of life — internal stakeholders bought in faster than I\'ve ever seen.', attribution: 'Healthcare client' },
    { text: 'GIG handled a complex multi-stakeholder approval process with patience and clarity. The final assets landed approved on first submission across two markets — almost unheard of for us.', attribution: 'Healthcare client' },
    { text: 'Strong on the science, strong on the design. The interactive eDetail performed above benchmark on time-on-page and HCP recall in our follow-up survey.', attribution: 'Healthcare client' },
  ],
};

// Local-dev convenience: hit the deployed /api/public from localhost
// (Python's http.server doesn't run our serverless functions), so the
// local showcase shows the same live aggregates production users see.
const HOSTNAME = (typeof location !== 'undefined' && location.hostname) || '';
const IS_LOCAL = HOSTNAME === 'localhost' || HOSTNAME === '127.0.0.1' || HOSTNAME === '';
const LIVE_API_BASE = 'https://gig-health-client-survey.vercel.app';
const PUBLIC_URL = IS_LOCAL ? `${LIVE_API_BASE}/api/public` : '/api/public';

// Survey page pre-warms /api/public into sessionStorage so the
// showcase can paint immediately on click-through. Treat the cached
// copy as fresh for 5 min — it still kicks off a background refresh.
const SHOWCASE_CACHE_KEY = 'gig_showcase_public_v1';
const CACHE_FRESH_MS = 5 * 60 * 1000;

function readWarmCache() {
  try {
    const raw = sessionStorage.getItem(SHOWCASE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > CACHE_FRESH_MS) return null;
    return parsed.data;
  } catch { return null; }
}

async function fetchPublic() {
  const res = await fetch(PUBLIC_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

function writeWarmCache(json) {
  try {
    sessionStorage.setItem(SHOWCASE_CACHE_KEY, JSON.stringify({
      data: json, ts: Date.now(),
    }));
  } catch {}
}

// ─── Quality cell ───────────────────────────────────────────
function renderQuality(quality) {
  const numEl = document.getElementById('quality-num');
  if (numEl) {
    numEl.textContent = quality.pct;
    numEl.classList.remove('skel-num');
  }
}

// ─── Responses cell ─────────────────────────────────────────
function renderResponses(total) {
  const el = document.getElementById('responses-num');
  if (el) el.textContent = total > 0 ? `+${total}` : '0';
}

// ─── Creativity cell ───────────────────────────────────────
function renderCreativity(creativity) {
  const numEl = document.getElementById('creativity-num');
  if (numEl) {
    numEl.textContent = creativity.pct;
    numEl.classList.remove('skel-num');
  }
}

// ─── Budget marker (horizontal scale, matches dashboard) ──
function renderBudget(budget) {
  const marker = document.getElementById('budget-marker');
  if (marker) {
    marker.style.left = `${budget.markerPos}%`;
    if (budget.total === 0) marker.classList.add('is-empty');
  }
}

// ─── Quote carousel ────────────────────────────────────────
// Tracks the currently-rendered quote signature so a background
// refresh that returns identical text doesn't restart the carousel.
let renderedQuoteSig = null;

function renderQuotes(quotes) {
  const stage = document.getElementById('quote-stage');
  const nav   = document.getElementById('quote-nav');
  if (!stage || !nav) return;

  const sig = JSON.stringify(quotes.map(q => q.text));
  if (sig === renderedQuoteSig) return;
  renderedQuoteSig = sig;

  stage.removeAttribute('aria-busy');

  if (!quotes.length) {
    stage.innerHTML = '<p class="show-empty">Quotes will appear here once a few clients have submitted feedback with permission to share.</p>';
    nav.innerHTML = '';
    return;
  }

  stage.innerHTML = quotes.map((q, i) => `
    <blockquote class="quote-card ${i === 0 ? 'is-active' : ''}" data-i="${i}">
      <p class="quote-text">${escapeHtml(q.text)}</p>
    </blockquote>
  `).join('');
  nav.innerHTML = quotes.map((_, i) => `
    <button class="quote-dot ${i === 0 ? 'is-active' : ''}" type="button" data-i="${i}" aria-label="Quote ${i + 1}"></button>
  `).join('');

  let current = 0;
  let timerId = null;
  function show(n) {
    current = (n + quotes.length) % quotes.length;
    stage.querySelectorAll('.quote-card').forEach((el, i) => el.classList.toggle('is-active', i === current));
    nav.querySelectorAll('.quote-dot').forEach((el, i) => el.classList.toggle('is-active', i === current));
  }
  const start = () => { timerId = setInterval(() => show(current + 1), QUOTE_INTERVAL_MS); };
  const stop  = () => { if (timerId) { clearInterval(timerId); timerId = null; } };
  const reset = () => { stop(); start(); };

  nav.addEventListener('click', (e) => {
    const dot = e.target.closest('.quote-dot');
    if (!dot) return;
    const i = parseInt(dot.dataset.i, 10);
    if (Number.isFinite(i)) { show(i); reset(); }
  });
  const wrap = stage.closest('.data-quote');
  wrap?.addEventListener('mouseenter', stop);
  wrap?.addEventListener('mouseleave', () => { if (!timerId) start(); });

  start();
}

// ─── Scroll-reveal ─────────────────────────────────────────
function setupScrollReveal() {
  const targets = document.querySelectorAll('.data-cell, .show-cta');
  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-revealed'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-revealed');
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.1 });
  targets.forEach(el => io.observe(el));
}

// ─── Bootstrap ─────────────────────────────────────────────
// Stale-while-revalidate at the client level:
//   1. If the survey page warmed sessionStorage, render that immediately
//      (zero-network paint).
//   2. Otherwise show the skeleton until the network resolves.
//   3. Always kick off a fresh fetch in the background and re-render
//      if anything changed.
function renderAll(data) {
  renderQuality(data.quality);
  renderResponses(data.total);
  renderCreativity(data.creativity);
  renderBudget(data.budget);
  renderQuotes(data.quotes || []);
}

(async () => {
  setupScrollReveal();

  const warm = readWarmCache();
  if (warm) renderAll(warm);

  try {
    const fresh = await fetchPublic();
    writeWarmCache(fresh);
    renderAll(fresh);
  } catch (err) {
    if (!warm) {
      console.warn('[showcase] live stats unreachable, using fallback', err);
      renderAll(FALLBACK);
    }
    // If we had warm data, just keep showing it — no need to clobber
    // it with FALLBACK on a transient network blip.
  }
})();
