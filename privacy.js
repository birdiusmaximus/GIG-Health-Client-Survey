// Shared privacy-notice modal. Auto-injects HTML + wires any
// `[data-open-privacy]` link/button on the page to open it.

const PRIVACY_HTML = `
<div class="privacy-overlay" id="privacy-overlay" hidden aria-hidden="true">
  <div class="privacy-card" role="dialog" aria-labelledby="privacy-title">
    <button class="privacy-close" id="privacy-close" type="button" aria-label="Close">×</button>
    <p class="kicker">
      <span class="kicker-num">Privacy</span>
      <span class="kicker-sep" aria-hidden="true"></span>
      <span class="kicker-label">How we handle your data</span>
    </p>
    <h2 class="privacy-title" id="privacy-title">Your data, briefly.</h2>

    <h3 class="privacy-h">What we collect</h3>
    <p>Your answers to the ten survey questions. If you choose to share a referral in question 9, that may include another person's name and email address.</p>

    <h3 class="privacy-h">Where it's stored</h3>
    <p>Encrypted in a private Supabase database (EU / UK region). Only the GIG team can access it, via a secure admin dashboard.</p>

    <h3 class="privacy-h">How we use it</h3>
    <p>Internally — to improve how we work with clients. Quotes are <strong>only</strong> shared publicly (on our website, in proposals, in case studies) when you explicitly grant permission in questions 6 and 8. Quotes shown publicly are anonymised — your project name and any client identifiers are stripped before any public surface.</p>

    <h3 class="privacy-h">Retention</h3>
    <p>We keep responses for up to two years from submission to inform ongoing client relationships.</p>

    <h3 class="privacy-h">Your rights</h3>
    <p>You can request a copy or deletion of your response at any time by emailing <a href="mailto:hello@gig.health">hello@gig.health</a>. We'll action it within 30 days.</p>

    <p class="privacy-foot">GIG Health Limited · Registered in England &amp; Wales · <a href="https://gig.health" target="_blank" rel="noopener">gig.health</a></p>
  </div>
</div>`;

document.body.insertAdjacentHTML('beforeend', PRIVACY_HTML);

const privacyOverlay = document.getElementById('privacy-overlay');
const privacyClose   = document.getElementById('privacy-close');

function openPrivacy() {
  if (!privacyOverlay) return;
  privacyOverlay.hidden = false;
  privacyOverlay.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => privacyOverlay.classList.add('is-shown'));
}
function closePrivacy() {
  if (!privacyOverlay) return;
  privacyOverlay.classList.remove('is-shown');
  setTimeout(() => {
    privacyOverlay.hidden = true;
    privacyOverlay.setAttribute('aria-hidden', 'true');
  }, 350);
}

// Wire all `[data-open-privacy]` triggers
document.querySelectorAll('[data-open-privacy]').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); openPrivacy(); });
});
privacyClose?.addEventListener('click', closePrivacy);
privacyOverlay?.addEventListener('click', (e) => {
  if (e.target === privacyOverlay) closePrivacy();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && privacyOverlay && !privacyOverlay.hidden) closePrivacy();
});
