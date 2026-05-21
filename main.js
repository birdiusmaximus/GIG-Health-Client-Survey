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
// Scene videos — the source clips are static (every frame identical),
// so we play once and let the browser hold the final frame. No loop
// = no seam flash. Cheap.
// ──────────────────────────────────────────────────────────────
sceneVideos.forEach(v => {
  v.loop = false;
  v.autoplay = true;
  v.muted = true;
  v.classList.add('is-shown');
  // Some browsers need an explicit play() kick after metadata loads
  const kick = () => { v.play().catch(() => {}); };
  if (v.readyState >= 1) kick();
  else v.addEventListener('loadedmetadata', kick, { once: true });
});

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
  // Show only the active scene's video. It autoplays once on first
  // load then holds the final (identical) frame — nothing to resume.
  let anyActive = false;
  sceneVideos.forEach(v => {
    const matches = parseInt(v.dataset.scene, 10) === n;
    v.classList.toggle('is-active', matches);
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
