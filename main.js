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
    a.play().catch(() => {});
    return;
  }
  a.loop = true;
  b.loop = true;
  a.classList.add('is-shown');
  a.play().catch(() => {});
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

function tickCrossfade() {
  const p = pairs[state ? state.current : 1];
  if (p && p.buffer && !p.transitioning && p.primary.duration) {
    const triggerAt = Math.max(0, p.primary.duration - SEAM_LEAD);
    if (p.primary.currentTime >= triggerAt) {
      p.transitioning = true;
      // Restart the buffer from the start and fade it in
      try { p.buffer.currentTime = 0; } catch (e) {}
      p.buffer.play().catch(() => {});
      p.buffer.classList.add('is-shown');
      // Once buffer is fully covering, fade the primary out
      setTimeout(() => {
        p.primary.classList.remove('is-shown');
        const oldPrimary = p.primary;
        [p.primary, p.buffer] = [p.buffer, p.primary];
        // After the fade-out completes, reset old primary so it's
        // ready to be the next buffer
        setTimeout(() => {
          try { oldPrimary.pause(); } catch (e) {}
          try { oldPrimary.currentTime = 0; } catch (e) {}
          p.transitioning = false;
        }, CROSSFADE_MS);
      }, CROSSFADE_MS);
    }
  }
  requestAnimationFrame(tickCrossfade);
}
requestAnimationFrame(tickCrossfade);

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
  numeralEl.textContent = String(n).padStart(2, '0');
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
      if (v.classList.contains('is-shown')) v.play().catch(() => {});
    } else {
      try { v.pause(); } catch (e) {}
    }
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
// Wheel handler — small flicks accumulate, then snap decisively
// to the next scene. Works on top of native scroll-snap.
// ──────────────────────────────────────────────────────────────
const WHEEL_TRIGGER  = 28;     // px of accumulated deltaY before snapping
const WHEEL_COOLDOWN = 650;    // ms — minimum gap between snaps
const WHEEL_RESET    = 140;    // ms — accumulator decays if you stop scrolling

let wheelAccum     = 0;
let wheelResetT    = 0;
let lastWheelNavAt = 0;

window.addEventListener('wheel', (e) => {
  const tgt = e.target;
  if (tgt && typeof tgt.closest === 'function'
      && tgt.closest('textarea, input, select')) return;

  const now = performance.now();
  if (now - lastWheelNavAt < WHEEL_COOLDOWN) {
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
// Initial state — show the video for whatever scene we land on
// ──────────────────────────────────────────────────────────────
updateContinueButton();
let anyInitialActive = false;
sceneVideos.forEach(v => {
  const matches = parseInt(v.dataset.scene, 10) === state.current;
  v.classList.toggle('is-active', matches);
  if (matches) anyInitialActive = true;
});
document.body.classList.toggle('has-video', anyInitialActive);
