// Shared hamburger-menu slide-out panel.
// Loaded by every page that has a `.menu` (☰) button in its topbar.
// Self-injects its own HTML so each page doesn't have to duplicate it.

const MENU_HTML = `
<aside class="menu-panel" id="menu-panel" hidden aria-hidden="true">
  <div class="menu-panel-card" role="dialog" aria-label="Site navigation">
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

document.body.insertAdjacentHTML('beforeend', MENU_HTML);

const menuBtn   = document.querySelector('.menu');
const menuPanel = document.getElementById('menu-panel');
const menuClose = document.getElementById('menu-close');

function openMenu() {
  if (!menuPanel) return;
  menuPanel.hidden = false;
  menuPanel.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => menuPanel.classList.add('is-shown'));
}
function closeMenu() {
  if (!menuPanel) return;
  menuPanel.classList.remove('is-shown');
  setTimeout(() => {
    menuPanel.hidden = true;
    menuPanel.setAttribute('aria-hidden', 'true');
  }, 400);
}

menuBtn?.addEventListener('click', openMenu);
menuClose?.addEventListener('click', closeMenu);
menuPanel?.addEventListener('click', (e) => {
  if (e.target === menuPanel) closeMenu();      // click-outside
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuPanel && !menuPanel.hidden) closeMenu();
});
