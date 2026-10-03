(function initThemeToggle() {
  const root = document.documentElement;
  const btn  = document.getElementById('theme-toggle');
  if (!btn) return;

  // Sync button label with whatever theme was set pre-paint
  const syncLabel = () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  };
  syncLabel();

  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('recallrx-theme', next); } catch (e) {}
    syncLabel();
  });
})();

let lastWidth = window.innerWidth;

function lockMobileViewport() {
    if (window.innerWidth <= 700) {
        const trueHeight = window.innerHeight;
        document.documentElement.style.setProperty('--app-height', `${trueHeight}px`);
    } else {
        document.documentElement.style.removeProperty('--app-height');
    }
}

lockMobileViewport();
window.addEventListener('load', lockMobileViewport);

window.addEventListener('resize', () => {
    // Only recalculate if screen width changes (orientation flip, not keyboard popup)
    if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        lockMobileViewport();
    }
});

// Re-lock after on-screen keyboard closes (visualViewport is more reliable on mobile)
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', lockMobileViewport);
    window.visualViewport.addEventListener('scroll', lockMobileViewport);
}