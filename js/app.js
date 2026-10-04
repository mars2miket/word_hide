// --- SIDEBAR EDGE TAB + MOBILE AUTO-COLLAPSE ---
(function initSidebarToggle() {
    const wrapper = document.getElementById('sidebar-wrapper');
    const tab = document.getElementById('edge-tab');
    if (!wrapper || !tab) return;

    const mq = window.matchMedia('(max-width: 700px)');
    let lastMatches = mq.matches;

    // Set the initial state ONCE on load
    function setInitialState() {
        if (mq.matches) {
            wrapper.classList.remove('open');
            wrapper.classList.add('collapsed');
        } else {
            wrapper.classList.add('open');
            wrapper.classList.remove('collapsed');
        }
    }

    // Only react when crossing the 700px boundary in either direction
    mq.addEventListener('change', (e) => {
        if (e.matches === lastMatches) return;   // ignore spurious flips
        lastMatches = e.matches;
        setInitialState();
    });

    tab.addEventListener('click', () => {
        wrapper.classList.toggle('open');
        wrapper.classList.toggle('collapsed');
    });

    setInitialState();
})();

// --- ACCORDION (single-open) ---
(function initAccordion() {
    const sections = document.querySelectorAll('.acc-section');
    if (!sections.length) return;

    sections.forEach(section => {
        const header = section.querySelector('.acc-header');
        if (!header) return;
        header.addEventListener('click', () => {
            const isOpen = section.classList.contains('open');
            sections.forEach(s => s.classList.remove('open'));
            if (!isOpen) section.classList.add('open');
        });
    });
})();

// --- THEME TOGGLE ---
(function initThemeToggle() {
    const root = document.documentElement;
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

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

// --- MOBILE VIEWPORT LOCK ---
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
    if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        lockMobileViewport();
    }
});

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', lockMobileViewport);
    window.visualViewport.addEventListener('scroll', lockMobileViewport);
}