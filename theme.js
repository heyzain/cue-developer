/* Apply before the stylesheet to avoid a light flash on dark-theme startup. */
(() => {
  'use strict';
  const key = 'cue-theme-v1';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let saved;
  try { saved = localStorage.getItem(key); } catch {}
  let explicit = saved === 'light' || saved === 'dark';
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const dark = theme === 'dark';
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    button.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
    button.querySelector('use').setAttribute('href', dark ? '#icon-sun' : '#icon-moon');
  }
  apply(explicit ? saved : system.matches ? 'dark' : 'light');
  system.addEventListener('change', event => {
    if (!explicit) apply(event.matches ? 'dark' : 'light');
  });
  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.dataset.theme);
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      explicit = true;
      apply(theme);
      try { localStorage.setItem(key, theme); } catch {}
    });
  });
})();
