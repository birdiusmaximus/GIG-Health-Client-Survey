// ──────────────────────────────────────────────────────────────
// Mock dashboard — renders demo survey responses.
// To wire to real data, replace MOCK_RESPONSES with a fetch from
// /api/responses (which would read from Airtable / Vercel KV /
// whatever backend you pick). Schema is identical to what the
// survey's /api/submit POSTs.
// ──────────────────────────────────────────────────────────────

const QUALITY_SCORE = {
  excellent: 5, high: 4, fair: 3, not_everything: 2, disappointing: 1,
};
const CREATIVITY_SCORE = {
  groundbreaking: 5, really_creative: 4, quite_creative: 3, average: 2, lacking: 1,
};
const QUALITY_LABEL = {
  excellent: 'Excellent', high: 'High standard', fair: 'Fair',
  not_everything: "Not everything we'd hoped", disappointing: 'Disappointing',
};
const CREATIVITY_LABEL = {
  groundbreaking: 'Groundbreaking',
  really_creative: 'Really creative',
  quite_creative: 'Quite creative',
  average: 'Average',
  lacking: 'Lacking',
};
const BUDGET_LABEL = {
  higher: 'Higher than others',
  on_par: 'On par',
  cheaper: 'Cheaper than others',
  na: 'N/A — predetermined',
};
const MARKETING_LABEL = {
  yes_as_is:    'Case study OK',
  yes_adapted:  'Case study OK (adapted)',
  possibly:     'Case study — check',
  no:           'No case study',
};

const MOCK_RESPONSES = [
  {
    id: 'r-001',
    submittedAt: '2026-05-12T14:22:00Z',
    q1_project_name: 'Bayer Eylea Launch HCP Campaign',
    q2_quality: 'excellent',
    q3_creativity: 'really_creative',
    q4_budget: 'on_par',
    q5_experience: "GIG turned a dense Phase 3 dataset into a story that resonated with our HCP audience. The team's creative instinct sharpened our positioning in a crowded retinal-disease space — we walked out of the launch meeting with a clearer story than we walked in with.",
    q6_permission: 'yes',
    q7_improvement: 'A bit more proactive risk-flagging earlier in the strategy phase would help. We hit two minor regulatory hurdles late that could have been spotted week one.',
    q8_marketing: 'yes_adapted',
    q9_referral: 'Sarah Linfield at Roche Ophthalmology — sarah.linfield@roche.com — they\'re briefing on a similar audience this autumn.',
    q10_trends: 'Curious how others are navigating PMI/MHRA cross-jurisdiction approvals for digital eDetail content.',
  },
  {
    id: 'r-002',
    submittedAt: '2026-05-08T09:14:00Z',
    q1_project_name: 'Pfizer Bivalent Booster Patient Awareness',
    q2_quality: 'high',
    q3_creativity: 'quite_creative',
    q4_budget: 'cheaper',
    q5_experience: "Tight timeline, late changes, and they kept the work strong. The strategic framing landed across three EU markets with minimal localisation friction.",
    q6_permission: 'yes',
    q7_improvement: 'Honestly nothing major — maybe a weekly written status doc instead of just Slack updates.',
    q8_marketing: 'possibly',
    q9_referral: '',
    q10_trends: '',
  },
  {
    id: 'r-003',
    submittedAt: '2026-05-05T16:48:00Z',
    q1_project_name: 'GSK Shingrix EU Roll-out',
    q2_quality: 'high',
    q3_creativity: 'really_creative',
    q4_budget: 'higher',
    q5_experience: "Loved the design but the strategy phase took longer than I'd hoped — felt like we were over-explaining the brief in week three. Once briefs were settled, the creative came in fast.",
    q6_permission: 'no',
    q7_improvement: 'Faster ramp on the strategy side. Maybe a 48-hour creative-territory turnaround on the initial brief.',
    q8_marketing: 'no',
    q9_referral: '',
    q10_trends: '',
  },
  {
    id: 'r-004',
    submittedAt: '2026-04-28T11:02:00Z',
    q1_project_name: 'Novartis Cosentyx Year-5 Brand Refresh',
    q2_quality: 'excellent',
    q3_creativity: 'groundbreaking',
    q4_budget: 'on_par',
    q5_experience: "Honestly the best agency work we've commissioned this decade. The repositioning gave the brand five more years of life — internal stakeholders bought in faster than I've ever seen.",
    q6_permission: 'yes',
    q7_improvement: 'Nothing comes to mind. Maybe more visibility into junior team time so we know who to recognise on our side too.',
    q8_marketing: 'yes_as_is',
    q9_referral: 'Marcus Chen, Eli Lilly Immunology — marcus.chen@lilly.com',
    q10_trends: 'AI-assisted brand-asset adaptation — how teams are balancing speed vs. consistency at scale.',
  },
  {
    id: 'r-005',
    submittedAt: '2026-04-22T13:30:00Z',
    q1_project_name: 'AstraZeneca Tagrisso Patient Stories Video',
    q2_quality: 'fair',
    q3_creativity: 'quite_creative',
    q4_budget: 'na',
    q5_experience: "The films came out well in the end, but the production schedule slipped twice and that cost us a launch window with one of our patient advocacy partners.",
    q6_permission: 'no',
    q7_improvement: 'Build slippage buffers into the production schedule from week one. Two weeks contingency would have saved us.',
    q8_marketing: 'possibly',
    q9_referral: '',
    q10_trends: 'How are agencies handling patient-talent consent renewals for content that lives multi-year?',
  },
  {
    id: 'r-006',
    submittedAt: '2026-04-15T10:11:00Z',
    q1_project_name: 'MSD Keytruda Oncologist Education Module',
    q2_quality: 'high',
    q3_creativity: 'really_creative',
    q4_budget: 'on_par',
    q5_experience: "Strong on the science, strong on the design. The interactive eDetail performed above benchmark on time-on-page and HCP recall in our follow-up survey.",
    q6_permission: 'yes',
    q7_improvement: 'Slightly more rigorous version control on the asset deliverables — we had three rounds of file naming confusion near the end.',
    q8_marketing: 'yes_adapted',
    q9_referral: '',
    q10_trends: '',
  },
  {
    id: 'r-007',
    submittedAt: '2026-04-09T08:45:00Z',
    q1_project_name: 'Sanofi Dupixent EU Awareness Refresh',
    q2_quality: 'excellent',
    q3_creativity: 'really_creative',
    q4_budget: 'on_par',
    q5_experience: "GIG handled a complex multi-stakeholder approval process with patience and clarity. The final assets landed approved on first submission across two markets — almost unheard of for us.",
    q6_permission: 'yes',
    q7_improvement: 'Honestly very little. Maybe ship monthly cost reports instead of quarterly so we can flag at finance check-ins.',
    q8_marketing: 'yes_as_is',
    q9_referral: '',
    q10_trends: 'Patient digital-companion tools — particularly how to maintain engagement past month three.',
  },
  {
    id: 'r-008',
    submittedAt: '2026-04-02T15:20:00Z',
    q1_project_name: 'BMS Opdivo Congress Booth Experience',
    q2_quality: 'high',
    q3_creativity: 'really_creative',
    q4_budget: 'higher',
    q5_experience: "The booth narrative was beautifully crafted and the interactive screens drew strong dwell time. Price was a stretch but the result felt worth it for the brand we were trying to project.",
    q6_permission: 'yes',
    q7_improvement: 'Cost transparency upfront — the change-order process surprised us twice.',
    q8_marketing: 'yes_adapted',
    q9_referral: '',
    q10_trends: '',
  },
];

// ──────────────────────────────────────────────────────────────
// Live data loader (Supabase via /api/responses) → falls back to
// MOCK_RESPONSES if the API isn't reachable (e.g., on the static
// dev server, or before Supabase env vars are configured).
// ──────────────────────────────────────────────────────────────
const TOKEN_KEY = 'gig_dash_token';

async function loadResponses() {
  let token = localStorage.getItem(TOKEN_KEY) || '';

  try {
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    const res = await fetch('/api/responses', { headers });

    if (res.status === 401) {
      const entered = prompt('Dashboard token required (set as DASHBOARD_TOKEN on Vercel):');
      if (entered) {
        localStorage.setItem(TOKEN_KEY, entered.trim());
        return loadResponses();
      }
      return { mode: 'mock', data: MOCK_RESPONSES, reason: 'no token' };
    }
    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }
    const data = await res.json();
    return { mode: 'live', data };
  } catch (err) {
    // Network error, 404 (no API on static dev server), or Supabase misconfigured
    return { mode: 'mock', data: MOCK_RESPONSES, reason: err.message };
  }
}

// ──────────────────────────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────────────────────────
const responsesEl = document.getElementById('responses');
const statsEl     = document.getElementById('stats');
const emptyNoteEl = document.getElementById('empty-note');
const filterSelEl = document.getElementById('filter-select');
const searchEl    = document.getElementById('filter-search');
const exportBtn   = document.getElementById('export-csv');
const footerCount = document.getElementById('footer-count');
const modeBanner  = document.getElementById('mode-banner');
const modeClear   = document.getElementById('mode-clear');

let allResponses = [];     // populated by loadResponses(), drives everything below

function pct(n, total) { return total === 0 ? 0 : Math.round((n / total) * 100); }
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderPips(score, total = 5) {
  let html = '<div class="r-pips">';
  for (let i = 1; i <= total; i++) {
    html += `<span class="r-pip${i <= score ? ' is-filled' : ''}"></span>`;
  }
  html += '</div>';
  return html;
}

function renderTags(r) {
  const tags = [];
  if (r.q6_permission === 'yes') tags.push('<span class="r-tag is-flame">Quotable</span>');
  if (r.q8_marketing === 'yes_as_is') tags.push('<span class="r-tag is-green">Case study</span>');
  else if (r.q8_marketing === 'yes_adapted') tags.push('<span class="r-tag is-green">Case study · adapted</span>');
  else if (r.q8_marketing === 'possibly') tags.push('<span class="r-tag is-yellow">Case study · check</span>');
  if (r.q9_referral && r.q9_referral.trim()) tags.push('<span class="r-tag is-mute">Referral</span>');
  return tags.length ? `<div class="r-tags">${tags.join('')}</div>` : '<div class="r-tags"></div>';
}

function renderResponse(r) {
  const qScore = QUALITY_SCORE[r.q2_quality] || 0;
  const cScore = CREATIVITY_SCORE[r.q3_creativity] || 0;
  const optional = (v) => v && v.trim() ? `<p>${escapeHtml(v)}</p>` : '<p class="r-empty">—</p>';

  return `
    <details class="response">
      <summary>
        <div>
          <div class="r-project">${escapeHtml(r.q1_project_name)}</div>
          <div class="r-date">${fmtDate(r.submittedAt)}</div>
        </div>
        <div class="r-rating">
          <span class="r-rating-label">Quality · ${QUALITY_LABEL[r.q2_quality]}</span>
          ${renderPips(qScore)}
        </div>
        <div class="r-rating">
          <span class="r-rating-label">Creativity · ${CREATIVITY_LABEL[r.q3_creativity]}</span>
          ${renderPips(cScore)}
        </div>
        <div class="r-rating">
          <span class="r-rating-label">Budget</span>
          <span style="font-size: 0.85rem; color: var(--ink);">${BUDGET_LABEL[r.q4_budget]}</span>
        </div>
        ${renderTags(r)}
      </summary>
      <div class="r-body">
        <div class="r-field is-wide">
          <h4>Experience working with GIG</h4>
          <p>${escapeHtml(r.q5_experience)}</p>
        </div>
        <div class="r-field is-wide">
          <h4>What we could do better</h4>
          <p>${escapeHtml(r.q7_improvement)}</p>
        </div>
        <div class="r-field">
          <h4>Permission to quote</h4>
          <p>${r.q6_permission === 'yes' ? 'Yes' : 'No'}</p>
        </div>
        <div class="r-field">
          <h4>Marketing use</h4>
          <p>${MARKETING_LABEL[r.q8_marketing]}</p>
        </div>
        <div class="r-field">
          <h4>Referral (optional)</h4>
          ${optional(r.q9_referral)}
        </div>
        <div class="r-field">
          <h4>Trends / challenges (optional)</h4>
          ${optional(r.q10_trends)}
        </div>
      </div>
    </details>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderStats(rs) {
  const total = rs.length;
  const highQual = rs.filter(r => r.q2_quality === 'excellent' || r.q2_quality === 'high').length;
  const highCrea = rs.filter(r => r.q3_creativity === 'groundbreaking' || r.q3_creativity === 'really_creative').length;
  const quotable = rs.filter(r => r.q6_permission === 'yes').length;
  const caseable = rs.filter(r => r.q8_marketing !== 'no').length;

  statsEl.innerHTML = `
    <div class="stat is-accent">
      <span class="stat-value">${total}</span>
      <span class="stat-label">Responses</span>
    </div>
    <div class="stat">
      <span class="stat-value">${pct(highQual, total)}<span class="stat-unit">%</span></span>
      <span class="stat-label">High quality</span>
    </div>
    <div class="stat">
      <span class="stat-value">${pct(highCrea, total)}<span class="stat-unit">%</span></span>
      <span class="stat-label">Creative</span>
    </div>
    <div class="stat">
      <span class="stat-value">${pct(quotable, total)}<span class="stat-unit">%</span></span>
      <span class="stat-label">Quotable</span>
    </div>
    <div class="stat">
      <span class="stat-value">${pct(caseable, total)}<span class="stat-unit">%</span></span>
      <span class="stat-label">Case-study ok</span>
    </div>
  `;
}

function applyFilters() {
  const filter = filterSelEl.value;
  const search = searchEl.value.trim().toLowerCase();

  let rs = allResponses.slice();

  if (filter === 'quotable')    rs = rs.filter(r => r.q6_permission === 'yes');
  if (filter === 'case_study')  rs = rs.filter(r => r.q8_marketing !== 'no');
  if (filter === 'high_quality') rs = rs.filter(r => r.q2_quality === 'excellent' || r.q2_quality === 'high');

  if (search) {
    rs = rs.filter(r => {
      const blob = [
        r.q1_project_name, r.q5_experience, r.q7_improvement,
        r.q9_referral, r.q10_trends,
      ].join(' ').toLowerCase();
      return blob.includes(search);
    });
  }

  // Always show stats for ALL responses (not filtered), so the overall
  // picture stays visible even when filtering down to a slice
  renderStats(allResponses);

  responsesEl.innerHTML = rs.map(renderResponse).join('');
  emptyNoteEl.hidden = rs.length > 0;
  const liveSuffix = window.__dashMode === 'mock' ? ' (mock)' : '';
  footerCount.textContent = `${rs.length} of ${allResponses.length}${liveSuffix}`;
}

filterSelEl.addEventListener('change', applyFilters);
searchEl.addEventListener('input', applyFilters);

// ──────────────────────────────────────────────────────────────
// CSV export
// ──────────────────────────────────────────────────────────────
exportBtn.addEventListener('click', () => {
  const headers = [
    'submittedAt', 'project', 'quality', 'creativity', 'budget',
    'experience', 'permission_to_quote', 'improvement',
    'marketing_use', 'referral', 'trends',
  ];
  const csvRows = [headers.join(',')];
  for (const r of allResponses) {
    csvRows.push([
      r.submitted_at || r.submittedAt,
      r.q1_project_name,
      QUALITY_LABEL[r.q2_quality],
      CREATIVITY_LABEL[r.q3_creativity],
      BUDGET_LABEL[r.q4_budget],
      r.q5_experience,
      r.q6_permission,
      r.q7_improvement,
      MARKETING_LABEL[r.q8_marketing],
      r.q9_referral || '',
      r.q10_trends || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gig-feedback-export-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Reset stored token (banner action)
modeClear?.addEventListener('click', () => {
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
});

// ──────────────────────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────────────────────
(async () => {
  const result = await loadResponses();
  window.__dashMode = result.mode;

  // Normalise field names — Supabase returns `submitted_at`, mock uses `submittedAt`
  allResponses = result.data.map(r => ({
    ...r,
    submittedAt: r.submitted_at || r.submittedAt,
  }));

  if (result.mode === 'mock') {
    modeBanner.hidden = false;
  }

  applyFilters();
})();
