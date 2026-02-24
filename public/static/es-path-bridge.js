(function(){
  var original = location.pathname;
  if (original.startsWith('/es')) {
    var enPath = original.replace(/^\/es\b/, '/en');
    history.replaceState({}, '', enPath);
    window.__mrzEsOriginalPath = original;
    window.__mrzEnPath = enPath;
  }

  function updateLangSwitcher(){
    // Always compute the equivalent /en/* for the CURRENT page.
    // If we're at /es/ -> /en/
    // If /es/something -> /en/something
    var enPathValue = (function(){
      var p = window.__mrzEnPath;
      if (typeof p === 'string' && p) return p;
      var current = location.pathname || '/es/';
      if (current === '/' || current === '') return '/en/';
      if (current.startsWith('/es')) return current.replace(/^\/es\b/, '/en');
      if (!current.startsWith('/en/')) return '/en' + (current.startsWith('/') ? current : '/' + current);
      return current;
    })();
    var links = Array.prototype.slice.call(document.querySelectorAll('a'));
    links.forEach(function(a){
      var text = (a.textContent || '').trim().toUpperCase();
      // Force language toggle on /es/* to be ONLY "EN" and always point to the equivalent /en/* route.
      // Upstream sometimes renders it as RU/RUS/РУ/РУС or translated text (e.g. "PARA HACER").
      if (text === 'EN' || text === 'ES' || text === 'RU' || text === 'RUS' || text === 'РУ' || text === 'РУС' || text === 'PARA HACER' || text === 'TO DO') {
        a.textContent = 'EN';
        a.setAttribute('href', enPathValue);
        a.setAttribute('data-lang-switch', 'en');
        a.setAttribute('hreflang', 'en');
        a.setAttribute('lang', 'en');
        a.setAttribute('aria-label', 'English');
        a.setAttribute('title', 'English');

        // Capture-phase: beat Nuxt/router handlers and prevent RU navigation.
        a.addEventListener(
          'click',
          function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            window.location.assign(enPathValue);
          },
          { capture: true }
        );
      }
    });
  }

  // Run early and keep updating because Nuxt may re-render header
  updateLangSwitcher();
  document.addEventListener('DOMContentLoaded', updateLangSwitcher);
  var tries = 0;
  var interval = setInterval(function(){
    updateLangSwitcher();
    tries++;
    if (tries > 20) clearInterval(interval);
  }, 500);

  window.addEventListener('load', function(){
    if (window.__mrzEsOriginalPath) {
      history.replaceState({}, '', window.__mrzEsOriginalPath);
    }
    updateLangSwitcher();
  });
})();
