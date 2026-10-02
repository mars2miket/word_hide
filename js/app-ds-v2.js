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