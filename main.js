// ──────────────────────────────────────────────────────────────
// Survey nav + state
// 3D scene is parked; this drives scroll navigation, per-scene
// validation, and the Continue / Submit button.
// ──────────────────────────────────────────────────────────────

const scenes        = Array.from(document.querySelectorAll('.scene'));
const numeralEl     = document.getElementById('numeral');
const dotsEls       = Array.from(document.querySelectorAll('#dots .dot'));
const continueBtn   = document.getElementById('continue');
const continueLabel = document.getElementById('continue-label');
const sceneVideos   = Array.from(document.querySelectorAll('.scene-video'));

// ──────────────────────────────────────────────────────────────
// Scrub-on-scroll videos
// Each scene has at most one video. Videos do NOT loop or autoplay
// — playback is entirely driven by the user's mouse wheel. The
// wheel handler further down scrubs video.currentTime forward /
// backward proportional to deltaY, and when the playhead reaches
// the end (or start) any further scroll in the same direction
// navigates to the next (or previous) scene.
// ──────────────────────────────────────────────────────────────
// Load each video as a blob URL so it's fully seekable regardless of
// whether the server supports HTTP Range requests. Python's http.server
// doesn't (which breaks scrub-on-scroll in local dev), and even on
// Vercel this guarantees instant scrubbing the moment the file is in.
async function makeVideoSeekable(v) {
  const source = v.querySelector('source');
  if (!source) return;
  const url = source.getAttribute('src');
  if (!url) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    // Replace the <source> with a direct src to the blob URL
    source.remove();
    v.src = blobUrl;
    v.load();
  } catch (err) {
    console.warn('[scene-video] blob load failed, falling back to original URL', err);
  }
}

sceneVideos.forEach(v => {
  v.loop = false;
  v.autoplay = false;
  v.classList.add('is-shown');
  const initVideo = () => {
    try { v.pause(); } catch (e) {}
    try { v.currentTime = 0; } catch (e) {}
  };
  if (v.readyState >= 1) initVideo();
  else v.addEventListener('loadedmetadata', initVideo, { once: true });
  // Keep paused — autoplay was already off but some browsers may try once
  v.addEventListener('play', () => { try { v.pause(); } catch (e) {} });
  // Load as blob to guarantee seekability
  makeVideoSeekable(v);
});

function getCurrentSceneVideo() {
  return document.querySelector(`.scene-video[data-scene="${state && state.current}"]`);
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
  numeralEl.textContent = String(n).padStart(2, '0');
  dotsEls.forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === n);
    dot.classList.toggle('done',   i + 1 <  n);
  });
  // Pause + reset every scene's video. The active scene's video
  // becomes visible (is-active) but stays paused at frame 0 — the
  // wheel scrub handler is the only thing that advances playback.
  let anyActive = false;
  sceneVideos.forEach(v => {
    const matches = parseInt(v.dataset.scene, 10) === n;
    v.classList.toggle('is-active', matches);
    try { v.pause(); } catch (e) {}
    try { v.currentTime = 0; } catch (e) {}
    if (matches) anyActive = true;
  });
  // body class lets the dark overlay fade in/out with the video
  document.body.classList.toggle('has-video', anyActive);
  updateContinueButton();
}

// ──────────────────────────────────────────────────────────────
// Validation per scene
// ──────────────────────────────────────────────────────────────
function isSceneValid(n) {
  const scene = scenes[n - 1];
  const required = scene.dataset.required === 'true';
  if (!required) return true;

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
  collectAnswer(state.current);

  if (state.current >= TOTAL) {
    await submitSurvey();
    return;
  }
  scenes[state.current].scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// re-validate whenever any input changes (radios, text, textareas)
scenes.forEach(scene => {
  scene.querySelectorAll('input, textarea').forEach(inp => {
    inp.addEventListener('input',  updateContinueButton);
    inp.addEventListener('change', updateContinueButton);
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

// ──────────────────────────────────────────────────────────────
// Progress dot click → jump to scene
// ──────────────────────────────────────────────────────────────
dotsEls.forEach((dot) => {
  dot.addEventListener('click', () => {
    const n = parseInt(dot.dataset.scene, 10);
    if (Number.isNaN(n)) return;
    scenes[n - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ──────────────────────────────────────────────────────────────
// Submit
// ──────────────────────────────────────────────────────────────
async function submitSurvey() {
  if (state.submitted) return;
  collectAll();
  console.log('[submit] payload:', state.answers);

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
      showSubmitOverlay(state.answers.q1_project_name);
    } else {
      continueLabel.textContent = 'Submit';
      continueBtn.disabled = false;
      alert('Submission failed: ' + (data.error || `HTTP ${res.status}`));
    }
  } catch (err) {
    console.error(err);
    continueLabel.textContent = 'Submit';
    continueBtn.disabled = false;
    alert(
      'Couldn\'t reach /api/submit.\n\n' +
      'On the static dev server this is expected (no serverless functions). ' +
      'On Vercel, check the function logs.'
    );
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
// Wheel handler — scrub the current scene's video, then advance
//
// If the current scene has a video, wheel deltaY scrubs the
// playhead forward/backward. When the playhead reaches the end and
// the user keeps scrolling down, we navigate to the next scene.
// At the start scrolling up, we navigate to the previous scene.
//
// If the current scene has no video, we fall back to accumulating
// deltaY and triggering a scene change once a threshold is crossed
// (same UX as before — works for the un-video'd scenes 2–10).
// ──────────────────────────────────────────────────────────────
const SCRUB_SECS_PER_PX  = 0.0028;  // wheel deltaY → seconds of video
const NO_VIDEO_THRESHOLD = 120;     // px of accumulated deltaY to flip scene
const NAV_COOLDOWN_MS    = 600;     // gap between scene changes (kills inertia spam)

let lastNavAt = 0;
let noVideoAccum = 0;
let noVideoAccumResetT = 0;

window.addEventListener('wheel', (e) => {
  // Don't hijack scroll inside form fields (textareas have their own
  // scrollbar; selects open native menus on wheel)
  const tgt = e.target;
  if (tgt && typeof tgt.closest === 'function'
      && tgt.closest('textarea, input, select')) return;

  const now = performance.now();
  if (now - lastNavAt < NAV_COOLDOWN_MS) {
    e.preventDefault();
    return;
  }

  const video = getCurrentSceneVideo();
  const dir = e.deltaY > 0 ? 1 : -1;

  if (video && video.duration && video.readyState >= 2) {
    // ── Scrub mode ────────────────────────────────────────────
    const end = Math.max(0, video.duration - 0.05);
    const newTime = video.currentTime + (e.deltaY * SCRUB_SECS_PER_PX);

    if (newTime >= end && dir > 0) {
      // Past the end while scrolling down → advance scene
      e.preventDefault();
      lastNavAt = now;
      navToScene(state.current + 1);
    } else if (newTime <= 0 && dir < 0) {
      // Before the start while scrolling up → previous scene
      e.preventDefault();
      lastNavAt = now;
      navToScene(state.current - 1);
    } else {
      e.preventDefault();
      try { video.pause(); } catch (err) {}
      video.currentTime = Math.max(0, Math.min(end, newTime));
    }
  } else {
    // ── No video on this scene → accumulator-based nav ────────
    noVideoAccum += e.deltaY;
    clearTimeout(noVideoAccumResetT);
    noVideoAccumResetT = setTimeout(() => { noVideoAccum = 0; }, 200);

    if (Math.abs(noVideoAccum) >= NO_VIDEO_THRESHOLD) {
      const moveDir = noVideoAccum > 0 ? 1 : -1;
      noVideoAccum = 0;
      e.preventDefault();
      lastNavAt = now;
      navToScene(state.current + moveDir);
    }
  }
}, { passive: false });

function navToScene(targetSceneNum) {
  const target = Math.max(1, Math.min(TOTAL, targetSceneNum));
  if (target === state.current) return;
  noVideoAccum = 0;
  scenes[target - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// keyboard nav as a bonus — ↑/↓, PageUp/Down, Home/End
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;   // don't steal typing
  let target = null;
  if (e.key === 'ArrowDown' || e.key === 'PageDown') target = state.current + 1;
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') target = state.current - 1;
  else if (e.key === 'Home') target = 1;
  else if (e.key === 'End')  target = TOTAL;
  if (target === null) return;
  target = Math.max(1, Math.min(TOTAL, target));
  if (target === state.current) return;
  e.preventDefault();
  scenes[target - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ──────────────────────────────────────────────────────────────
// Initial state — activate the video for whatever scene we land on
// ──────────────────────────────────────────────────────────────
updateContinueButton();
let anyInitialActive = false;
sceneVideos.forEach(v => {
  const matches = parseInt(v.dataset.scene, 10) === state.current;
  v.classList.toggle('is-active', matches);
  try { v.pause(); } catch (e) {}
  try { v.currentTime = 0; } catch (e) {}
  if (matches) anyInitialActive = true;
});
document.body.classList.toggle('has-video', anyInitialActive);
