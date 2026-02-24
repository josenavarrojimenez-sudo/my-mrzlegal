(function(){
  var original = location.pathname;
  if (original.startsWith('/es')) {
    history.replaceState({}, '', original.replace(/^\/es\b/, '/en'));
    window.__mrzEsOriginalPath = original;
  }
  window.addEventListener('load', function(){
    if (window.__mrzEsOriginalPath) {
      history.replaceState({}, '', window.__mrzEsOriginalPath);
    }
  });
})();
