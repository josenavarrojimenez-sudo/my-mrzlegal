(function(){
  const MAX_BATCH_ITEMS = 40;
  const MAX_BATCH_CHARS = 3500;
  const cache = window.__mrzTranslateCache || (window.__mrzTranslateCache = new Map());
  const pending = new Set();

  const shouldSkipNode = (node) => {
    if (!node || !node.parentElement) return true;
    const tag = node.parentElement.tagName;
    return ['SCRIPT','STYLE','NOSCRIPT','IFRAME','SVG','PATH'].includes(tag);
  };

  const collectItems = () => {
    const items = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const raw = node.nodeValue || '';
      // Preserve original spacing/line breaks by translating the full node value,
      // but skip nodes that are only whitespace.
      if (!raw.trim()) continue;
      if (raw.trim().length < 2) continue;
      items.push({ type: 'text', node, value: raw, raw });
    }
    const attrTargets = document.querySelectorAll('[title],[aria-label],[placeholder]');
    attrTargets.forEach((el) => {
      ['title','aria-label','placeholder'].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value && value.trim().length > 1) {
          items.push({ type: 'attr', node: el, attr, value: value.trim() });
        }
      });
    });
    return items;
  };

  const applyTranslation = (item, translated) => {
    if (!translated) return;
    if (item.type === 'text') {
      item.node.nodeValue = translated;
      return;
    }
    if (item.type === 'attr') {
      item.node.setAttribute(item.attr, translated);
    }
  };

  const translateBatch = async (items) => {
    const toTranslate = [];
    const mapping = new Map();
    items.forEach((item) => {
      if (cache.has(item.value)) {
        applyTranslation(item, cache.get(item.value));
        return;
      }
      if (pending.has(item.value)) {
        return;
      }
      pending.add(item.value);
      if (!mapping.has(item.value)) {
        mapping.set(item.value, []);
        toTranslate.push(item.value);
      }
      mapping.get(item.value).push(item);
    });
    if (!toTranslate.length) return;

    let index = 0;
    while (index < toTranslate.length) {
      let batch = [];
      let total = 0;
      while (index < toTranslate.length && batch.length < MAX_BATCH_ITEMS) {
        const next = toTranslate[index];
        if (total + next.length > MAX_BATCH_CHARS && batch.length) {
          break;
        }
        batch.push(next);
        total += next.length;
        index += 1;
      }

      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strings: batch }),
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const translations = data.translations || [];
        translations.forEach((translated, idx) => {
          const original = batch[idx];
          cache.set(original, translated);
          const list = mapping.get(original) || [];
          list.forEach((item) => applyTranslation(item, translated));
          pending.delete(original);
        });
      } catch (err) {
        return;
      }
    }
  };

  const run = () => {
    const items = collectItems();
    translateBatch(items);
    // Keep navigation within Spanish paths
    document.querySelectorAll('a[href]').forEach((el) => {
      const href = el.getAttribute('href');
      if (!href) return;
      // Skip external links, anchors, and non-http protocols
      if (/^(https?:)?\/\//i.test(href) || href.startsWith('#') || /^[a-zA-Z]+:/.test(href)) return;

      // Normalize /en/* links to /es/*
      if (href === '/en' || href === '/en/') {
        el.setAttribute('href', '/es/');
        return;
      }
      if (href.startsWith('/en/')) {
        el.setAttribute('href', '/es/' + href.slice(4));
        return;
      }

      // If link points to root, keep users in /es/
      if (href === '/') {
        el.setAttribute('href', '/es/');
      }
    });
  };

  let debounce;
  const schedule = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(run, 400);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
})();
