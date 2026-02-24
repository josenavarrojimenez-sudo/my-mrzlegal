(function(){
  // On English pages, expose the equivalent Spanish path and ensure the
  // language switcher points to /es/*.
  var original = location.pathname;
  var esPath = original.replace(/^\/en\b/, '/es');
  if (!esPath.startsWith('/es')) {
    esPath = '/es/';
  }
  window.__mrzEsPath = esPath;

  function updateLangSwitcher(){
    var links = Array.prototype.slice.call(document.querySelectorAll('a'));
    links.forEach(function(a){
      var text = (a.textContent || '').trim().toUpperCase();
      if (text === 'EN' || text === 'ES') {
        a.textContent = 'ES';
        a.setAttribute('href', window.__mrzEsPath || '/es/');
        a.setAttribute('data-lang-switch', 'es');
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
