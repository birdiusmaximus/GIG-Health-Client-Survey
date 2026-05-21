// Shared hamburger-menu slide-out panel.
// Loaded as a plain <script> by every page that has a `.menu` button.
// Self-injects (a) the gig.health-style circular SVG icon into the
// button itself, and (b) the slide-out panel into <body>, so the
// surrounding pages don't need to repeat any markup.

// ─── Hamburger / X icons (matched to gig.health) ─────────────
const ICON_OPEN = `
<svg class="menu-icon-open" width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="21" cy="21" r="20" stroke="#F45347" stroke-width="2" />
  <path d="M30.5 15L11 15"   stroke="#F45347" stroke-width="1.5" stroke-linecap="round" />
  <path d="M30.5 21.5L11 21.5" stroke="#F45347" stroke-width="1.5" stroke-linecap="round" />
  <path d="M30.5 28L11 28"   stroke="#F45347" stroke-width="1.5" stroke-linecap="round" />
</svg>`;
const ICON_CLOSE = `
<svg class="menu-icon-close" width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="21" cy="21" r="20" stroke="#FEF6F6" stroke-width="2" />
  <path d="M13.8557 27.3943L27.6443 13.6057" stroke="#FEF6F6" stroke-width="1.5" stroke-linecap="round" />
  <path d="M27.6443 27.3943L13.8557 13.6057" stroke="#FEF6F6" stroke-width="1.5" stroke-linecap="round" />
</svg>`;

const PANEL_HTML = `
<aside class="menu-panel" id="menu-panel" hidden aria-hidden="true">
  <div class="menu-panel-card" role="dialog" aria-modal="true" aria-label="Site navigation">
    <div class="menu-panel-head">
      <p class="menu-panel-kicker">Navigation</p>
      <button class="menu-close" id="menu-close" type="button" aria-label="Close menu">×</button>
    </div>
    <nav class="menu-panel-nav">
      <a class="menu-link" href="/index.html">
        <span class="menu-link-label">Take the survey</span>
        <span class="menu-link-sub">Tell us how we did</span>
        <span class="menu-link-arrow" aria-hidden="true">→</span>
      </a>
      <a class="menu-link" href="/showcase.html">
        <span class="menu-link-label">What clients say</span>
        <span class="menu-link-sub">Public showcase</span>
        <span class="menu-link-arrow" aria-hidden="true">→</span>
      </a>
      <a class="menu-link is-admin" href="/dashboard.html">
        <span class="menu-link-label">Admin dashboard</span>
        <span class="menu-link-sub">Internal · sign-in required</span>
        <span class="menu-link-arrow" aria-hidden="true">→</span>
      </a>
    </nav>
    <p class="menu-panel-foot">
      <a href="https://gig.health" target="_blank" rel="noopener">gig.health</a>
    </p>
  </div>
</aside>`;

document.body.insertAdjacentHTML('beforeend', PANEL_HTML);

const menuBtn   = document.querySelector('.menu');
const menuPanel = document.getElementById('menu-panel');
const menuClose = document.getElementById('menu-close');
const menuCard  = menuPanel?.querySelector('.menu-panel-card');

// Inject the SVG icons + accessibility attrs onto the existing button
if (menuBtn) {
  menuBtn.innerHTML = ICON_OPEN + ICON_CLOSE;
  if (!menuBtn.hasAttribute('aria-label'))    menuBtn.setAttribute('aria-label', 'Menu');
  if (!menuBtn.hasAttribute('aria-controls')) menuBtn.setAttribute('aria-controls', 'menu-panel');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('type', 'button');
}

// ─── Focus trap — Tab loops inside the panel while it's open ──
function focusables(el) {
  if (!el) return [];
  return Array.from(el.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(n => n.offsetParent !== null);
}
function trapKey(e) {
  if (e.key !== 'Tab' || !menuCard) return;
  const items = focusables(menuCard);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

let lastFocused = null;

function openMenu() {
  if (!menuPanel) return;
  lastFocused = document.activeElement;
  menuPanel.hidden = false;
  menuPanel.setAttribute('aria-hidden', 'false');
  menuBtn?.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => {
    menuPanel.classList.add('is-shown');
    // Focus the close button so SR users land somewhere useful
    menuClose?.focus();
  });
  document.addEventListener('keydown', trapKey);
}
function closeMenu() {
  if (!menuPanel) return;
  menuPanel.classList.remove('is-shown');
  menuBtn?.setAttribute('aria-expanded', 'false');
  document.removeEventListener('keydown', trapKey);
  setTimeout(() => {
    menuPanel.hidden = true;
    menuPanel.setAttribute('aria-hidden', 'true');
    // Restore focus to whatever opened the menu
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch (e) {}
    }
  }, 400);
}

menuBtn?.addEventListener('click', () => {
  if (menuBtn.getAttribute('aria-expanded') === 'true') closeMenu();
  else openMenu();
});
menuClose?.addEventListener('click', closeMenu);
menuPanel?.addEventListener('click', (e) => {
  if (e.target === menuPanel) closeMenu();      // click-outside
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuPanel && !menuPanel.hidden) closeMenu();
});
