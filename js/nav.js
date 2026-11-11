/**
 * nav.js — classic script.
 * -----------------------------------------------------------------------------
 * Wires up:
 *   • Sidebar toggle (hamburger) and Launcher modal
 *   • Theme toggle (dark/light/cybersecurity)
 *   • Language toggle modal (EN, VI, FR)
 *   • Contact Us modal
 *   • Account Role modal & display
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

  // ─── Account Role ────────────────────────────────────────────────────────
  function initAccountRole() {
    var accBtn = document.getElementById('account-toggle');
    var roleModal = document.getElementById('role-modal');
    var roleLabelSpan = document.getElementById('account-role-label');
    var signoutBtn = document.getElementById('role-signout');
    
    if (!accBtn || !roleModal) return;

    // Load saved role and apply to UI
    var currentRole = window.storage.get('accountRole', null);
    
    function applyRole(role) {
      var roleKey = '';
      if (role === 'Analyst') roleKey = 'roleAnalyst';
      if (role === 'Manager') roleKey = 'roleManager';
      if (role === 'System Admin') roleKey = 'roleAdmin';

      if (roleLabelSpan) {
        var displayRole = role ? window.__i18n__.t(roleKey) : '';
        roleLabelSpan.textContent = displayRole;
        roleLabelSpan.style.display = role ? 'inline-block' : 'none';
      }
      if (accBtn) {
        // Update accessible label
        var a11yRole = role ? window.__i18n__.t(roleKey) : window.__i18n__.t('profile');
        var label = role ? window.__i18n__.t('profile') + ': ' + a11yRole : window.__i18n__.t('profile');
        accBtn.setAttribute('aria-label', label);
        accBtn.setAttribute('title', label);
      }
    }
    
    applyRole(currentRole);

    // Modal open
    accBtn.addEventListener('click', function() {
      // Highlight currently active role (if any)
      var btns = roleModal.querySelectorAll('.role-opt');
      btns.forEach(function(b) {
        if (b.dataset.role === currentRole) b.classList.add('active');
        else b.classList.remove('active');
      });
      
      // Show/hide signout based on whether a role is set
      if (signoutBtn) signoutBtn.style.display = currentRole ? 'block' : 'none';

      roleModal.classList.add('visible');
      roleModal.setAttribute('aria-hidden', 'false');
    });

    // Modal close
    roleModal.addEventListener('click', function(e) {
      if (e.target === roleModal) {
        roleModal.classList.remove('visible');
        roleModal.setAttribute('aria-hidden', 'true');
      }
    });

    var cancelBtn = document.getElementById('role-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        roleModal.classList.remove('visible');
        roleModal.setAttribute('aria-hidden', 'true');
      });
    }

    // Role selection
    var roleBtns = roleModal.querySelectorAll('.role-opt');
    roleBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var role = this.dataset.role;
        currentRole = role;
        window.storage.set('accountRole', role);
        applyRole(role);
        roleModal.classList.remove('visible');
        roleModal.setAttribute('aria-hidden', 'true');
      });
    });

    // Sign out
    if (signoutBtn) {
      signoutBtn.addEventListener('click', function() {
        currentRole = null;
        window.storage.remove('accountRole');
        applyRole(null);
        roleModal.classList.remove('visible');
        roleModal.setAttribute('aria-hidden', 'true');
      });
    }

    // Update label when language changes
    window.addEventListener('language-changed', function() {
      applyRole(currentRole);
    });
  }

  window.initNav = initNav;
})();