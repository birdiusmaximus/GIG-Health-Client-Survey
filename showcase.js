// Showcase page — minimal editorial layout. Loads from /api/public.
// Falls back to a small sample if the API is unreachable.

const countEl    = document.getElementById('show-count');

const QUALITY_LABELS = {
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
  excellent:      'var(--copper)',
  high:           '#7BC8B6',
  fair:           'var(--sodium)',
  not_everything: '#F58A7E',
  disappointing:  'var(--flame)',
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

async function loadPublic() {
  try {
    const res = await fetch('/api/public');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    console.warn('[showcase] live stats unreachable, using fallback', err);
    return FALLBACK;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ─── Hero count ─────────────────────────────────────────────
function renderHeroCount(total) {
  if (!countEl) return;
  if (!total) { countEl.textContent = 'Honest feedback, collected as projects wrap.'; return; }
  countEl.textContent = `${total} response${total === 1 ? '' : 's'} across recent projects`;
}

// ─── Quality cell ───────────────────────────────────────────
function renderQuality(quality) {
  const numEl     = document.getElementById('quality-num');
  const donutEl   = document.getElementById('quality-donut');
  const legendEl  = document.getElementById('quality-legend');
  if (numEl) numEl.textContent = quality.pct;

  const entries = Object.entries(quality.breakdown);
  const total = entries.reduce((s, [, c]) => s + c, 0);
  const R = 40;
  const C = 2 * Math.PI * R;

  if (donutEl) {
    let svg = `<svg viewBox="0 0 100 100" aria-hidden="true">`;
    svg += `<circle r="${R}" cx="50" cy="50" fill="none" stroke="rgba(254,246,246,0.06)" stroke-width="10" />`;
    if (total > 0) {
      let offset = 0;
      for (const [key, count] of entries) {
        if (!count) continue;
        const pct = count / total;
        const dashLen = pct * C;
        const dashGap = C - dashLen;
        svg += `<circle r="${R}" cx="50" cy="50" fill="none"
          stroke="${QUALITY_COLORS[key]}" stroke-width="10"
          stroke-dasharray="${dashLen.toFixed(2)} ${dashGap.toFixed(2)}"
          stroke-dashoffset="${(-offset * C).toFixed(2)}"
          transform="rotate(-90 50 50)" stroke-linecap="butt" />`;
        offset += pct;
      }
    }
    svg += `</svg>`;
    donutEl.innerHTML = svg;
  }

  if (legendEl) {
    legendEl.innerHTML = entries
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `
        <div class="legend-row">
          <span class="legend-dot" style="--c:${QUALITY_COLORS[key]}"></span>
          <span class="legend-label">${QUALITY_LABELS[key]}</span>
          <span class="legend-count">${count}</span>
        </div>
      `).join('');
  }
}

// ─── Responses cell ─────────────────────────────────────────
function renderResponses(total) {
  const el = document.getElementById('responses-num');
  if (el) el.textContent = total > 0 ? `+${total}` : '0';
}

// ─── Creativity cell + bars ────────────────────────────────
function renderCreativity(creativity) {
  const numEl  = document.getElementById('creativity-num');
  const barsEl = document.getElementById('creativity-bars');
  if (numEl) numEl.textContent = creativity.pct;

  if (!barsEl) return;
  const entries = Object.entries(creativity.breakdown);
  const max = Math.max(...entries.map(([, c]) => c), 1);
  barsEl.innerHTML = entries.map(([key, count]) => {
    const h = Math.max(10, (count / max) * 100);
    return `<div class="creativity-bar" style="--h:${h}%; --c:${CREATIVITY_COLORS[key]}"
      title="${CREATIVITY_LABELS[key]}: ${count}"></div>`;
  }).join('');
}

// ─── Budget marker ─────────────────────────────────────────
function renderBudget(budget) {
  const marker = document.getElementById('budget-marker');
  if (marker) {
    marker.style.left = `${budget.markerPos}%`;
    if (budget.total === 0) marker.classList.add('is-empty');
  }
}

// ─── Quote carousel ────────────────────────────────────────
function renderQuotes(quotes) {
  const stage = document.getElementById('quote-stage');
  const nav   = document.getElementById('quote-nav');
  if (!stage || !nav) return;

  if (!quotes.length) {
    stage.innerHTML = '<p class="show-empty">Quotes will appear here once a few clients have submitted feedback with permission to share.</p>';
    nav.innerHTML = '';
    return;
  }

  stage.innerHTML = quotes.map((q, i) => `
    <blockquote class="quote-card ${i === 0 ? 'is-active' : ''}" data-i="${i}">
      <p class="quote-text">${escapeHtml(q.text)}</p>
      <footer class="quote-attribution">— ${escapeHtml(q.attribution || 'Healthcare client')}</footer>
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
  const wrap = stage.closest('.show-quote');
  wrap?.addEventListener('mouseenter', stop);
  wrap?.addEventListener('mouseleave', () => { if (!timerId) start(); });

  start();
}

// ─── Scroll-reveal ─────────────────────────────────────────
function setupScrollReveal() {
  const targets = document.querySelectorAll('.data-cell, .show-quote, .show-cta');
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
(async () => {
  const data = await loadPublic();
  renderHeroCount(data.total);
  renderQuality(data.quality);
  renderResponses(data.total);
  renderCreativity(data.creativity);
  renderBudget(data.budget);
  renderQuotes(data.quotes || []);
  setupScrollReveal();
})();
