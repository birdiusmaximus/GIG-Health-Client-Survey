// POST /api/submit — receives a survey response and writes it to Supabase.
//
// Requires three Vercel env vars (see SUPABASE_SETUP.md):
//   SUPABASE_URL                 — https://your-project.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    — Supabase → Settings → API → service_role secret
//   (DASHBOARD_TOKEN is only needed for /api/responses, not this file)

import { createClient } from '@supabase/supabase-js';

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )
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
  return res.status(200).json({ ok: true, persisted: true, id: data.id });
}
