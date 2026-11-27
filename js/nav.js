/**
 * nav.js — classic script.
 * -----------------------------------------------------------------------------
 * Wires up:
 *   • Sidebar toggle (hamburger) and Launcher modal
 *   • Theme toggle (dark/light/cybersecurity)
 *   • Language toggle modal (EN, VI, FR)
 *   • Contact Us modal
 *   • Account modal (cloud sign-in / sign-out, storage badge)
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  function initNav() {
    initSidebarAndLauncher();
    initTheme();
    initLang();
    initAccountRole();
  }

  // ─── Sidebar & Launcher ──────────────────────────────────────────────────
  function initSidebarAndLauncher() {
    var wrapper = document.getElementById('sidebar-wrapper');
    var tab = document.getElementById('sidebar-toggle');
    var modal = document.getElementById('launcher-modal');
    var closeBtn = document.getElementById('launcher-close');
    var dashBtn = document.getElementById('launcher-dashboard');
    var helpBtn = document.getElementById('launcher-help');
    var notesBtn = document.getElementById('launcher-notes');
    var sidebarBtn = document.getElementById('launcher-sidebar');
    
    if (!wrapper || !tab || !modal) return;

    var mq = window.matchMedia('(max-width: 700px)');

    // Apply the open/closed state to the DOM
    function applyOpen() {
      var open = window.getState().sidebarOpen;

      if (mq.matches) {
        // Mobile: slide the overlay up/down using top (avoids transform trapping fixed children)
        var sidebar = wrapper.querySelector('.controls-sidebar');
        if (sidebar) {
          sidebar.style.transform = '';
          sidebar.style.top = open ? '0' : '-100%';
        }
      } else {
        // Desktop: standard collapse
        var sidebar = wrapper.querySelector('.controls-sidebar');
        if (sidebar) { 
          sidebar.style.transform = ''; 
          sidebar.style.top = ''; 
        }
        wrapper.classList.toggle('open', open);
        wrapper.classList.toggle('collapsed', !open);
      }

      var title = open ? 'Close sidebar' : 'Open sidebar';
      tab.title = title;
      tab.setAttribute('aria-label', title);
    }

    // Default state setup based on screen size
    function setDefault() {
      if (mq.matches) {
        window.setState({ sidebarOpen: false });
      } else {
        var saved = window.storage.get('sidebarOpen');
        window.setState({ sidebarOpen: saved !== false }); // default to open if null
      }
    }

    setDefault();

    // Handle screen resize
    var lastMatch = mq.matches;
    mq.addEventListener('change', function (e) {
      if (e.matches === lastMatch) return;
      lastMatch = e.matches;
      
      if (e.matches) {
        // Desktop to mobile: force closed
        window.setState({ sidebarOpen: false });
      }
      applyOpen();
    });

    // Sidebar open/close reactive to state
    window.subscribe(function (state, prev) {
      if (state.sidebarOpen !== prev.sidebarOpen) {
        applyOpen();
        // Persist the new state
        if (!mq.matches) {
          window.storage.set('sidebarOpen', state.sidebarOpen);
        }
      }
    });

    applyOpen();

    // ─── Launcher Modal Logic ───
    function openLauncher() {
      if (sidebarBtn) {
        var isOpen = window.getState().sidebarOpen;
        sidebarBtn.textContent = isOpen ? window.__i18n__.t('closeSidebar') : window.__i18n__.t('openSidebar');
      }
      modal.classList.add('visible');
      modal.setAttribute('aria-hidden', 'false');
    }

    function closeLauncher() {
      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
    }

    // Toggle modal when hamburger is clicked
    tab.addEventListener('click', function () {
      if (modal.classList.contains('visible')) {
        closeLauncher();
      } else {
        openLauncher();
      }
    });

    // Modal close bindings
    if (closeBtn) closeBtn.addEventListener('click', closeLauncher);
    
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeLauncher();
    });
    
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('visible')) closeLauncher();
    });

    // Modal action bindings
    if (dashBtn) {
      dashBtn.addEventListener('click', function () {
        if (typeof window.setViewMode === 'function') window.setViewMode('analytics');
        closeLauncher();
      });
    }

    if (helpBtn) {
      helpBtn.addEventListener('click', function () {
        window.storage.set('hintDismissed', false);
        if (typeof window.__onboardingShow__ === 'function') window.__onboardingShow__();
        closeLauncher();
      });
    }

    if (notesBtn) {
      notesBtn.addEventListener('click', function () {
        if (typeof window.setViewMode === 'function') window.setViewMode('notes');
        if (window.matchMedia('(max-width: 700px)').matches) {
          window.setState({ sidebarOpen: false });
        }
        closeLauncher();
      });
    }

    if (sidebarBtn) {
      sidebarBtn.addEventListener('click', function () {
        window.setState({ sidebarOpen: !window.getState().sidebarOpen });
        closeLauncher();
      });
    }

    // ─── Contact Us Modal Logic ───
    var regBtn = document.getElementById('launcher-register');
    var regModal = document.getElementById('register-modal');
    var regCancel = document.getElementById('register-cancel');

    if (regBtn && regModal) {
      regBtn.addEventListener('click', function(e) {
        e.preventDefault();
        regModal.classList.add('visible');
        regModal.setAttribute('aria-hidden', 'false');
      });
    }
    if (regCancel && regModal) {
      regCancel.addEventListener('click', function() {
        regModal.classList.remove('visible');
        regModal.setAttribute('aria-hidden', 'true');
      });
    }
    if (regModal) {
      regModal.addEventListener('click', function(e) { 
        if (e.target === regModal) {
          regModal.classList.remove('visible');
          regModal.setAttribute('aria-hidden', 'true');
        }
      });
    }
  }

  // ─── Theme ───────────────────────────────────────────────────────────────
  function initTheme() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;

    var themes = ['dark', 'light', 'cybersecurity'];

    btn.addEventListener('click', function () {
      var current = window.getState().theme || 'dark';
      var currentIndex = themes.indexOf(current);
      if (currentIndex === -1) currentIndex = 0;

      var next = themes[(currentIndex + 1) % themes.length];
      window.setState({ theme: next });
    });

    window.subscribe(function (state, prev) {
      if (state.theme !== prev.theme) {
        document.documentElement.setAttribute('data-theme', state.theme);
        window.storage.set('theme', state.theme);
      }
    });
  }

  // ─── Language ────────────────────────────────────────────────────────────
  function initLang() {
    var btn = document.getElementById('lang-toggle');
    var label = document.getElementById('lang-toggle-label');
    var modal = document.getElementById('lang-modal');
    var cancelBtn = document.getElementById('lang-cancel');
    
    if (!btn || !window.__i18n__ || !modal) return;

    var codes = window.__i18n__.codes;
    var current = window.getState().lang || codes[0];
    
    // Apply initial language
    window.__i18n__.apply(current);
    if (label) label.textContent = current.toUpperCase();

    // Open modal
    btn.addEventListener('click', function() {
      // Highlight currently active language
      var btns = modal.querySelectorAll('.lang-opt');
      btns.forEach(function(b) {
        if (b.dataset.lang === current) b.classList.add('active');
        else b.classList.remove('active');
      });

      modal.classList.add('visible');
      modal.setAttribute('aria-hidden', 'false');
    });

    // Close modal (Cancel button or clicking background)
    function closeModal() {
      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
    }
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeModal();
    });

    // Language selection
    var langBtns = modal.querySelectorAll('.lang-opt');
    langBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var lang = this.dataset.lang;
        current = lang;
        
        window.setState({ lang: lang });
        window.__i18n__.apply(lang);
        if (label) label.textContent = lang.toUpperCase();
        
        // Trigger a custom event so other parts of the app know the language changed
        window.dispatchEvent(new Event('language-changed'));
        
        closeModal();
      });
    });
  }

  // ─── Account Modal (cloud sign-in / sign-out) ────────────────────────────
  function initAccountRole() {
    var accBtn = document.getElementById('account-toggle');
    var accountModal = document.getElementById('role-modal');
    var signoutBtn = document.getElementById('role-signout');
    var cloudSignInBtn = document.getElementById('cloud-signin-open-btn');
    var cloudLoginModal = document.getElementById('cloud-login-modal');
    var cloudLoginForm = document.getElementById('cloud-login-form');
    var cloudLoginCancel = document.getElementById('cloud-login-cancel');
    var cloudLoginError = document.getElementById('cloud-login-error');
    var cloudEmail = document.getElementById('cloud-email');
    var cloudPassword = document.getElementById('cloud-password');
    var cloudSubmit = document.getElementById('cloud-login-submit');
    var accountEmail = document.getElementById('account-email');

    if (!accBtn || !accountModal) return;

    // ─── Helpers ───
    function openModal(el) {
      if (!el) return;
      el.classList.add('visible');
      el.setAttribute('aria-hidden', 'false');
    }
    function closeModal(el) {
      if (!el) return;
      el.classList.remove('visible');
      el.setAttribute('aria-hidden', 'true');
    }
    function showCloudError(msg) {
      if (!cloudLoginError) return;
      cloudLoginError.textContent = msg || '';
      cloudLoginError.classList.toggle('hidden', !msg);
    }

    // Reflect signed-in state on account modal
    function refreshAccountState() {
      var authed = !!(window.cloudSync && window.cloudSync.isAuthenticated());
      var user = authed ? window.cloudSync.getUser() : null;

      if (accountEmail) {
        accountEmail.textContent = authed && user && user.email ? user.email : '';
      }
      if (cloudSignInBtn) cloudSignInBtn.style.display = authed ? 'none' : '';
      if (signoutBtn) signoutBtn.style.display = authed ? '' : 'none';

      if (window.cloudSync && typeof window.cloudSync.updateStorageBadges === 'function') {
        window.cloudSync.updateStorageBadges();
      }
    }

    // ─── Account toggle opens account modal ───
    accBtn.addEventListener('click', function () {
      refreshAccountState();
      openModal(accountModal);
    });

    accountModal.addEventListener('click', function (e) {
      if (e.target === accountModal) closeModal(accountModal);
    });

    var accountCancel = document.getElementById('role-cancel');
    if (accountCancel) {
      accountCancel.addEventListener('click', function () {
        closeModal(accountModal);
      });
    }

    // ─── Cloud Sign In button opens login modal ───
    if (cloudSignInBtn && cloudLoginModal) {
      cloudSignInBtn.addEventListener('click', function () {
        showCloudError('');
        if (cloudLoginForm) cloudLoginForm.reset();
        closeModal(accountModal);
        openModal(cloudLoginModal);
        if (cloudEmail) cloudEmail.focus();
      });
    }

    // ─── Cloud login modal cancel / backdrop ───
    if (cloudLoginCancel && cloudLoginModal) {
      cloudLoginCancel.addEventListener('click', function () {
        closeModal(cloudLoginModal);
      });
    }
    if (cloudLoginModal) {
      cloudLoginModal.addEventListener('click', function (e) {
        if (e.target === cloudLoginModal) closeModal(cloudLoginModal);
      });
    }

    // ─── Cloud login form submit ───
    if (cloudLoginForm) {
      cloudLoginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        showCloudError('');

        var email = (cloudEmail && cloudEmail.value || '').trim();
        var password = (cloudPassword && cloudPassword.value || '');

        if (!email || !password) {
          showCloudError(window.__i18n__.t('cloudSignInFailed'));
          return;
        }

        if (cloudSubmit) cloudSubmit.disabled = true;

        try {
          if (!window.cloudSync || typeof window.cloudSync.signIn !== 'function') {
            throw new Error('Cloud sync unavailable');
          }
          await window.cloudSync.signIn(email, password);
          closeModal(cloudLoginModal);
          refreshAccountState();
        } catch (err) {
          showCloudError(window.__i18n__.t('cloudSignInFailed'));
          if (window.console && console.warn) {
            console.warn('[nav] cloud sign-in failed:', err && err.message ? err.message : err);
          }
        } finally {
          if (cloudSubmit) cloudSubmit.disabled = false;
        }
      });
    }

    // ─── Sign Out (cloud + account modal) ───
    if (signoutBtn) {
      signoutBtn.addEventListener('click', async function () {
        try {
          if (window.cloudSync && typeof window.cloudSync.signOut === 'function' && window.cloudSync.isAuthenticated()) {
            await window.cloudSync.signOut();
          }
        } catch (err) {
          if (window.console && console.warn) {
            console.warn('[nav] cloud sign-out failed:', err);
          }
        }
        refreshAccountState();
        closeModal(accountModal);
      });
    }

    // ─── Initial + reactive state ───
    refreshAccountState();

    // Re-render badges + email + button visibility when language changes
    window.addEventListener('language-changed', function () {
      refreshAccountState();
    });

    // If cloud-sync exposes its own "hydrated" event, keep the modal in sync
    window.addEventListener('cloud-hydrated', refreshAccountState);

  }

  window.initNav = initNav;
})();