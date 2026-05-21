// Showcase page — loads public stats from /api/public and renders the
// hero count + trust metrics. Falls back to gentle empty state if the
// API is unreachable (local dev server, network error, etc).

const statsEl  = document.getElementById('show-stats');
const countEl  = document.getElementById('show-count');

// Fallback sample for local dev (where /api/public isn't available)
const FALLBACK = {
  total: 8,
  quality:    { pct: 88 },
  creativity: { pct: 75 },
  budget: { higher: 2, on_par: 4, cheaper: 1, markerPos: 42.86, total: 7 },
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

function renderHeroCount(total) {
  if (!countEl) return;
  if (!total) {
    countEl.textContent = 'Honest feedback, collected as projects wrap.';
    return;
  }
  countEl.textContent = `${total} response${total === 1 ? '' : 's'} across recent projects`;
}

(async () => {
  const data = await loadPublic();
  renderHeroCount(data.total);
  renderStats(data);
})();
