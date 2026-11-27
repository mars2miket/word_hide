/**
 * supabase-client.js — classic script.
 * Hardened Supabase client initialization for Vault Recall.
 * Embed ONLY your public SUPABASE_URL and SUPABASE_ANON_KEY (never service_role).
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://zzwyjyshhdvlrrqthdyp.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_y5IkNHO8fXgfspW6eZlEZg_ktVnHbyE';
  var TURNSTILE_SITE_KEY = ''; // Optional: Cloudflare Turnstile site key

  var config = Object.freeze({
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    turnstileSiteKey: TURNSTILE_SITE_KEY
  });

  Object.defineProperty(window, '__VAULT_SUPABASE_CONFIG__', {
    value: config,
    writable: false,
    configurable: false
  });

  function isValidHttpsUrl(url) {
    return typeof url === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim());
  }

  function isServiceRoleJwt(token) {
    if (typeof token !== 'string') return false;
    if (token.indexOf('sb_secret_') === 0) return true;
    var parts = token.split('.');
    if (parts.length !== 3) return false;
    try {
      var base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var payload = JSON.parse(atob(base64));
      return payload && payload.role === 'service_role';
    } catch (e) {
      return false;
    }
  }

  var clientInstance = null;

  if (isServiceRoleJwt(SUPABASE_ANON_KEY)) {
    console.error('[Supabase] SECURITY BLOCK: service_role or secret key detected in frontend config. Client aborted.');
  } else if (
    window.supabase &&
    typeof window.supabase.createClient === 'function' &&
    isValidHttpsUrl(SUPABASE_URL) &&
    SUPABASE_ANON_KEY &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
  ) {
    clientInstance = window.supabase.createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'vault-recall:supabase-auth'
      }
    });
  } else {
    console.info('[Supabase] Client not configured or SDK missing; running in local-only mode.');
  }

  Object.defineProperty(window, 'supabaseClient', {
    value: clientInstance,
    writable: false,
    configurable: false
  });
})();
