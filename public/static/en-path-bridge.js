(function(){
  // On English pages, expose the equivalent Spanish path and ensure the
  // language switcher points to /es/*.
  var original = location.pathname;
  // Some upstream links are language-less (/tax/) - treat them as /en/*.
  var normalized = original;
  if (!normalized.startsWith('/en/') && !normalized.startsWith('/es/')) {
    normalized = '/en' + (normalized.startsWith('/') ? normalized : '/' + normalized);
  }
  var esPath = normalized.replace(/^\/en\b/, '/es');
  if (!esPath.startsWith('/es')) {
    esPath = '/es/';
  }
  window.__mrzEsPath = esPath;

  function updateLangSwitcher(){
    var links = Array.prototype.slice.call(document.querySelectorAll('a'));
    links.forEach(function(a){
      var text = (a.textContent || '').trim().toUpperCase();
      if (text === 'EN' || text === 'ES' || text === 'RU' || text === 'RUS' || text === 'РУ' || text === 'РУС') {
        a.textContent = 'ES';
        // Force absolute Spanish path for current page
        a.setAttribute('href', window.__mrzEsPath || '/es/');
        a.setAttribute('data-lang-switch', 'es');
        a.addEventListener('click', function(ev){
          ev.preventDefault();
          window.location.assign(window.__mrzEsPath || '/es/');
        }, { capture: true });
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
