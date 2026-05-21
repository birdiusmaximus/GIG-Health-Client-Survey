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
const USER_KEY        = 'gig_dash_user';
const PASS_KEY        = 'gig_dash_pass';
const LEGACY_TOKEN_KEY = 'gig_dash_token';

// One-time migration: any legacy bare-token in localStorage becomes the
// stored password (with an empty username) so existing dashboards don't
// log people out on the upgrade.
(() => {
  const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacy && !localStorage.getItem(PASS_KEY)) {
    localStorage.setItem(PASS_KEY, legacy);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }
})();

function authHeaderValue(username, password) {
  if (!password) return null;
  const creds = `${username || ''}:${password}`;
  return 'Basic ' + btoa(unescape(encodeURIComponent(creds)));
}

// One round-trip to /api/responses with a candidate username + password.
// Returns one of:
//   { ok: true,  data }                       — auth + fetch worked
//   { ok: false, status: 401 }                — credentials wrong/missing
//   { ok: false, networkError: true }         — API unreachable (dev / down)
//   { ok: false, status, error }              — other server error
async function tryFetch(username, password) {
  try {
    const headers = {};
    const auth = authHeaderValue(username, password);
    if (auth) headers['Authorization'] = auth;
    const res = await fetch('/api/responses', { headers });
    if (res.status === 401) return { ok: false, status: 401 };
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, status: res.status, error: body.error || `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, networkError: true, error: err.message };
  }
}

async function loadResponses() {
  const username = localStorage.getItem(USER_KEY) || '';
  const password = localStorage.getItem(PASS_KEY) || '';
  const result = await tryFetch(username, password);

  if (result.ok) return { mode: 'live', data: result.data };
  if (result.networkError) return { mode: 'mock', data: MOCK_RESPONSES };
  if (result.status === 401) {
    if (password) {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(PASS_KEY);
    }
    return { mode: 'needs-auth' };
  }
  console.error('[dashboard] unexpected API error', result);
  return { mode: 'mock', data: MOCK_RESPONSES };
}

// ──────────────────────────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────────────────────────
const responsesEl   = document.getElementById('responses');
const statsEl       = document.getElementById('stats');
const emptyNoteEl   = document.getElementById('empty-note');
const filterSelEl   = document.getElementById('filter-select');
const searchEl      = document.getElementById('filter-search');
const exportBtn     = document.getElementById('export-csv');
const footerCount   = document.getElementById('footer-count');
const confirmOverlay= document.getElementById('confirm-overlay');
const confirmProject= document.getElementById('confirm-project');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmDelete = document.getElementById('confirm-delete');

let allResponses = [];                  // populated by loadResponses()
const editingIds = new Set();           // ids currently in edit mode
let pendingDeleteId = null;             // id queued for delete confirmation

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

  // Quotable — always show, green if yes / red if no
  if (r.q6_permission === 'yes') {
    tags.push('<span class="r-tag is-good">Quotable</span>');
  } else {
    tags.push('<span class="r-tag is-bad">Not quotable</span>');
  }

  // Case-study tag — colour reflects status (as-is = green, adapted/check = yellow, no = red)
  if (r.q8_marketing === 'yes_as_is') {
    tags.push('<span class="r-tag is-good">Case study</span>');
  } else if (r.q8_marketing === 'yes_adapted') {
    tags.push('<span class="r-tag is-warn">Case study · adapted</span>');
  } else if (r.q8_marketing === 'possibly') {
    tags.push('<span class="r-tag is-warn">Case study · check</span>');
  } else if (r.q8_marketing === 'no') {
    tags.push('<span class="r-tag is-bad">No case study</span>');
  }

  // Referral — only show if present, always green
  if (r.q9_referral && r.q9_referral.trim()) {
    tags.push('<span class="r-tag is-good">Referral</span>');
  }

  return `<div class="r-tags">${tags.join('')}</div>`;
}

function renderResponse(r) {
  const qScore = QUALITY_SCORE[r.q2_quality] || 0;
  const cScore = CREATIVITY_SCORE[r.q3_creativity] || 0;
  const isEditing = editingIds.has(r.id);

  return `
    <details class="response" data-id="${escapeHtml(r.id)}" ${isEditing ? 'open' : ''}>
      <summary>
        <div>
          <div class="r-project">${escapeHtml(r.q1_project_name)}</div>
          <div class="r-date">${fmtDate(r.submittedAt)}</div>
        </div>
        <div class="r-rating">
          <span class="r-rating-label">Quality</span>
          ${renderPips(qScore)}
          <span class="r-rating-value">${QUALITY_LABEL[r.q2_quality]}</span>
        </div>
        <div class="r-rating">
          <span class="r-rating-label">Creativity</span>
          ${renderPips(cScore)}
          <span class="r-rating-value">${CREATIVITY_LABEL[r.q3_creativity]}</span>
        </div>
        <div class="r-rating">
          <span class="r-rating-label">Budget</span>
          <span class="r-rating-value">${BUDGET_LABEL[r.q4_budget]}</span>
        </div>
        ${renderTags(r)}
      </summary>
      ${isEditing ? renderEditForm(r) : renderStaticBody(r)}
    </details>
  `;
}

function renderStaticBody(r) {
  const optional = (v) => v && v.trim() ? `<p>${escapeHtml(v)}</p>` : '<p class="r-empty">—</p>';
  return `
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
      <div class="r-actions">
        <button class="r-edit-btn" type="button" data-edit-id="${escapeHtml(r.id)}">Edit</button>
        <button class="r-delete-btn" type="button" data-delete-id="${escapeHtml(r.id)}">Delete</button>
      </div>
    </div>
  `;
}

function selectOpts(currentValue, labelMap) {
  return Object.entries(labelMap).map(([value, label]) =>
    `<option value="${escapeHtml(value)}" ${value === currentValue ? 'selected' : ''}>${escapeHtml(label)}</option>`
  ).join('');
}

function renderEditForm(r) {
  return `
    <form class="r-edit-form" data-edit-form-id="${escapeHtml(r.id)}">
      <label class="r-edit-field is-wide">
        <span>Project name (Q1)</span>
        <input type="text" name="q1_project_name" value="${escapeHtml(r.q1_project_name)}" required />
      </label>
      <label class="r-edit-field">
        <span>Quality (Q2)</span>
        <select name="q2_quality">${selectOpts(r.q2_quality, QUALITY_LABEL)}</select>
      </label>
      <label class="r-edit-field">
        <span>Creativity (Q3)</span>
        <select name="q3_creativity">${selectOpts(r.q3_creativity, CREATIVITY_LABEL)}</select>
      </label>
      <label class="r-edit-field">
        <span>Budget (Q4)</span>
        <select name="q4_budget">${selectOpts(r.q4_budget, BUDGET_LABEL)}</select>
      </label>
      <label class="r-edit-field">
        <span>Permission (Q6)</span>
        <select name="q6_permission">
          <option value="yes" ${r.q6_permission === 'yes' ? 'selected' : ''}>Yes</option>
          <option value="no"  ${r.q6_permission === 'no'  ? 'selected' : ''}>No</option>
        </select>
      </label>
      <label class="r-edit-field is-wide">
        <span>Experience (Q5)</span>
        <textarea name="q5_experience" rows="3" required>${escapeHtml(r.q5_experience)}</textarea>
      </label>
      <label class="r-edit-field is-wide">
        <span>What we could do better (Q7)</span>
        <textarea name="q7_improvement" rows="3" required>${escapeHtml(r.q7_improvement)}</textarea>
      </label>
      <label class="r-edit-field is-wide">
        <span>Marketing use (Q8)</span>
        <select name="q8_marketing">${selectOpts(r.q8_marketing, MARKETING_LABEL)}</select>
      </label>
      <label class="r-edit-field is-wide">
        <span>Referral · optional (Q9)</span>
        <textarea name="q9_referral" rows="2">${escapeHtml(r.q9_referral || '')}</textarea>
      </label>
      <label class="r-edit-field is-wide">
        <span>Trends · optional (Q10)</span>
        <textarea name="q10_trends" rows="2">${escapeHtml(r.q10_trends || '')}</textarea>
      </label>
      <div class="r-edit-actions">
        <button type="button" class="r-cancel" data-cancel-id="${escapeHtml(r.id)}">Cancel</button>
        <button type="submit" class="r-save">Save</button>
      </div>
    </form>
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

  const cntHigher  = rs.filter(r => r.q4_budget === 'higher').length;
  const cntOnPar   = rs.filter(r => r.q4_budget === 'on_par').length;
  const cntCheaper = rs.filter(r => r.q4_budget === 'cheaper').length;
  const budgetTotal = cntHigher + cntOnPar + cntCheaper;     // exclude N/A

  // Score per response: higher = -1, on par = 0, cheaper = +1
  // Average across responses → range [-1, +1]
  // Then convert to a 0–100% position along the scale bar (0 = far left = higher, 100 = far right = cheaper)
  let markerPos = 50;
  let dom = 'No data';
  if (budgetTotal > 0) {
    const avgScore = (cntCheaper - cntHigher) / budgetTotal;     // [-1, 1]
    markerPos = ((avgScore + 1) / 2) * 100;                       // [0, 100]
    if      (markerPos < 25) dom = 'Often higher than others';
    else if (markerPos < 45) dom = 'Slightly higher';
    else if (markerPos <= 55) dom = 'On par with the market';
    else if (markerPos <= 75) dom = 'Slightly cheaper';
    else                     dom = 'Often cheaper than others';
  }

  statsEl.innerHTML = `
    <div class="stat is-accent">
      <span class="stat-value">${total}</span>
      <span class="stat-label">Responses</span>
    </div>
    <div class="stat">
      <span class="stat-value ${scoreColorClass(highQual, total)}">${pct(highQual, total)}<span class="stat-unit">%</span></span>
      <span class="stat-label">High quality</span>
    </div>
    <div class="stat">
      <span class="stat-value ${scoreColorClass(highCrea, total)}">${pct(highCrea, total)}<span class="stat-unit">%</span></span>
      <span class="stat-label">Creative</span>
    </div>
    <div class="stat is-budget">
      <div class="budget-display">
        <div class="budget-scale" role="img" aria-label="Budget position scale">
          <span class="budget-zone is-higher"  title="Higher than others: ${cntHigher}"></span>
          <span class="budget-zone is-on-par"  title="On par: ${cntOnPar}"></span>
          <span class="budget-zone is-cheaper" title="Cheaper than others: ${cntCheaper}"></span>
          <span class="budget-marker ${budgetTotal === 0 ? 'is-empty' : ''}" style="left:${markerPos}%" title="Average of ${budgetTotal} responses"></span>
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

// Map a count/total ratio to a colour-tone class for stat values
// - empty dataset → no class (avoid misleading red on zero responses)
// - ≥ 75% good (Copper green)
// - 50–74% warn (Sodium yellow)
// - < 50% bad  (Flame red)
function scoreColorClass(n, total) {
  if (!total) return '';
  const p = (n / total) * 100;
  if (p >= 75) return 'is-good';
  if (p >= 50) return 'is-warn';
  return 'is-bad';
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

// ──────────────────────────────────────────────────────────────
// Event delegation — Edit / Cancel / Save / Delete on response cards
// ──────────────────────────────────────────────────────────────
responsesEl.addEventListener('click', async (e) => {
  const target = e.target.closest('button, a');
  if (!target) return;

  // Delete (X) → open confirmation modal
  const deleteId = target.dataset.deleteId;
  if (deleteId) {
    e.preventDefault();
    openDeleteConfirm(deleteId);
    return;
  }

  // Edit → re-render this row in edit mode
  const editId = target.dataset.editId;
  if (editId) {
    e.preventDefault();
    editingIds.add(editId);
    rerenderRow(editId);
    return;
  }

  // Cancel → re-render this row in view mode
  const cancelId = target.dataset.cancelId;
  if (cancelId) {
    e.preventDefault();
    editingIds.delete(cancelId);
    rerenderRow(cancelId);
    return;
  }
});

// Save → submit PATCH
responsesEl.addEventListener('submit', async (e) => {
  const form = e.target.closest('form.r-edit-form');
  if (!form) return;
  e.preventDefault();
  const id = form.dataset.editFormId;
  if (!id) return;

  const saveBtn = form.querySelector('.r-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const formData = new FormData(form);
  const updates = {};
  formData.forEach((v, k) => { updates[k] = (v || '').toString(); });

  try {
    const username = localStorage.getItem(USER_KEY) || '';
    const password = localStorage.getItem(PASS_KEY) || '';
    const auth = authHeaderValue(username, password);
    const res = await fetch(`/api/responses?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: auth } : {}),
      },
      body: JSON.stringify(updates),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    // Update the local copy
    const idx = allResponses.findIndex(r => r.id === id);
    if (idx >= 0) {
      allResponses[idx] = {
        ...allResponses[idx],
        ...data,
        submittedAt: data.submitted_at || allResponses[idx].submittedAt,
      };
    }
    editingIds.delete(id);
    applyFilters();
  } catch (err) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
    alert('Couldn\'t save changes: ' + err.message);
  }
});

function rerenderRow(id) {
  const r = allResponses.find(x => x.id === id);
  if (!r) return;
  const row = responsesEl.querySelector(`details.response[data-id="${CSS.escape(id)}"]`);
  if (!row) return;
  row.outerHTML = renderResponse(r);
  // Re-open the new details element since we just lost the open state
  const fresh = responsesEl.querySelector(`details.response[data-id="${CSS.escape(id)}"]`);
  if (fresh) fresh.open = true;
}

// ──────────────────────────────────────────────────────────────
// Delete confirmation modal
// ──────────────────────────────────────────────────────────────
function openDeleteConfirm(id) {
  pendingDeleteId = id;
  const r = allResponses.find(x => x.id === id);
  if (confirmProject) confirmProject.textContent = r?.q1_project_name || 'this project';
  confirmOverlay.hidden = false;
  confirmOverlay.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => confirmOverlay.classList.add('is-shown'));
}
function closeDeleteConfirm() {
  pendingDeleteId = null;
  confirmOverlay.classList.remove('is-shown');
  setTimeout(() => {
    confirmOverlay.hidden = true;
    confirmOverlay.setAttribute('aria-hidden', 'true');
  }, 300);
}
confirmCancel?.addEventListener('click', closeDeleteConfirm);
confirmOverlay?.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) closeDeleteConfirm();   // click-outside dismiss
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && confirmOverlay && !confirmOverlay.hidden) closeDeleteConfirm();
});

confirmDelete?.addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  confirmDelete.disabled = true;
  confirmDelete.textContent = 'Deleting…';

  try {
    const username = localStorage.getItem(USER_KEY) || '';
    const password = localStorage.getItem(PASS_KEY) || '';
    const auth = authHeaderValue(username, password);
    const res = await fetch(`/api/responses?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: auth ? { Authorization: auth } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    allResponses = allResponses.filter(r => r.id !== id);
    editingIds.delete(id);
    applyFilters();
    closeDeleteConfirm();
  } catch (err) {
    alert('Couldn\'t delete: ' + err.message);
  } finally {
    confirmDelete.disabled = false;
    confirmDelete.textContent = 'Delete';
  }
});

// ──────────────────────────────────────────────────────────────
// Admin sign-in overlay
// ──────────────────────────────────────────────────────────────
const authOverlay   = document.getElementById('auth-overlay');
const authForm      = document.getElementById('auth-form');
const authUserInput = document.getElementById('auth-user-input');
const authInput     = document.getElementById('auth-input');
const authError     = document.getElementById('auth-error');
const authBtn       = document.getElementById('auth-btn');

function showAuth(errMsg) {
  if (!authOverlay) return;
  authOverlay.hidden = false;
  authOverlay.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => authOverlay.classList.add('is-shown'));
  if (errMsg) showAuthError(errMsg);
  // focus username first; if pre-filled, skip to password
  setTimeout(() => {
    if (authUserInput && !authUserInput.value) authUserInput.focus();
    else authInput?.focus();
  }, 250);
}
function hideAuth() {
  if (!authOverlay) return;
  authOverlay.classList.remove('is-shown');
  setTimeout(() => {
    authOverlay.hidden = true;
    authOverlay.setAttribute('aria-hidden', 'true');
  }, 350);
}
function showAuthError(msg) {
  if (!authError) return;
  authError.textContent = msg;
  authError.hidden = false;
}
function clearAuthError() {
  if (!authError) return;
  authError.hidden = true;
  authError.textContent = '';
}

authInput?.addEventListener('input', clearAuthError);
authUserInput?.addEventListener('input', clearAuthError);

function setBtnLabel(text) {
  const label = authBtn?.querySelector('span:first-child');
  if (label) label.textContent = text;
}

authForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = (authUserInput?.value || '').trim();
  const password = (authInput?.value || '').trim();
  if (!password) return;

  authBtn.disabled = true;
  setBtnLabel('Signing in…');

  const result = await tryFetch(username, password);

  if (result.ok) {
    localStorage.setItem(USER_KEY, username);
    localStorage.setItem(PASS_KEY, password);
    hideAuth();
    bootDashboard(result.data);
    return;
  }
  if (result.status === 401) showAuthError('Invalid username or password.');
  else if (result.networkError) showAuthError("Couldn't reach the server. Are you offline?");
  else showAuthError(result.error || 'Sign-in failed.');

  authBtn.disabled = false;
  setBtnLabel('Sign in');
});

// ──────────────────────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────────────────────
function bootDashboard(data) {
  // Normalise field names — Supabase returns `submitted_at`, mock uses `submittedAt`
  allResponses = data.map(r => ({
    ...r,
    submittedAt: r.submitted_at || r.submittedAt,
  }));
  applyFilters();
}

(async () => {
  const result = await loadResponses();
  window.__dashMode = result.mode;

  if (result.mode === 'needs-auth') {
    // Don't render anything underneath — auth overlay covers the full viewport
    showAuth();
    return;
  }

  bootDashboard(result.data);
})();
