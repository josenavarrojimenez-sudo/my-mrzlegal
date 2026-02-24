(function(){
  // On English pages, expose the equivalent Spanish path and ensure the
  // language switcher points to /es/*.
  var original = location.pathname;

  // Build equivalent /es/* path for the CURRENT page.
  // If we are already on /en/* -> /es/*
  // If we are on language-less paths like /tax/ -> assume /en/tax/ -> /es/tax/
  var normalized = original;
  if (normalized === '/' || normalized === '') {
    normalized = '/en/';
  }
  if (!normalized.startsWith('/en/') && !normalized.startsWith('/es/')) {
    normalized = '/en' + (normalized.startsWith('/') ? normalized : '/' + normalized);
  }

  var esPath = normalized.replace(/^\/en\b/, '/es');
  if (!esPath.startsWith('/es/')) {
    esPath = '/es/';
  }
  window.__mrzEsPath = esPath;

  function updateLangSwitcher(){
    var links = Array.prototype.slice.call(document.querySelectorAll('a'));
    links.forEach(function(a){
      var text = (a.textContent || '').trim().toUpperCase();
      if (text === 'EN' || text === 'ES' || text === 'RU' || text === 'RUS' || text === 'РУ' || text === 'РУС') {
        a.textContent = 'ES';
        // Force absolute Spanish path for CURRENT page (equivalent route)
        a.setAttribute('href', window.__mrzEsPath || '/es/');
        a.setAttribute('data-lang-switch', 'es');
        a.setAttribute('hreflang', 'es');
        a.setAttribute('lang', 'es');
        a.setAttribute('aria-label', 'Español');
        a.setAttribute('title', 'Español');
        a.addEventListener(
          'click',
          function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            window.location.assign(window.__mrzEsPath || '/es/');
          },
          { capture: true }
        );
      }
    });
  }

  updateLangSwitcher();
  document.addEventListener('DOMContentLoaded', updateLangSwitcher);
  var tries = 0;
  var interval = setInterval(function(){
    updateLangSwitcher();
    tries++;
    if (tries > 20) clearInterval(interval);
  }, 500);
})();
