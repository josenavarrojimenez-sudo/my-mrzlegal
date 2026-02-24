(function () {
  const from = /krivitskiy/gi;
  const to = 'MRZ LEGAL';

  const paragraphStart = 'Regional projects hold significant importance';
  const paragraphReplacement =
    'Regional projects hold significant importance for us. We are committed to boarding the first available flight, regardless of weather, to reach your desired location. Tasks may be spread across various cities in Costa Rica at the same time.';

  const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();

  const replaceParagraph = () => {
    const targeted = document.querySelectorAll('div.description p');
    if (targeted.length) {
      targeted.forEach((paragraph) => {
        const text = normalize(paragraph.textContent);
        if (!text) return;
        if (text.includes(paragraphStart)) {
          paragraph.textContent = paragraphReplacement;
        }
      });
      return;
    }
    const paragraphs = document.querySelectorAll('p');
    paragraphs.forEach((paragraph) => {
      const text = normalize(paragraph.textContent);
      if (!text) return;
      if (text.includes(paragraphStart) && (text.includes('Sochi') || text.includes('Sakhalin') || text.includes('Russia'))) {
        paragraph.textContent = paragraphReplacement;
      }
    });
  };

  const replaceText = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (from.test(node.nodeValue)) {
        node.nodeValue = node.nodeValue.replace(from, to);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const el = node;
    ['alt', 'title', 'aria-label', 'placeholder'].forEach((attr) => {
      const value = el.getAttribute(attr);
      if (value && from.test(value)) {
        el.setAttribute(attr, value.replace(from, to));
      }
    });
    el.childNodes.forEach(replaceText);
  };

  const run = () => {
    replaceText(document.body);
    replaceParagraph();
    if (document.title) {
      document.title = document.title.replace(from, to);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'characterData') {
        replaceText(mutation.target);
      }
      mutation.addedNodes.forEach(replaceText);
    });
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
})();
