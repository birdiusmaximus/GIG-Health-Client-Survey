// ──────────────────────────────────────────────────────────────
// Survey nav + state
// 3D scene is parked; this drives scroll navigation, per-scene
// validation, and the Continue / Submit button.
// ──────────────────────────────────────────────────────────────

import { safeStorage, showToast } from './util.js?v=1';

const SESSION_ANSWERS_KEY = 'gig_survey_draft';

const scenes        = Array.from(document.querySelectorAll('.scene'));
const numeralEl     = document.getElementById('numeral');   // optional — removed by the design refresh, kept null-safe
const dotsEls       = Array.from(document.querySelectorAll('#dots .dot'));
const continueBtn   = document.getElementById('continue');
const continueLabel = document.getElementById('continue-label');
const sceneVideos   = Array.from(document.querySelectorAll('.scene-video'));

// ──────────────────────────────────────────────────────────────
// Double-buffer crossfade — masks the browser's WebM loop-seam flash.
// Two <video> elements per scene play the same clip. The "primary"
// loops normally. About a second before its loop seam, we restart the
// "buffer" from frame 0 and fade it in on top; once it's covering,
// we fade the primary out. The visible seam moment is hidden under a
// fully-opaque buffer, then roles swap and we wait for the next seam.
// ──────────────────────────────────────────────────────────────
const CROSSFADE_MS = 250;   // fade duration (matches CSS transition)
const SEAM_LEAD    = 1.0;   // start the crossfade this many seconds before the seam

const pairs = {};   // sceneNumber -> { primary, buffer, transitioning }
sceneVideos.forEach(v => {
  const n = parseInt(v.dataset.scene, 10);
  (pairs[n] = pairs[n] || { videos: [] }).videos.push(v);
});

Object.entries(pairs).forEach(([n, p]) => {
  const [a, b] = p.videos;
  if (!a) return;
  // Single-video scenes degrade gracefully — just loop with no masking
  if (!b) {
    a.loop = true;
    a.classList.add('is-shown');
    // NB: don't call play() at init — scene 1's <video autoplay> attribute
    // handles that for itself; other scenes are off-screen and should not
    // be downloading their WebM until the user actually scrolls to them.
    return;
  }
  a.loop = true;
  b.loop = true;
  a.classList.add('is-shown');
  // Hold the buffer paused at frame 0 — restarts fresh on every crossfade
  const holdBufferAtZero = () => {
    try { b.pause(); } catch (e) {}
    try { b.currentTime = 0; } catch (e) {}
  };
  if (b.readyState >= 1) holdBufferAtZero();
  else b.addEventListener('loadedmetadata', holdBufferAtZero, { once: true });
  b.addEventListener('play', () => {
    if (!b.classList.contains('is-shown')) holdBufferAtZero();
  });
  p.primary       = a;
  p.buffer        = b;
  p.transitioning = false;
});

// Only wake the crossfade RAF when the current scene actually has
// a video pair to mask. Scenes without a video (2-10 right now) skip
// the renderer entirely. The loop self-rearms via crossfadeRafId.
let crossfadeRafId = 0;
function tickCrossfade() {
  crossfadeRafId = 0;
  const p = pairs[state ? state.current : 1];
  if (!p || !p.buffer || !p.primary || !p.primary.duration) return;
  if (!p.transitioning) {
    const triggerAt = Math.max(0, p.primary.duration - SEAM_LEAD);
    if (p.primary.currentTime >= triggerAt) {
      p.transitioning = true;
      try { p.buffer.currentTime = 0; } catch (e) {}
      p.buffer.play().catch(() => {});
      p.buffer.classList.add('is-shown');
      setTimeout(() => {
        p.primary.classList.remove('is-shown');
        const oldPrimary = p.primary;
        [p.primary, p.buffer] = [p.buffer, p.primary];
        setTimeout(() => {
          try { oldPrimary.pause(); } catch (e) {}
          try { oldPrimary.currentTime = 0; } catch (e) {}
          p.transitioning = false;
        }, CROSSFADE_MS);
      }, CROSSFADE_MS);
    }
  }
  crossfadeRafId = requestAnimationFrame(tickCrossfade);
}
function ensureCrossfadeTicking() {
  if (!crossfadeRafId) crossfadeRafId = requestAnimationFrame(tickCrossfade);
}

const TOTAL = scenes.length;

const state = {
  current: 1,
  answers: {},
  submitted: false,
};

// ──────────────────────────────────────────────────────────────
// Scene tracking via IntersectionObserver
// ──────────────────────────────────────────────────────────────
const obs = new IntersectionObserver((entries) => {
  // Take the entry with the highest intersectionRatio that's currently visible
  let best = null;
  for (const e of entries) {
    if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) {
      best = e;
    }
  }
  if (best) {
    const n = parseInt(best.target.dataset.scene, 10);
    if (!Number.isNaN(n)) setCurrentScene(n);
  }
}, { threshold: [0.5, 0.75] });

scenes.forEach(s => obs.observe(s));

function setCurrentScene(n) {
  if (n === state.current) {
    updateContinueButton();
    return;
  }
  state.current = n;
  wheelAccum = 0;
  if (numeralEl) numeralEl.textContent = String(n).padStart(2, '0');
  dotsEls.forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === n);
    dot.classList.toggle('done',   i + 1 <  n);
  });
  // Mark the active scene's videos visible. Within each pair, only
  // the one currently marked .is-shown is resumed — its buffer stays
  // paused at frame 0 until the next crossfade tick triggers it.
  let anyActive = false;
  sceneVideos.forEach(v => {
    const matches = parseInt(v.dataset.scene, 10) === n;
    v.classList.toggle('is-active', matches);
    if (matches) {
      anyActive = true;
      if (v.classList.contains('is-shown')) {
        v.play().catch(() => {});
      } else {
        // Buffer for the now-active scene — bump preload from
        // 'metadata' to 'auto' so it's downloading in the background
        // and ready to fade in when the seam arrives.
        if (v.preload !== 'auto') v.preload = 'auto';
      }
    } else {
      try { v.pause(); } catch (e) {}
    }
  });
  // body class lets the dark overlay fade in/out with the video
  document.body.classList.toggle('has-video', anyActive);
  // Wake the crossfade tick only if the new scene actually has a pair
  if (pairs[n] && pairs[n].buffer) ensureCrossfadeTicking();
  // Look-ahead lazy load: scenes 4-10 ship with preload="none" so
  // first paint isn't competing with 7 videos the client may never
  // reach. As soon as scene N becomes active, bump the primary
  // videos for scenes N+1..N+3 to "auto" so they're downloading
  // in the background and ready by the time the user scrolls in.
  preloadUpcoming(n, 3);
  updateContinueButton();
}

// Promote both videos for each of the next `count` scenes from
// preload="none" → "auto" (primary) and "metadata" (buffer). load()
// is required because flipping the attribute alone doesn't re-arm
// the network state once the browser has settled on "none".
// Idempotent — re-running it for an already-promoted scene is a no-op.
function preloadUpcoming(fromScene, count) {
  for (let offset = 1; offset <= count; offset++) {
    const target = fromScene + offset;
    if (target > TOTAL) break;
    sceneVideos.forEach(v => {
      if (parseInt(v.dataset.scene, 10) !== target) return;
      if (v.dataset.role === 'a') {
        if (v.preload === 'auto') return;
        v.preload = 'auto';
        try { v.load(); } catch (e) {}
      } else if (v.dataset.role === 'b') {
        if (v.preload === 'auto' || v.preload === 'metadata') return;
        v.preload = 'metadata';
        try { v.load(); } catch (e) {}
      }
    });
  }
}

// Single source of truth for "go to scene N" — used by wheel,
// keyboard, dot clicks, and Continue button.
function goToScene(n) {
  const target = Math.max(1, Math.min(TOTAL, n));
  if (target === state.current) return;
  scenes[target - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ──────────────────────────────────────────────────────────────
// Validation per scene
// ──────────────────────────────────────────────────────────────
function isSceneValid(n) {
  const scene = scenes[n - 1];
  const required = scene.dataset.required === 'true';
  if (!required) return true;

  // Checkbox grids — at least one tick = valid
  const checkboxes = scene.querySelectorAll('input[type="checkbox"]');
  if (checkboxes.length) return !!scene.querySelector('input[type="checkbox"]:checked');

  const text = scene.querySelector('input[type="text"], textarea');
  if (text) return text.value.trim().length > 0;

  const radios = scene.querySelectorAll('input[type="radio"]');
  if (radios.length) {
    const name = radios[0].name;
    return !!scene.querySelector(`input[name="${name}"]:checked`);
  }
  return true;
}

function collectAnswer(n) {
  const scene = scenes[n - 1];
  const key   = scene.dataset.key || `q${n}`;

  // Multi-select (checkbox) scenes — serialized as a JSON array of
  // option values. The 'other' option, if checked AND accompanied by
  // free text, is stored as `other:<text>` so we don't need a second
  // DB column. Checkbox check has to run BEFORE the text-input branch
  // below, otherwise the empty 'other' input would be grabbed first.
  const checkboxes = scene.querySelectorAll('input[type="checkbox"]');
  if (checkboxes.length) {
    const selected = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => {
        if (cb.value === 'other') {
          const t = scene.querySelector('[data-other-text]')?.value?.trim() || '';
          return t ? `other:${t}` : 'other';
        }
        return cb.value;
      });
    if (selected.length) state.answers[key] = JSON.stringify(selected);
    else delete state.answers[key];
    return;
  }

  const text = scene.querySelector('input[type="text"], textarea');
  if (text) {
    const v = text.value.trim();
    if (v) state.answers[key] = v;
    return;
  }
  const checked = scene.querySelector('input[type="radio"]:checked');
  if (checked) state.answers[key] = checked.value;
}

function collectAll() {
  for (let i = 1; i <= TOTAL; i++) collectAnswer(i);
}

// First required scene the user hasn't answered yet, or null if none.
// Used by the Continue/Submit click and by submit-error mapping to
// take the user back to whatever still needs filling in.
function firstInvalidScene() {
  for (let i = 1; i <= TOTAL; i++) {
    const scene = scenes[i - 1];
    if (scene.dataset.required === 'true' && !isSceneValid(i)) return i;
  }
  return null;
}

// Friendly label for a scene — pulls the kicker word ("Experience",
// "Permission" etc.) so toasts can address it by name not just number.
function sceneLabel(n) {
  const scene = scenes[n - 1];
  return scene?.querySelector('.kicker-label')?.textContent?.trim() || `Question ${n}`;
}

// data-key → scene number (Q9 and Q10 are intentionally swapped on
// screen vs. their Supabase column names, so we have to look up by
// attribute rather than parsing the digits out of the key).
function sceneNumberForKey(key) {
  for (let i = 1; i <= TOTAL; i++) {
    if (scenes[i - 1].dataset.key === key) return i;
  }
  return null;
}

// Scroll the user to a still-needed scene and explain what's wrong.
function nagAboutScene(n, customMsg) {
  goToScene(n);
  const msg = customMsg
    || `Question ${n} (${sceneLabel(n)}) needs an answer before we can send this.`;
  showToast(msg, { tone: 'info', duration: 7500 });
}

// ──────────────────────────────────────────────────────────────
// Continue / Submit button
// ──────────────────────────────────────────────────────────────
function updateContinueButton() {
  const isLast = state.current === TOTAL;
  continueBtn.disabled = !isSceneValid(state.current);
  continueLabel.textContent = isLast ? 'Submit' : 'Continue';
  continueBtn.classList.toggle('is-submit', isLast);
}

continueBtn.addEventListener('click', async () => {
  if (continueBtn.disabled) return;
  // Disable synchronously to prevent a fast double-click from firing
  // submitSurvey twice (was a real race).
  continueBtn.disabled = true;
  collectAnswer(state.current);
  persistDraft();

  if (state.current >= TOTAL) {
    // Pre-flight: make sure every required scene has an answer before
    // we hit the API. Without this, a user who jumps via the progress
    // dots could land on Q10, fill it, and try to submit with Q1-Q8
    // empty — the API would reject but the toast would be cryptic.
    collectAll();
    const missing = firstInvalidScene();
    if (missing !== null) {
      continueBtn.disabled = false;
      nagAboutScene(missing);
      return;
    }
    await submitSurvey();
    return;
  }
  goToScene(state.current + 1);
  // Re-evaluate validity once we're on the next scene; the IntersectionObserver
  // will call updateContinueButton when the scroll lands.
});

// re-validate + persist whenever any input changes
scenes.forEach(scene => {
  scene.querySelectorAll('input, textarea').forEach(inp => {
    inp.addEventListener('input',  () => { updateContinueButton(); collectAnswer(state.current); persistDraft(); });
    inp.addEventListener('change', () => { updateContinueButton(); collectAnswer(state.current); persistDraft(); });
  });
  // Enter on a single-line text input = advance
  scene.querySelectorAll('input[type="text"]').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!continueBtn.disabled) continueBtn.click();
      }
    });
  });
});

// "Other" reveal: when the checkbox marked [data-toggles-other] is
// checked, show its scene's [data-other-wrap] text input and put
// focus on it. Hiding it again on uncheck doesn't clear the text —
// that way a user who unchecks by accident doesn't lose their entry.
document.querySelectorAll('[data-toggles-other]').forEach(cb => {
  cb.addEventListener('change', () => {
    const scene = cb.closest('.scene');
    const wrap  = scene?.querySelector('[data-other-wrap]');
    if (!wrap) return;
    wrap.hidden = !cb.checked;
    if (cb.checked) {
      const input = wrap.querySelector('[data-other-text]');
      if (input) setTimeout(() => input.focus(), 50);
    }
  });
});

// Conditional follow-up hint: a radio marked [data-reveals-hint]
// shows its scene's [data-reveal-hint] message when chosen; any
// other radio in the same group hides it again. Used on Q10 so
// that "Yes" reveals the warm follow-up sentence but "No" does not.
document.querySelectorAll('[data-reveals-hint]').forEach(radio => {
  const scene = radio.closest('.scene');
  const hint  = scene?.querySelector('[data-reveal-hint]');
  if (!hint || !radio.name) return;
  scene.querySelectorAll(`input[name="${radio.name}"]`).forEach(sibling => {
    sibling.addEventListener('change', () => {
      hint.hidden = !radio.checked;
    });
  });
});

// ──────────────────────────────────────────────────────────────
// Session draft — survive accidental refresh / back-button
// ──────────────────────────────────────────────────────────────
function persistDraft() {
  try {
    safeStorage.setSession(SESSION_ANSWERS_KEY, JSON.stringify(state.answers));
  } catch (e) { /* private mode etc. — best effort */ }
}
function loadDraft() {
  const raw = safeStorage.getSession(SESSION_ANSWERS_KEY);
  if (!raw) return;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return; }
  if (!parsed || typeof parsed !== 'object') return;
  // Rehydrate matching fields
  scenes.forEach((scene, idx) => {
    const key = scene.dataset.key || `q${idx + 1}`;
    const val = parsed[key];
    if (val == null) return;

    // Checkbox group — values stored as a JSON array; the 'other'
    // option may carry inline text as `other:<text>`. Restore each
    // tick and reveal the 'other' input if needed.
    const checkboxes = scene.querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length) {
      let arr;
      try { arr = JSON.parse(val); if (!Array.isArray(arr)) arr = [String(val)]; }
      catch  { arr = [String(val)]; }
      arr.forEach(item => {
        const s = String(item);
        if (s === 'other' || s.startsWith('other:')) {
          const otherCb = scene.querySelector('input[type="checkbox"][value="other"]');
          if (otherCb) otherCb.checked = true;
          const wrap = scene.querySelector('[data-other-wrap]');
          if (wrap) wrap.hidden = false;
          if (s.startsWith('other:')) {
            const otherInput = scene.querySelector('[data-other-text]');
            if (otherInput) otherInput.value = s.slice(6);
          }
        } else {
          const cb = scene.querySelector(`input[type="checkbox"][value="${CSS.escape(s)}"]`);
          if (cb) cb.checked = true;
        }
      });
      return;
    }

    const text = scene.querySelector('input[type="text"], textarea');
    if (text) { text.value = val; return; }
    const radio = scene.querySelector(`input[type="radio"][value="${CSS.escape(String(val))}"]`);
    if (radio) radio.checked = true;
  });
  state.answers = { ...parsed };
}
function clearDraft() { safeStorage.removeSession(SESSION_ANSWERS_KEY); }

// ──────────────────────────────────────────────────────────────
// Progress dot click → jump to scene
// ──────────────────────────────────────────────────────────────
dotsEls.forEach((dot) => {
  dot.addEventListener('click', () => {
    const n = parseInt(dot.dataset.scene, 10);
    if (!Number.isNaN(n)) goToScene(n);
  });
});

// ──────────────────────────────────────────────────────────────
// Submit
// ──────────────────────────────────────────────────────────────
async function submitSurvey() {
  if (state.submitted) return;
  collectAll();
  // NB: never log state.answers here — q9 carries referral name + email (PII).

  continueBtn.disabled = true;
  continueLabel.textContent = 'Sending…';

  try {
    const res = await fetch('/api/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(state.answers),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      state.submitted = true;
      continueLabel.textContent = 'Thanks ✓';
      clearDraft();
      showSubmitOverlay(state.answers.q1_project_name);
      return;
    }

    // Failure path — restore the button and translate the failure
    // into something the user can act on.
    continueLabel.textContent = 'Submit';
    continueBtn.disabled = false;
    const errMsg = (data && data.error) || '';

    // 1) Per-field rejection — API errors usually mention the column
    //    name (e.g. "missing required field: q5_experience"). Map that
    //    back to its on-screen scene and send the user there.
    const keyMatch = /(q\d+_[a-z_]+)/i.exec(errMsg);
    if (keyMatch) {
      const sceneNum = sceneNumberForKey(keyMatch[1]);
      if (sceneNum) {
        nagAboutScene(sceneNum);
        return;
      }
    }

    // 2) Status-coded fallbacks — pick a message the user can actually do something with
    if (res.status === 429) {
      showToast("That's too many submissions in a short time. Please wait a moment and try again.");
    } else if (res.status === 413) {
      showToast("One of your answers is very long. Please shorten it and try again.");
    } else if (res.status === 501) {
      showToast("Submissions aren't wired up on this dev server — open the live site to submit for real.", { duration: 8000 });
    } else if (res.status >= 500) {
      showToast("Something went wrong on our end. Please try again in a moment.");
    } else if (errMsg) {
      showToast(errMsg);
    } else {
      showToast(`Submission failed (HTTP ${res.status}). Please try again.`);
    }
  } catch (err) {
    console.error('[submit] network error', err);
    continueLabel.textContent = 'Submit';
    continueBtn.disabled = false;
    showToast("Couldn't reach the server. Check your connection and try again.");
  }
}

// ──────────────────────────────────────────────────────────────
// Branded submission success overlay
// ──────────────────────────────────────────────────────────────
const submitOverlay = document.getElementById('submit-overlay');
const submitClose   = document.getElementById('submit-close');
const submitProject = document.getElementById('submit-project');

function showSubmitOverlay(projectName) {
  if (!submitOverlay) return;
  if (submitProject && projectName) submitProject.textContent = projectName;
  submitOverlay.hidden = false;
  submitOverlay.setAttribute('aria-hidden', 'false');
  // next frame so the fade transition fires
  requestAnimationFrame(() => submitOverlay.classList.add('is-shown'));
}
function hideSubmitOverlay() {
  if (!submitOverlay) return;
  submitOverlay.classList.remove('is-shown');
  setTimeout(() => {
    submitOverlay.hidden = true;
    submitOverlay.setAttribute('aria-hidden', 'true');
  }, 500);
}
// The submit-close button is now an <a href="/showcase"> — the browser
// handles navigation natively, no JS handler needed.

// ──────────────────────────────────────────────────────────────
// Wheel handler — small flicks accumulate, then snap decisively
// to the next scene. Works on top of native scroll-snap.
//
// Safari sends much larger deltaY per wheel event than Chrome, so
// the trigger threshold needs to be high enough that a tiny twitch
// doesn't immediately jump scenes. The cooldown only blocks
// SAME-direction repeat navs — reversing direction is allowed
// instantly so you can bounce back up without a wait.
// ──────────────────────────────────────────────────────────────
const WHEEL_TRIGGER  = 55;     // px of accumulated deltaY before snapping
const WHEEL_COOLDOWN = 420;    // ms — minimum gap between SAME-direction navs
const WHEEL_RESET    = 180;    // ms — accumulator decays if you stop scrolling

let wheelAccum     = 0;
let wheelResetT    = 0;
let lastWheelNavAt = 0;
let lastNavDir     = 0;     // +1 = down, -1 = up

window.addEventListener('wheel', (e) => {
  const tgt = e.target;
  if (tgt && typeof tgt.closest === 'function'
      && tgt.closest('textarea, input, select')) return;

  const now = performance.now();
  const incomingDir = e.deltaY > 0 ? 1 : -1;
  // Cooldown only applies to same-direction repeats. Reversing
  // direction bypasses it so users can undo a jump immediately.
  if (incomingDir === lastNavDir && now - lastWheelNavAt < WHEEL_COOLDOWN) {
    e.preventDefault();
    return;
  }

  wheelAccum += e.deltaY;
  clearTimeout(wheelResetT);
  wheelResetT = setTimeout(() => { wheelAccum = 0; }, WHEEL_RESET);

  if (Math.abs(wheelAccum) < WHEEL_TRIGGER) return;

  const dir = wheelAccum > 0 ? 1 : -1;
  wheelAccum = 0;
  e.preventDefault();
  lastWheelNavAt = now;
  lastNavDir = dir;
  navToScene(state.current + dir);
}, { passive: false });

function navToScene(targetSceneNum) {
  const target = Math.max(1, Math.min(TOTAL, targetSceneNum));
  if (target === state.current) return;
  wheelAccum = 0;
  scenes[target - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// keyboard nav as a bonus — ↑/↓, PageUp/Down, Home/End
window.addEventListener('keydown', (e) => {
  const tgt = e.target;
  // Don't steal typing inside form fields
  if (tgt instanceof Element && tgt.matches('input, textarea, select')) return;
  let target = null;
  if (e.key === 'ArrowDown' || e.key === 'PageDown') target = state.current + 1;
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') target = state.current - 1;
  else if (e.key === 'Home') target = 1;
  else if (e.key === 'End')  target = TOTAL;
  if (target === null) return;
  e.preventDefault();
  goToScene(target);
});

// ──────────────────────────────────────────────────────────────
// ?project=… prefill (set by the admin "New survey link" tool).
// If the URL carries a project name, treat the visit as a fresh
// session for that project: clear any leftover draft from a previous
// survey (so the admin's pre-fill is honoured, not overwritten by an
// old in-progress answer) and seed Q1's input.
// ──────────────────────────────────────────────────────────────
function applyProjectPrefill() {
  let preset = '';
  try {
    preset = (new URLSearchParams(location.search).get('project') || '').trim();
  } catch { return; }
  if (!preset) return;
  // Wipe any stale draft so the URL parameter wins.
  clearDraft();
  state.answers = {};
  const q1 = scenes[0];
  if (!q1) return;
  const input = q1.querySelector('input[type="text"], textarea');
  if (!input) return;
  // Cap at the same 500-char ceiling the server applies to q1_project_name.
  input.value = preset.slice(0, 500);
  state.answers[q1.dataset.key || 'q1_project_name'] = input.value;
  persistDraft();
}

// ──────────────────────────────────────────────────────────────
// Warm the showcase page's data while the user is still in the
// survey. The thank-you screen links to /showcase.html, which
// otherwise has to wait on a fresh /api/public round-trip after
// navigation. Firing it now (a) hits Vercel's edge cache while
// it's warm and (b) leaves the JSON in sessionStorage so the
// showcase can paint instantly. Best-effort; failures are silent.
// ──────────────────────────────────────────────────────────────
const SHOWCASE_CACHE_KEY = 'gig_showcase_public_v1';
(function warmShowcase() {
  // Skip on slow / metered connections — don't burn the client's data.
  const conn = navigator.connection;
  if (conn && (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || ''))) return;
  // Schedule at idle so it never competes with the survey's own assets.
  const fire = () => {
    const url = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'https://gig-health-client-survey.vercel.app/api/public'
      : '/api/public';
    fetch(url, { cache: 'no-cache', credentials: 'omit' })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json) return;
        try {
          sessionStorage.setItem(SHOWCASE_CACHE_KEY, JSON.stringify({
            data: json, ts: Date.now(),
          }));
        } catch {}
      })
      .catch(() => {});
  };
  if ('requestIdleCallback' in window) requestIdleCallback(fire, { timeout: 4000 });
  else setTimeout(fire, 1500);
})();

// ──────────────────────────────────────────────────────────────
// Initial state — restore any session draft, then prime the
// active scene's video.
// ──────────────────────────────────────────────────────────────
loadDraft();
applyProjectPrefill();   // URL param wins over a stale draft
updateContinueButton();
let anyInitialActive = false;
sceneVideos.forEach(v => {
  const matches = parseInt(v.dataset.scene, 10) === state.current;
  v.classList.toggle('is-active', matches);
  if (matches) anyInitialActive = true;
});
document.body.classList.toggle('has-video', anyInitialActive);
// Kick off the crossfade tick now if we landed on a video scene
if (pairs[state.current] && pairs[state.current].buffer) ensureCrossfadeTicking();
// Look-ahead lazy load fires inside setCurrentScene(), but that
// isn't called on first load (we're already on state.current). Run
// it now so scenes adjacent to the landing scene start downloading.
preloadUpcoming(state.current, 3);
