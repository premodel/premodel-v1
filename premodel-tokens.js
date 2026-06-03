/* ============================================================================
   premodel-tokens.js — shared design-token engine for the Premodel system.

   One source of truth, loaded by BOTH premodel_palette_v2.html (the style
   guide / editor) and premodel_homepage_prototype.html (the listener).

   Responsibilities
   ----------------
   - DEFAULT_TOKENS: the canonical token contract (names, default values,
     editor metadata). The CSS :root in each file mirrors these defaults.
   - apply / reset / load / save: read & write overrides to localStorage and
     to documentElement inline styles. This module is the ONLY writer of
     documentElement.style for design tokens.
   - Live cross-tab sync over http://localhost via BroadcastChannel, with the
     storage event as a free fallback. A monotonic `rev` dedupes the two
     transports so a change is never applied twice.
   - set(): the editor path (guide only) — merge + persist + apply + broadcast.

   FOUC note: a tiny inline <script> in each file's <head> reads localStorage
   and applies overrides before first paint. This module then loads at end of
   body and re-applies idempotently + attaches the live transports.
   ============================================================================ */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'premodel-tokens';
  var CHANNEL_NAME = 'premodel-tokens';

  // ──────────────────────────────────────────────────────────────────────
  // Canonical token contract. Values are the brand (warm) defaults from the
  // style guide; both files share these. `responsive` carries the per-
  // breakpoint type sizes (base = mobile ≤640, md = 768, lg = 1200+).
  // ──────────────────────────────────────────────────────────────────────
  var DEFAULT_TOKENS = {
    // ── Surfaces ──────────────────────────────────────────────────────
    '--bg-page':            { value: '#f7f4eb', type: 'color', group: 'Surfaces', label: 'Page background' },
    '--bg-surface':         { value: '#fbf8ef', type: 'color', group: 'Surfaces', label: 'Card surface' },
    '--bg-surface-elevated':{ value: '#ffffff', type: 'color', group: 'Surfaces', label: 'Elevated surface' },
    '--bg-pill':            { value: '#ece4d1', type: 'color', group: 'Surfaces', label: 'Pill bg (guide demo)' },
    '--bg-footer':          { value: '#ece4d1', type: 'color', group: 'Surfaces', label: 'Footer background' },
    '--bg-chip':            { value: '#fbf8ef', type: 'color', group: 'Surfaces', label: 'Chip / eyebrow bg' },
    '--bg-warning':         { value: '#faeeda', type: 'color', group: 'Surfaces', label: 'Warning bg' },
    '--bg-dark':            { value: '#1a1816', type: 'color', group: 'Surfaces', label: 'Dark surface' },
    '--bg-dark-elevated':   { value: '#24221f', type: 'color', group: 'Surfaces', label: 'Dark elevated' },
    '--bg-dark-card':       { value: '#f7f4eb', type: 'color', group: 'Surfaces', label: 'Card on dark' },

    // ── Text ──────────────────────────────────────────────────────────
    '--text-primary':       { value: '#2a2826', type: 'color', group: 'Text', label: 'Primary text' },
    '--text-secondary':     { value: '#6a625a', type: 'color', group: 'Text', label: 'Secondary text' },
    '--text-tertiary':      { value: '#998f80', type: 'color', group: 'Text', label: 'Tertiary text' },
    '--text-warning':       { value: '#854f0b', type: 'color', group: 'Text', label: 'Warning text' },
    '--text-on-dark':       { value: '#f3ede1', type: 'color', group: 'Text', label: 'Text on dark' },
    '--text-on-dark-2':     { value: '#a89a82', type: 'color', group: 'Text', label: 'Text on dark (2)' },
    '--text-on-dark-3':     { value: '#6a625a', type: 'color', group: 'Text', label: 'Text on dark (3)' },

    // ── Borders & icons ───────────────────────────────────────────────
    '--border-divider':     { value: '#e4dccb', type: 'color', group: 'Borders', label: 'Hairline divider' },
    '--border-subtle':      { value: '#d8cfc0', type: 'color', group: 'Borders', label: 'Subtle border' },
    '--border-strong':      { value: '#b8ae9c', type: 'color', group: 'Borders', label: 'Strong border' },
    '--border-on-dark':     { value: 'rgba(243, 237, 225, 0.16)', type: 'color', group: 'Borders', label: 'Border on dark' },
    '--icon-primary':       { value: '#2a2826', type: 'color', group: 'Borders', label: 'Icon (primary)' },
    '--icon-muted':         { value: '#998f80', type: 'color', group: 'Borders', label: 'Icon (muted)' },

    // ── Accent ────────────────────────────────────────────────────────
    '--accent':             { value: '#5e2c2e', type: 'color', group: 'Accent', label: 'Accent — primary' },
    '--accent-hover':       { value: '#3f1c1d', type: 'color', group: 'Accent', label: 'Accent — hover' },
    '--accent-soft':        { value: '#ecd0d0', type: 'color', group: 'Accent', label: 'Accent — soft tint' },
    '--accent-on-dark':     { value: '#a4666a', type: 'color', group: 'Accent', label: 'Accent — on dark' },

    // ── Chart / illustration (renamed from --gray-line/--hatch/etc.) ──
    '--chart-line':         { value: '#b9b8b1', type: 'color', group: 'Chart', label: 'Chart line / rule' },
    '--chart-hatch':        { value: '#c9c8c1', type: 'color', group: 'Chart', label: 'Chart hatch' },
    '--chart-fill-soft':    { value: '#e4eef8', type: 'color', group: 'Chart', label: 'Chart soft fill' },
    '--media-placeholder':  { value: '#3a3935', type: 'color', group: 'Chart', label: 'Image placeholder' },

    // ── Fonts ─────────────────────────────────────────────────────────
    '--font-display':       { value: "'Source Serif 4', Georgia, serif", type: 'font', group: 'Type', label: 'Display font' },
    '--font-body':          { value: "'Inter', system-ui, sans-serif", type: 'font', group: 'Type', label: 'Body font' },
    '--display-weight':     { value: '500', type: 'unitless', group: 'Type', label: 'Display weight' },

    // ── Radii ─────────────────────────────────────────────────────────
    '--radius-input':       { value: '6px',   type: 'length', group: 'Radius', label: 'Input radius' },
    '--radius-sm':          { value: '8px',   type: 'length', group: 'Radius', label: 'Small radius' },
    '--radius-card':        { value: '14px',  type: 'length', group: 'Radius', label: 'Card radius' },
    '--radius-tile':        { value: '18px',  type: 'length', group: 'Radius', label: 'Tile radius' },
    '--radius-modal':       { value: '22px',  type: 'length', group: 'Radius', label: 'Modal radius' },
    '--radius-pill':        { value: '999px', type: 'length', group: 'Radius', label: 'Pill radius' },

    // ── Line heights ──────────────────────────────────────────────────
    '--lh-display':         { value: '1.1',  type: 'unitless', group: 'Type', label: 'Display line-height' },
    '--lh-heading':         { value: '1.2',  type: 'unitless', group: 'Type', label: 'Heading line-height' },
    '--lh-body':            { value: '1.55', type: 'unitless', group: 'Type', label: 'Body line-height' },

    // ── Type scale (responsive: base = mobile, md = 768, lg = 1200+) ──
    '--fs-display-1':       { value: '44px', type: 'length', group: 'Type', label: 'Display 1', responsive: { base: '44px', md: '56px', lg: '64px' } },
    '--fs-display-2':       { value: '32px', type: 'length', group: 'Type', label: 'Display 2', responsive: { base: '32px', md: '40px', lg: '44px' } },
    '--fs-h1':              { value: '28px', type: 'length', group: 'Type', label: 'H1', responsive: { base: '28px', md: '32px', lg: '36px' } },
    '--fs-h2':              { value: '22px', type: 'length', group: 'Type', label: 'H2', responsive: { base: '22px', md: '24px', lg: '24px' } },
    '--fs-h3':              { value: '18px', type: 'length', group: 'Type', label: 'H3', responsive: { base: '18px', md: '19px', lg: '19px' } },
    '--fs-body-lg':         { value: '17px', type: 'length', group: 'Type', label: 'Body large', responsive: { base: '17px', md: '18px', lg: '18px' } },
    '--fs-body':            { value: '15px', type: 'length', group: 'Type', label: 'Body', responsive: { base: '15px', md: '16px', lg: '16px' } },
    '--fs-small':           { value: '13px', type: 'length', group: 'Type', label: 'Small', responsive: { base: '13px', md: '13px', lg: '13px' } },
    '--fs-caption':         { value: '11px', type: 'length', group: 'Type', label: 'Caption', responsive: { base: '11px', md: '11px', lg: '11px' } },
    // Intermediate steps captured from the prototype's real usage.
    '--fs-micro':           { value: '10px', type: 'length', group: 'Type', label: 'Micro', responsive: { base: '10px', md: '10px', lg: '10px' } },
    '--fs-mini':            { value: '12px', type: 'length', group: 'Type', label: 'Mini', responsive: { base: '12px', md: '12px', lg: '12px' } },
    '--fs-body-sm':         { value: '14px', type: 'length', group: 'Type', label: 'Body small', responsive: { base: '14px', md: '14px', lg: '14px' } },
    '--fs-h2-sm':           { value: '20px', type: 'length', group: 'Type', label: 'H2 small', responsive: { base: '20px', md: '20px', lg: '20px' } },
    '--fs-display-sm':      { value: '30px', type: 'length', group: 'Type', label: 'Display small', responsive: { base: '30px', md: '30px', lg: '30px' } },

    // ── Spacing scale (4-based + intermediates captured from prototype) ─
    '--space-0-5':          { value: '2px',  type: 'length', group: 'Space', label: 'space-0.5' },
    '--space-1':            { value: '4px',  type: 'length', group: 'Space', label: 'space-1' },
    '--space-1-5':          { value: '6px',  type: 'length', group: 'Space', label: 'space-1.5' },
    '--space-2':            { value: '8px',  type: 'length', group: 'Space', label: 'space-2' },
    '--space-2-5':          { value: '10px', type: 'length', group: 'Space', label: 'space-2.5' },
    '--space-3':            { value: '12px', type: 'length', group: 'Space', label: 'space-3' },
    '--space-3-5':          { value: '14px', type: 'length', group: 'Space', label: 'space-3.5' },
    '--space-4':            { value: '16px', type: 'length', group: 'Space', label: 'space-4' },
    '--space-4-5':          { value: '20px', type: 'length', group: 'Space', label: 'space-4.5' },
    '--space-5':            { value: '24px', type: 'length', group: 'Space', label: 'space-5' },
    '--space-5-5':          { value: '28px', type: 'length', group: 'Space', label: 'space-5.5' },
    '--space-6':            { value: '32px', type: 'length', group: 'Space', label: 'space-6' },
    '--space-6-5':          { value: '40px', type: 'length', group: 'Space', label: 'space-6.5' },
    '--space-7':            { value: '48px', type: 'length', group: 'Space', label: 'space-7' },
    '--space-7-5':          { value: '60px', type: 'length', group: 'Space', label: 'space-7.5' },
    '--space-8':            { value: '64px', type: 'length', group: 'Space', label: 'space-8' },
    '--space-9':            { value: '96px', type: 'length', group: 'Space', label: 'space-9' }
  };

  // ──────────────────────────────────────────────────────────────────────
  // Storage helpers
  // ──────────────────────────────────────────────────────────────────────
  function readStore() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { rev: 0, tokens: {} };
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { rev: 0, tokens: {} };
      return { rev: parsed.rev || 0, tokens: parsed.tokens || {} };
    } catch (e) {
      return { rev: 0, tokens: {} };
    }
  }

  function writeStore(rev, tokens) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ rev: rev, tokens: tokens }));
    } catch (e) { /* storage full / blocked — overrides stay in-memory only */ }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Core apply: only write the keys present in `tokens`. Untouched tokens
  // stay on the stylesheet so @media bumps and dark mode still cascade.
  // For responsive type tokens, an object value {base,md,lg} pins the
  // breakpoint the editor is currently previewing (passed as `bp`).
  // ──────────────────────────────────────────────────────────────────────
  function applyOne(root, name, value) {
    if (value === null || value === undefined || value === '') {
      root.style.removeProperty(name);
    } else {
      root.style.setProperty(name, String(value));
    }
  }

  function apply(tokens) {
    if (!tokens) return;
    var root = document.documentElement;
    for (var name in tokens) {
      if (Object.prototype.hasOwnProperty.call(tokens, name)) {
        applyOne(root, name, tokens[name]);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // State
  // ──────────────────────────────────────────────────────────────────────
  var current = readStore();          // { rev, tokens } — last known full override set
  var lastRev = current.rev;
  var channel = null;
  var changeCbs = [];

  function notifyChange(tokens) {
    for (var i = 0; i < changeCbs.length; i++) {
      try { changeCbs[i](tokens); } catch (e) { /* ignore */ }
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────
  var API = {
    DEFAULT_TOKENS: DEFAULT_TOKENS,

    // Read the resolved current value of a token (override if set, else CSS default).
    get: function (name) {
      if (current.tokens[name] != null) return current.tokens[name];
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    },

    // Apply a map of overrides without persisting/broadcasting (used by bootstrap).
    apply: apply,

    // Load persisted overrides and apply them. Idempotent.
    load: function () {
      current = readStore();
      lastRev = current.rev;
      apply(current.tokens);
      return current.tokens;
    },

    // Editor path: merge partial overrides, persist, apply locally, broadcast.
    set: function (partial) {
      if (!partial) return;
      for (var k in partial) {
        if (Object.prototype.hasOwnProperty.call(partial, k)) {
          if (partial[k] === null) { delete current.tokens[k]; }
          else { current.tokens[k] = partial[k]; }
        }
      }
      lastRev += 1;
      current.rev = lastRev;
      writeStore(lastRev, current.tokens);
      apply(partial);
      broadcast(lastRev, current.tokens);
      notifyChange(current.tokens);
    },

    // Clear one override (back to CSS default) or all overrides.
    reset: function (name) {
      var root = document.documentElement;
      if (name) {
        delete current.tokens[name];
        root.style.removeProperty(name);
      } else {
        for (var k in current.tokens) {
          if (Object.prototype.hasOwnProperty.call(current.tokens, k)) root.style.removeProperty(k);
        }
        current.tokens = {};
      }
      lastRev += 1;
      current.rev = lastRev;
      writeStore(lastRev, current.tokens);
      broadcast(lastRev, current.tokens);
      notifyChange(current.tokens);
    },

    // Current full override set (copy).
    overrides: function () {
      var out = {};
      for (var k in current.tokens) {
        if (Object.prototype.hasOwnProperty.call(current.tokens, k)) out[k] = current.tokens[k];
      }
      return out;
    },

    // Attach live transports (call once per page, after DOM ready is fine).
    subscribe: function () {
      if (typeof BroadcastChannel !== 'undefined' && !channel) {
        try {
          channel = new BroadcastChannel(CHANNEL_NAME);
          channel.onmessage = function (ev) { receive(ev.data); };
        } catch (e) { channel = null; }
      }
      // storage event = free fallback; fires only in OTHER tabs.
      global.addEventListener('storage', function (ev) {
        if (ev.key !== STORAGE_KEY || !ev.newValue) return;
        try { receive(JSON.parse(ev.newValue)); } catch (e) { /* ignore */ }
      });
      return API;
    },

    onChange: function (cb) { if (typeof cb === 'function') changeCbs.push(cb); return API; }
  };

  function broadcast(rev, tokens) {
    if (channel) {
      try { channel.postMessage({ rev: rev, tokens: tokens }); } catch (e) { /* ignore */ }
    }
  }

  // Incoming message from another tab (BroadcastChannel or storage). Apply the
  // full token set only if newer than what we've applied. Tokens removed in the
  // newer set get cleared so resets propagate.
  function receive(msg) {
    if (!msg || typeof msg.rev !== 'number' || msg.rev <= lastRev) return;
    var root = document.documentElement;
    // Clear keys that existed before but are gone now (a reset elsewhere).
    for (var old in current.tokens) {
      if (Object.prototype.hasOwnProperty.call(current.tokens, old) &&
          !(msg.tokens && Object.prototype.hasOwnProperty.call(msg.tokens, old))) {
        root.style.removeProperty(old);
      }
    }
    current.tokens = msg.tokens || {};
    lastRev = msg.rev;
    current.rev = msg.rev;
    apply(current.tokens);
    notifyChange(current.tokens);
  }

  global.PremodelTokens = API;
})(window);
