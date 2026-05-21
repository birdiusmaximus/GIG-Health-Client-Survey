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
// Double-buffer crossfade — hides the loop seam.
// Two videos per scene play continuously. The buffer is offset by
// half the duration, so when one nears its seam the other is mid-
// loop. Just before the seam we fade the buffer IN (becomes opaque
// while the old one is still visible), wait until it's fully on
// screen, then fade the old one OUT. The seam moment is covered by
// the fully-visible buffer the entire time.
// ──────────────────────────────────────────────────────────────
// Fire the crossfade once the primary hits the 4.0s mark (the safe
// cut-point before the flash frames near the end of the 5.04s clip).
// The buffer (already mid-loop) fades up to full opacity over 500ms;
// the primary keeps playing underneath until the buffer is fully on
// screen, then fades out behind it.
const CROSSFADE_MS    = 100;
const SEAM_TRIGGER    = 1.04;

const pairs = {};                // sceneNumber -> { primary, buffer, transitioning }
sceneVideos.forEach(v => {
  const n = parseInt(v.dataset.scene, 10);
  (pairs[n] = pairs[n] || { videos: [] }).videos.push(v);
});

Object.entries(pairs).forEach(([n, p]) => {
  const [a, b] = p.videos;
  if (!a) return;
  // Single-video scenes degrade gracefully — no crossfade, just always shown
  if (!b) {
    a.loop = true;
    a.classList.add('is-shown');
    return;
  }
  a.loop = true;
  b.loop = true;
  a.classList.add('is-shown');     // primary visible + playing from the start
  // hold the buffer paused at frame 0 — it'll start fresh every fade-in
  const holdBufferAtZero = () => {
    b.pause();
    try { b.currentTime = 0; } catch (e) {}
  };
  if (b.readyState >= 1) holdBufferAtZero();
  else b.addEventListener('loadedmetadata', holdBufferAtZero, { once: true });
  // re-pause if the browser tries to auto-play it for any reason
  b.addEventListener('play', () => {
    if (!b.classList.contains('is-shown')) holdBufferAtZero();
  });
  p.primary       = a;
  p.buffer        = b;
  p.transitioning = false;
});

function tickCrossfade() {
  const p = pairs[state.current];
  if (p && p.buffer && !p.transitioning && p.primary.duration) {
    if (p.primary.currentTime >= 4.0) {
      p.transitioning = true;

      // Step 1 — restart the buffer from the very beginning + play it
      try { p.buffer.currentTime = 0; } catch (e) {}
      p.buffer.play().catch(() => {});
      // Step 2 — fade the buffer IN (CSS transition 500ms). Primary
      // keeps playing underneath at full opacity.
      p.buffer.classList.add('is-shown');

      // Step 3 — once the buffer is fully visible, fade the primary out
      setTimeout(() => {
        p.primary.classList.remove('is-shown');
        // Swap roles so future ticks watch the new active video
        const oldPrimary = p.primary;
        [p.primary, p.buffer] = [p.buffer, p.primary];
        // After the fade-out completes, pause + reset the old primary
        // so it's ready to start fresh from frame 0 next cycle
        setTimeout(() => {
          oldPrimary.pause();
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
  numeralEl.textContent = String(n).padStart(2, '0');
  dotsEls.forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === n);
    dot.classList.toggle('done',   i + 1 <  n);
  });
  // swap the active scene video — non-matching ones pause + fade out.
  // For pair-based scenes, only the video currently marked `is-shown`
  // is resumed; its buffer stays paused at frame 0 until the next
  // crossfade triggers it.
  let anyActive = false;
  sceneVideos.forEach(v => {
    const matches = parseInt(v.dataset.scene, 10) === n;
    v.classList.toggle('is-active', matches);
    if (matches) {
      anyActive = true;
      if (v.classList.contains('is-shown')) {
        v.play().catch(() => {});
      }
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
// Wheel-based scene navigation
// Native scroll-snap is "proximity" (gentle). We add a wheel
// handler on top: small flicks accumulate and feel free, but once
// the accumulator crosses a threshold the page snaps decisively to
// the next scene. Cooldown prevents skipping multiple scenes per
// gesture (and tames trackpad inertia).
// ──────────────────────────────────────────────────────────────
const WHEEL_TRIGGER  = 28;     // px of accumulated deltaY to trigger a snap
const WHEEL_COOLDOWN = 650;    // ms — minimum time between snaps
const WHEEL_RESET    = 140;    // ms — accumulator decays if you stop scrolling

let wheelAccum     = 0;
let wheelResetT    = 0;
let lastWheelNavAt = 0;

window.addEventListener('wheel', (e) => {
  // don't hijack scroll inside textareas (they have their own scroll)
  const tgt = e.target;
  if (tgt && typeof tgt.closest === 'function' && tgt.closest('textarea')) return;

  const now = performance.now();

  // still cooling down from the last snap — eat the event
  if (now - lastWheelNavAt < WHEEL_COOLDOWN) {
    e.preventDefault();
    return;
  }

  wheelAccum += e.deltaY;
  clearTimeout(wheelResetT);
  wheelResetT = setTimeout(() => { wheelAccum = 0; }, WHEEL_RESET);

  if (Math.abs(wheelAccum) < WHEEL_TRIGGER) return;

  const dir = wheelAccum > 0 ? 1 : -1;
  const target = Math.max(1, Math.min(TOTAL, state.current + dir));
  wheelAccum = 0;

  if (target === state.current) return;       // already at edge — let native overscroll happen

  e.preventDefault();
  lastWheelNavAt = now;
  scenes[target - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
}, { passive: false });

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
  if (matches) {
    anyInitialActive = true;
    if (v.classList.contains('is-shown')) {
      v.play().catch(() => {});
    }
  }
});
document.body.classList.toggle('has-video', anyInitialActive);
