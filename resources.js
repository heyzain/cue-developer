/* Shared local resource rules for Electron and the browser preview. */
(function (root) {
  'use strict';
  const defaults = ['Design', 'Assets', 'Build', 'Other'];
  function categoryName(value) {
    const name = String(value ?? '').trim();
    if (!name || name.length > 40) throw Error('Use a category name between 1 and 40 characters.');
    if (['all', 'discover', 'pinned', 'recent'].includes(name.toLowerCase())) throw Error('Choose a different category name.');
    return name;
  }
  function categories(store) {
    const names = Array.isArray(store.categories) ? [...store.categories] : [...defaults];
    for (const item of store.items || []) if (item.pack) names.push(item.pack);
    names.push('Other');
    const result = [];
    for (const value of names) {
      try { const name = categoryName(value); if (!result.some(x => x.toLowerCase() === name.toLowerCase())) result.push(name); } catch {}
    }
    return result;
  }
  function saveCategory(store, name, previous) {
    name = categoryName(name);
    const names = categories(store);
    if (previous === 'Other') throw Error('Other is the default uncategorized group and cannot be renamed.');
    if (previous && !names.includes(previous)) throw Error('Category no longer exists.');
    if (names.some(x => x !== previous && x.toLowerCase() === name.toLowerCase())) throw Error('That category already exists.');
    store.categories = previous ? names.map(x => x === previous ? name : x) : [...names, name];
    if (previous) store.items = store.items.map(x => x.pack === previous ? {...x, pack:name} : x);
    return store;
  }
  function normalizeUrl(value) {
    const text = String(value ?? '').trim();
    if (!text || text.length > 2048 || /\s/.test(text)) throw Error('Enter a valid website URL.');
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw Error('Use an HTTP or HTTPS URL without credentials.');
    return url.href;
  }
  function titleFromUrl(value) {
    try { return new URL(normalizeUrl(value)).hostname.replace(/^www\./, ''); } catch { return ''; }
  }
  function faviconUrl(value) {
    try {
      const hostname = new URL(normalizeUrl(value)).hostname;
      // Local and private addresses should never be sent to an icon provider.
      if (!hostname.includes('.') || hostname.includes(':') || /^\[|^[\d.]+$/.test(hostname) || /\.(localhost|local|internal|test|invalid)$/i.test(hostname)) return '';
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
    } catch { return ''; }
  }
  const api = {categories, saveCategory, normalizeUrl, titleFromUrl, faviconUrl};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CueResources = api;
})(typeof window === 'undefined' ? globalThis : window);
