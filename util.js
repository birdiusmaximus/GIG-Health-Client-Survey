// Shared helpers used across survey / dashboard / showcase.
// Tiny, dependency-free, designed to be imported as an ES module.

// HTML entity escape for any string-castable value.
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// localStorage + sessionStorage wrappers that don't throw in Safari
// private mode or when storage is otherwise blocked. Methods return
// the underlying value (or null), and writes return true/false.
export const safeStorage = {
  get(key)              { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value)       { try { localStorage.setItem(key, value); return true; } catch { return false; } },
  remove(key)           { try { localStorage.removeItem(key); } catch {} },
  getSession(key)       { try { return sessionStorage.getItem(key); } catch { return null; } },
  setSession(key, val)  { try { sessionStorage.setItem(key, val); return true; } catch { return false; } },
  removeSession(key)    { try { sessionStorage.removeItem(key); } catch {} },
};

// Trap Tab focus inside a container while it's open. Returns a
// cleanup function that restores focus to the original trigger and
// removes the trap. Pass the trigger so focus restores cleanly on close.
export function trapFocus(container, opts = {}) {
  if (!container) return () => {};
  const trigger = opts.trigger || document.activeElement;
  const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusables() {
    return Array.from(container.querySelectorAll(sel)).filter(el => el.offsetParent !== null);
  }

  // Focus the first focusable inside the container on open
  const first = focusables()[0];
  if (first) first.focus();

  function onKey(e) {
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const firstEl = items[0];
    const lastEl  = items[items.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  }
  container.addEventListener('keydown', onKey);

  return function release() {
    container.removeEventListener('keydown', onKey);
    if (trigger && typeof trigger.focus === 'function') {
      try { trigger.focus(); } catch {}
    }
  };
}

// Surface a transient, branded error toast at the bottom of the
// viewport. Used in place of alert() across the site.
let toastT = null;
export function showToast(message, opts = {}) {
  const tone = opts.tone || 'error';   // 'error' | 'info'
  let el = document.getElementById('gig-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gig-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.className = `gig-toast tone-${tone} is-shown`;
  el.textContent = message;
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.classList.remove('is-shown'); }, opts.duration || 5200);
}
