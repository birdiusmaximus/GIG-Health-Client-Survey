// Showcase page — loads sanitized data from /api/public, renders:
//   - hero count
//   - 4-card trust metric strip (Quality / Creativity / Budget scale)
//   - auto-advancing quote carousel
//   - theme keyword cloud
//   - scroll-reveal entrance animations
// Falls back to a small sample if /api/public is unreachable (local dev).

const statsEl     = document.getElementById('show-stats');
const countEl     = document.getElementById('show-count');
const quoteStage  = document.getElementById('quote-stage');
const quoteNav    = document.getElementById('quote-nav');
const themeCloud  = document.getElementById('theme-cloud');

const QUOTE_INTERVAL_MS = 6000;

// ─── Fallback sample for dev / network failure ────────────────
const FALLBACK = {
  total: 8,
  quality:    { pct: 88 },
  creativity: { pct: 75 },
  budget: { higher: 2, on_par: 4, cheaper: 1, markerPos: 42.86, total: 7 },
  quotes: [
    { text: 'GIG turned a dense Phase 3 dataset into a story that resonated with our HCP audience. The team\'s creative instinct sharpened our positioning in a crowded oncology space.', attribution: 'Healthcare client' },
    { text: 'Honestly the best agency work we\'ve commissioned this decade. The repositioning gave the brand five more years of life — internal stakeholders bought in faster than I\'ve ever seen.', attribution: 'Healthcare client' },
    { text: 'GIG handled a complex multi-stakeholder approval process with patience and clarity. The final assets landed approved on first submission across two markets — almost unheard of for us.', attribution: 'Healthcare client' },
    { text: 'Strong on the science, strong on the design. The interactive eDetail performed above benchmark on time-on-page and HCP recall in our follow-up survey.', attribution: 'Healthcare client' },
  ],
  themes: [
    { word: 'creative', count: 6 }, { word: 'strategy', count: 5 },
    { word: 'audience', count: 4 }, { word: 'design',   count: 4 },
    { word: 'engaging', count: 4 }, { word: 'approval', count: 3 },
    { word: 'stakeholders', count: 3 }, { word: 'patient', count: 3 },
    { word: 'science', count: 3 }, { word: 'narrative', count: 2 },
    { word: 'responsive', count: 2 }, { word: 'timeline', count: 2 },
    { word: 'oncology', count: 2 }, { word: 'positioning', count: 2 },
    { word: 'pitch', count: 2 },
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

// ─── Hero count ──────────────────────────────────────────────
function renderHeroCount(total) {
  if (!countEl) return;
  if (!total) { countEl.textContent = 'Honest feedback, collected as projects wrap.'; return; }
  countEl.textContent = `${total} response${total === 1 ? '' : 's'} across recent projects`;
}

// ─── Trust metric strip ─────────────────────────────────────
function scoreColorClass(p) {
  if (p == null) return '';
  if (p >= 75) return 'is-good';
  if (p >= 50) return 'is-warn';
  return 'is-bad';
}

function renderStats(s) {
  statsEl.innerHTML = `
    <div class="stat is-accent">
      <span class="stat-value">${s.total}</span>
      <span class="stat-label">Responses</span>
    </div>
    <div class="stat">
      <span class="stat-value ${scoreColorClass(s.quality.pct)}">${s.quality.pct}<span class="stat-unit">%</span></span>
      <span class="stat-label">High quality</span>
    </div>
    <div class="stat">
      <span class="stat-value ${scoreColorClass(s.creativity.pct)}">${s.creativity.pct}<span class="stat-unit">%</span></span>
      <span class="stat-label">Creative</span>
    </div>
    <div class="stat is-budget">
      <div class="budget-display">
        <div class="budget-scale" role="img" aria-label="Budget position scale">
          <span class="budget-zone is-higher"  title="Higher than others: ${s.budget.higher}"></span>
          <span class="budget-zone is-on-par"  title="On par: ${s.budget.on_par}"></span>
          <span class="budget-zone is-cheaper" title="Cheaper than others: ${s.budget.cheaper}"></span>
          <span class="budget-marker ${s.budget.total === 0 ? 'is-empty' : ''}" style="left:${s.budget.markerPos}%" title="Average of ${s.budget.total} responses"></span>
        </div>
        <div class="budget-axis">
          <span>Higher</span>
          <span>On par</span>
          <span>Cheaper</span>
        </div>
      </div>
      <span class="stat-label">Budget position</span>
    </div>
  `;
}

// ─── Quote carousel ─────────────────────────────────────────
function renderQuotes(quotes) {
  if (!quoteStage || !quoteNav) return;

  if (!quotes.length) {
    quoteStage.innerHTML = '<p class="show-empty">Quotes will appear here once a few clients have submitted feedback with permission to share.</p>';
    quoteNav.innerHTML = '';
    return;
  }

  quoteStage.innerHTML = quotes.map((q, i) => `
    <blockquote class="quote-card ${i === 0 ? 'is-active' : ''}" data-i="${i}">
      <p class="quote-text">${escapeHtml(q.text)}</p>
      <footer class="quote-attribution">— ${escapeHtml(q.attribution || 'Healthcare client')}</footer>
    </blockquote>
  `).join('');

  quoteNav.innerHTML = quotes.map((_, i) => `
    <button class="quote-dot ${i === 0 ? 'is-active' : ''}" type="button" data-i="${i}" aria-label="Quote ${i + 1}"></button>
  `).join('');

  let current = 0;
  let timerId = null;

  function show(n) {
    current = (n + quotes.length) % quotes.length;
    quoteStage.querySelectorAll('.quote-card').forEach((el, i) => {
      el.classList.toggle('is-active', i === current);
    });
    quoteNav.querySelectorAll('.quote-dot').forEach((el, i) => {
      el.classList.toggle('is-active', i === current);
    });
  }
  function autoAdvance() {
    timerId = setInterval(() => show(current + 1), QUOTE_INTERVAL_MS);
  }
  function restartTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    autoAdvance();
  }

  quoteNav.addEventListener('click', (e) => {
    const dot = e.target.closest('.quote-dot');
    if (!dot) return;
    const i = parseInt(dot.dataset.i, 10);
    if (Number.isFinite(i)) { show(i); restartTimer(); }
  });

  // pause on hover so people can read long quotes
  const wrap = quoteStage.closest('.quote-carousel');
  wrap?.addEventListener('mouseenter', () => { if (timerId) { clearInterval(timerId); timerId = null; } });
  wrap?.addEventListener('mouseleave', () => { if (!timerId) autoAdvance(); });

  autoAdvance();
}

// ─── Theme cloud ────────────────────────────────────────────
function renderThemes(themes) {
  if (!themeCloud) return;
  if (!themes.length) {
    themeCloud.innerHTML = '<p class="show-empty">Themes will appear here once enough feedback is in.</p>';
    return;
  }

  const maxCount = Math.max(...themes.map(t => t.count));
  // Size ranges from 0.85rem (lowest freq) to 1.7rem (highest)
  const minSize = 0.85;
  const maxSize = 1.7;

  themeCloud.innerHTML = themes.map((t, i) => {
    const ratio = maxCount > 1 ? (t.count - 1) / (maxCount - 1) : 0;
    const size = (minSize + ratio * (maxSize - minSize)).toFixed(2);
    const isTop = i < 3;       // top three get the Flame highlight
    return `<span class="theme-chip ${isTop ? 'is-top' : ''}" style="--size:${size}rem" title="${t.count} mention${t.count === 1 ? '' : 's'}">${escapeHtml(t.word)}</span>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ─── Scroll-reveal entrance animations ──────────────────────
function setupScrollReveal() {
  const targets = document.querySelectorAll('.show-section, .show-stats, .show-cta');
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
  }, { threshold: 0.15 });
  targets.forEach(el => io.observe(el));
}

// ─── Bootstrap ──────────────────────────────────────────────
(async () => {
  const data = await loadPublic();
  renderHeroCount(data.total);
  renderStats(data);
  renderQuotes(data.quotes || []);
  renderThemes(data.themes || []);
  setupScrollReveal();
})();
