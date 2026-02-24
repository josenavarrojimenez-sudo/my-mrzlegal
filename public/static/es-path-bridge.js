(function(){
  var original = location.pathname;
  if (original.startsWith('/es')) {
    var enPath = original.replace(/^\/es\b/, '/en');
    history.replaceState({}, '', enPath);
    window.__mrzEsOriginalPath = original;
    window.__mrzEnPath = enPath;
  }

  function updateLangSwitcher(){
    var enPathValue = window.__mrzEnPath || '/en/';
    var links = Array.prototype.slice.call(document.querySelectorAll('a'));
    links.forEach(function(a){
      var text = (a.textContent || '').trim().toUpperCase();
      if (text === 'EN' || text === 'ES' || text === 'RU' || text === 'RUS' || text === 'РУ' || text === 'РУС' || text === 'PARA HACER') {
        a.textContent = 'EN';
        a.setAttribute('href', enPathValue);
        a.setAttribute('data-lang-switch', 'en');
        a.addEventListener('click', function(ev){
          ev.preventDefault();
          window.location.assign(enPathValue);
        }, { capture: true });
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
