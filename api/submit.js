// POST /api/submit — receives a survey response and writes it to Supabase.
//
// Requires three Vercel env vars (see SUPABASE_SETUP.md):
//   SUPABASE_URL                 — https://your-project.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    — Supabase → Settings → API → service_role secret
//   (DASHBOARD_TOKEN is only needed for /api/responses, not this file)

import { createClient } from '@supabase/supabase-js';

// Strip trailing slashes and accidental whitespace — supabase-js
// builds URLs by appending paths to SUPABASE_URL, so a trailing slash
// produces a double-slash that PostgREST rejects as "invalid path".
const cleanUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const cleanKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabase = (cleanUrl && cleanKey)
  ? createClient(cleanUrl, cleanKey, { auth: { persistSession: false } })
  : null;

// Whitelist of allowed values per radio question — guards against
// arbitrary text getting written to columns we treat as enums later
const ALLOWED = {
  q2_quality:    ['excellent', 'high', 'fair', 'not_everything', 'disappointing'],
  q3_creativity: ['groundbreaking', 'really_creative', 'quite_creative', 'average', 'lacking'],
  q4_budget:     ['higher', 'on_par', 'cheaper', 'na'],
  q6_permission: ['yes', 'no'],
  q8_marketing:  ['yes_as_is', 'yes_adapted', 'possibly', 'no'],
};

const REQUIRED_TEXT_FIELDS = ['q1_project_name', 'q5_experience', 'q7_improvement'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body) return res.status(400).json({ error: 'missing or invalid body' });

  // Validate text fields
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (!body[field] || typeof body[field] !== 'string' || !body[field].trim()) {
      return res.status(400).json({ error: `missing required field: ${field}` });
    }
  }
  // Validate radio fields
  for (const [field, allowed] of Object.entries(ALLOWED)) {
    if (!allowed.includes(body[field])) {
      return res.status(400).json({ error: `invalid value for ${field}` });
    }
  }

  const record = {
    q1_project_name: body.q1_project_name.trim().slice(0, 500),
    q2_quality:      body.q2_quality,
    q3_creativity:   body.q3_creativity,
    q4_budget:       body.q4_budget,
    q5_experience:   body.q5_experience.trim().slice(0, 5000),
    q6_permission:   body.q6_permission,
    q7_improvement:  body.q7_improvement.trim().slice(0, 5000),
    q8_marketing:    body.q8_marketing,
    q9_referral:     (body.q9_referral  || '').trim().slice(0, 5000) || null,
    q10_trends:      (body.q10_trends   || '').trim().slice(0, 5000) || null,
  };

  // No Supabase configured → log + ack so local/dev still works
  if (!supabase) {
    console.log('[submit] (no Supabase configured)', JSON.stringify(record));
    return res.status(200).json({ ok: true, persisted: false });
  }

  const { data, error } = await supabase
    .from('responses')
    .insert(record)
    .select()
    .single();

  if (error) {
    console.error('[submit] supabase insert error', error);
    return res.status(500).json({ error: 'failed to save response' });
  }

  console.log('[submit] saved response id:', data.id);

  // Fire-and-forget notification email — never blocks the response,
  // never fails the submission. Skipped if RESEND_API_KEY isn't set.
  sendNotification(data).catch(err => console.error('[submit] notify failed', err));

  return res.status(200).json({ ok: true, persisted: true, id: data.id });
}

// ──────────────────────────────────────────────────────────────
// Email notification (optional — requires Resend env vars)
// ──────────────────────────────────────────────────────────────
const QUALITY_LABEL = {
  excellent: 'Excellent', high: 'High standard', fair: 'Fair',
  not_everything: "Didn't fully land", disappointing: 'Disappointing',
};
const CREATIVITY_LABEL = {
  groundbreaking: 'Groundbreaking', really_creative: 'Really creative',
  quite_creative: 'Quite creative', average: 'Average', lacking: 'Lacking',
};
const BUDGET_LABEL = {
  higher: 'Higher than others', on_par: 'On par',
  cheaper: 'Cheaper than others', na: 'N/A — predetermined',
};
const MARKETING_LABEL = {
  yes_as_is: 'Yes, as is', yes_adapted: 'Yes, with adaptation',
  possibly: 'Possibly — check', no: 'No',
};

async function sendNotification(record) {
  const apiKey  = process.env.RESEND_API_KEY;
  const toRaw   = process.env.NOTIFY_EMAIL;
  const from    = process.env.NOTIFY_FROM || 'GIG Surveys <onboarding@resend.dev>';
  const siteUrl = process.env.SITE_URL || 'https://gig-health-client-survey.vercel.app';

  if (!apiKey || !toRaw) return;                      // not configured → skip
  const to = toRaw.split(',').map(s => s.trim()).filter(Boolean);

  const subject = `New survey response · ${record.q1_project_name}`;
  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0d1a2d;max-width:560px;line-height:1.5">
      <p style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#F45347;margin:0 0 8px">— New response</p>
      <h1 style="font-size:24px;margin:0 0 16px">${escape(record.q1_project_name)}</h1>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:24px">
        <tr><td style="padding:6px 0;color:#6b7a8c;width:140px">Quality</td><td style="padding:6px 0;font-weight:600">${QUALITY_LABEL[record.q2_quality] || record.q2_quality}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a8c">Creativity</td><td style="padding:6px 0;font-weight:600">${CREATIVITY_LABEL[record.q3_creativity] || record.q3_creativity}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a8c">Budget</td><td style="padding:6px 0;font-weight:600">${BUDGET_LABEL[record.q4_budget] || record.q4_budget}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a8c">Quotable?</td><td style="padding:6px 0;font-weight:600">${record.q6_permission === 'yes' ? 'Yes ✓' : 'No'}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a8c">Marketing use</td><td style="padding:6px 0;font-weight:600">${MARKETING_LABEL[record.q8_marketing] || record.q8_marketing}</td></tr>
      </table>
      <h3 style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#F45347;margin:0 0 6px">Experience working with GIG</h3>
      <p style="margin:0 0 18px;font-size:15px">${escape(record.q5_experience)}</p>
      <h3 style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#F45347;margin:0 0 6px">What we could do better</h3>
      <p style="margin:0 0 18px;font-size:15px">${escape(record.q7_improvement)}</p>
      ${record.q9_referral  ? `<h3 style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#F45347;margin:0 0 6px">Referral</h3><p style="margin:0 0 18px;font-size:15px">${escape(record.q9_referral)}</p>` : ''}
      ${record.q10_trends   ? `<h3 style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#F45347;margin:0 0 6px">Trends / challenges</h3><p style="margin:0 0 18px;font-size:15px">${escape(record.q10_trends)}</p>` : ''}
      <p style="margin:24px 0 0;font-size:13px"><a href="${siteUrl}/dashboard.html" style="color:#F45347;text-decoration:none;font-weight:600">Open in admin dashboard →</a></p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[submit] resend error', res.status, body);
  }
}

function escape(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
