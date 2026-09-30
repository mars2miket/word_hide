let lastWidth = window.innerWidth;

function lockMobileViewport() {
    if (window.innerWidth <= 700) {
        // Grab the actual viewable height before the keyboard pushes up
        const trueHeight = window.innerHeight;
        document.documentElement.style.setProperty('--app-height', `${trueHeight}px`);
    } else {
        // Clear it on desktop so standard layout handles it
        document.documentElement.style.removeProperty('--app-height');
    }
}

// Lock layout immediately on script load, window load, and orientation changes
lockMobileViewport();
window.addEventListener('load', lockMobileViewport);
window.addEventListener('resize', () => {
    // Only recalculate if screen width changes (e.g., rotating phone sideways)
    // Android keyboard pop-ups only alter the height, leaving width unchanged!
    if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        lockMobileViewport();
    }
});
