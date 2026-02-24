(function(){
  var SELECTOR = '#__layout > div > div.wrapper.dark.fullheight > div > div.bodySlides > div:nth-child(14) > div > div.description > p';
  var NEW_TEXT = 'Regional projects hold significant importance for us. We are committed to boarding the first available flight, regardless of weather, to reach your desired location. Tasks may be spread across various cities in Costa Rica at the same time.';
  var FOOTER_SELECTOR = '#__layout > div > div.wrapper.dark.fullheight > div > div.bodySlides > div.frame.frame-footer';
  var FOOTER_LOGO_TEXT = 'MRZ LEGAL';
  var FOOTER_DESIGNED_TEXT = 'Designed by Jose Navarro';
  var HOME_URL = '/';
  var CONTACT_PHONE_EMAIL_SELECTOR = '#text > p:nth-child(1)';
  var CONTACT_ADDRESS_LINE1_SELECTOR = '#text > p:nth-child(2)';
  var CONTACT_ADDRESS_LINE2_SELECTOR = '#text > p:nth-child(3)';
  var CONTACT_OVERLAY_ID = 'mrz-contact-overlay';
  var CONTACT_PHONE_EMAIL_TEXT = '+506 2278 0392 - info@mrzlegal.com';
  var CONTACT_ADDRESS_LINE1_TEXT = 'Cartago, Tejar del Guarco, Valle Illios, uno – ciento dos';
  var CONTACT_ADDRESS_LINE2_TEXT = '';
  var CONTACT_FOOTER_BUTTON_SELECTOR = '#__layout > div > div.wrapper.fullheight > footer > div.callback.shine';
  var CONTACT_LOGO_SELECTOR = '#__layout > div > div.wrapper.fullheight > header > nav > ul';
  var CONTACT_HEADER_SELECTOR = '#__layout > div > div.wrapper.fullheight > header';
  var HOME_PARAGRAPH_SELECTOR = '#__layout > div > div.wrapper.dark.fullheight > div > div.bodySlides > div:nth-child(14) > div > div.description > p';
  var HOME_PARAGRAPH_TEXT = 'Regional projects hold significant importance for us. We are committed to boarding the first available flight, regardless of weather, to reach your desired location. Tasks may be spread across various cities in Costa Rica at the same time.';
  var MAP_CONTAINER_SELECTOR = '#map';
  var MAP_TARGET_SELECTOR = '#map > div > div.gm-style > div:nth-child(1) > div:nth-child(2)';
  var MAP_LAT = 9.845519943232729;
  var MAP_LON = -83.96499953547801;
  var MAP_ZOOM = 17;
  var getTileUrl = function(lat, lon, zoom){
    var x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
    var y = Math.floor(
      (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
        2 *
        Math.pow(2, zoom)
    );
    return 'https://tile.openstreetmap.org/' + zoom + '/' + x + '/' + y + '.png';
  };
  var MAP_URL = getTileUrl(MAP_LAT, MAP_LON, MAP_ZOOM);
  var MAP_LINK_URL = 'https://www.openstreetmap.org/?mlat=9.845519943232729&mlon=-83.96499953547801#map=17/9.845519943232729/-83.96499953547801';

  var ensureFooterStyles = function(){
    if (document.getElementById('mrz-footer-style')) {
      return;
    }
    var style = document.createElement('style');
    style.id = 'mrz-footer-style';
    style.textContent = '.mrz-footer-logo{font-weight:600;letter-spacing:2px;text-transform:uppercase;color:inherit;text-decoration:none;}';
    document.head.appendChild(style);
  };

  var ensureMapStyles = function(){
    if (document.getElementById('mrz-map-style')) {
      return;
    }
    var style = document.createElement('style');
    style.id = 'mrz-map-style';
    style.textContent = '#map { filter: grayscale(100%) contrast(140%) brightness(110%); background-color: #ffffff; position: relative; min-height: 100vh; width: 100%; height: 100%; background-repeat: repeat; background-size: 512px 512px; z-index:0; } #map iframe { display:none !important; } #mrz-contact-overlay{position:absolute;left:50%;top:55%;transform:translate(-50%,-50%);text-align:center;font-size:16px;line-height:1.4;color:#000;text-transform:uppercase;letter-spacing:1px;} #mrz-contact-overlay .line{display:block;background:#111;color:#fff;padding:3px 10px;margin:4px 0;} .wrapper.fullheight > header { position: fixed !important; top: 0; left: 0; right: 0; z-index: 30 !important; display: block !important; opacity: 1 !important; visibility: visible !important; } .wrapper.fullheight > header nav, .wrapper.fullheight > header nav ul { display: flex !important; opacity: 1 !important; visibility: visible !important; } .wrapper.fullheight > header nav ul li { display: block !important; } @media (max-width: 900px){ .wrapper.fullheight > header nav ul { display: none !important; } .wrapper.fullheight > header button, .wrapper.fullheight > header .hamburger, .wrapper.fullheight > header .menu, .wrapper.fullheight > header .menu-button, .wrapper.fullheight > header .nav-mobile__toggle { display: block !important; opacity: 1 !important; visibility: visible !important; } #mrz-swipe-hint{position:fixed;left:50%;top:65%;transform:translate(-50%,-50%);font-family:"Wagon",serif;letter-spacing:2px;text-transform:uppercase;font-size:12px;color:#fff;opacity:0.85;pointer-events:none;display:flex;align-items:center;gap:8px;z-index:40;} #mrz-swipe-hint .arrow{display:inline-block;width:22px;height:1px;background:#fff;position:relative;} #mrz-swipe-hint .arrow:after{content:"";position:absolute;right:-2px;top:-3px;width:6px;height:6px;border-right:1px solid #fff;border-top:1px solid #fff;transform:rotate(45deg);} @keyframes mrz-swipe{0%{transform:translate(-50%,-50%) translateX(10px);opacity:0;} 30%{opacity:0.85;} 70%{opacity:0.85;} 100%{transform:translate(-50%,-50%) translateX(-20px);opacity:0;}} #mrz-swipe-hint{animation:mrz-swipe 2.2s ease-in-out infinite;}
 }';
    document.head.appendChild(style);
  };

  var ensureSwipeHintStyles = function(){
    if (document.getElementById('mrz-swipe-hint-style')) {
      return;
    }
    var style = document.createElement('style');
    style.id = 'mrz-swipe-hint-style';
    style.textContent = '@media (max-width: 900px){#mrz-swipe-hint{position:fixed;left:50%;top:70%;transform:translate(-50%,-50%);font-family:"Wagon",serif;letter-spacing:2px;text-transform:uppercase;font-size:12px;color:#fff;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.6);padding:8px 12px;border-radius:999px;opacity:1;pointer-events:none;display:flex;align-items:center;gap:8px;z-index:99999;}#mrz-swipe-hint .arrow{display:inline-block;width:22px;height:1px;background:#fff;position:relative;}#mrz-swipe-hint .arrow:after{content:"";position:absolute;right:-2px;top:-3px;width:6px;height:6px;border-right:1px solid #fff;border-top:1px solid #fff;transform:rotate(45deg);}#mrz-swipe-hint{} }';
    document.head.appendChild(style);
  };

  var updateParagraph = function(){
    var el = document.querySelector(SELECTOR);
    if (el) {
      el.textContent = NEW_TEXT;
      return true;
    }
    var candidates = document.querySelectorAll('p');
    for (var i = 0; i < candidates.length; i += 1) {
      var text = candidates[i].textContent || '';
      if (text.indexOf('Regional projects hold significant importance') !== -1) {
        candidates[i].textContent = NEW_TEXT;
        return true;
      }
    }
    return false;
  };

  var updateSwipeHint = function(){
    if (!/^(\/|\/en\/?|\/es\/?$)/.test(location.pathname)) {
      return false;
    }
    if (!window.matchMedia || !window.matchMedia('(max-width: 900px)').matches) {
      return false;
    }
    ensureSwipeHintStyles();
    if (document.getElementById('mrz-swipe-hint')) {
      return true;
    }
    var hint = document.createElement('div');
    hint.id = 'mrz-swipe-hint';
    hint.innerHTML = '<span>Swipe left</span><span class="arrow"></span>';
    hint.style.cssText = 'position:fixed;left:50%;top:70%;transform:translate(-50%,-50%);font-family:"Wagon",serif;letter-spacing:2px;text-transform:uppercase;font-size:12px;color:#fff;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.6);padding:8px 12px;border-radius:999px;opacity:1;pointer-events:none;display:flex;align-items:center;gap:8px;z-index:99999;';
    (document.body || document.documentElement).appendChild(hint);
    return true;
  };

  var updateFooter = function(){
    var footer = document.querySelector(FOOTER_SELECTOR);
    if (!footer) {
      return false;
    }
    ensureFooterStyles();

    var logoTarget = footer.querySelector('#ALS_logo_svg') || footer.querySelector('img');
    if (logoTarget) {
      var logoLink = document.createElement('a');
      logoLink.href = HOME_URL;
      var span = document.createElement('span');
      span.className = 'mrz-footer-logo';
      span.textContent = FOOTER_LOGO_TEXT;
      logoLink.appendChild(span);
      logoTarget.replaceWith(logoLink);
    }

    var designedLinkTarget = footer.querySelector('#__layout > div > div.wrapper.dark.fullheight > div > div.bodySlides > div.frame.frame-footer > div.footer--als > span:nth-child(1) > a') || footer.querySelector('a');
    if (designedLinkTarget && /art\.?\s*lebedev/i.test(designedLinkTarget.textContent || '')) {
      designedLinkTarget.textContent = FOOTER_DESIGNED_TEXT;
      designedLinkTarget.href = HOME_URL;
      designedLinkTarget.style.color = 'inherit';
      designedLinkTarget.style.textDecoration = 'none';
    } else {
      var walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT, null);
      var designedNode = null;
      while (walker.nextNode()) {
        var t = walker.currentNode;
        if (t.nodeValue && /designed\s*by\s*art\.?\s*lebedev\s*studio/i.test(t.nodeValue)) {
          designedNode = t;
          break;
        }
      }
      if (designedNode) {
        var parent = designedNode.parentElement;
        var designedLink = document.createElement('a');
        designedLink.href = HOME_URL;
        designedLink.textContent = FOOTER_DESIGNED_TEXT;
        designedLink.style.color = 'inherit';
        designedLink.style.textDecoration = 'none';
        parent.replaceChild(designedLink, designedNode);
      }
    }

    return true;
  };

  var updateContacts = function(){
    var updated = false;
    if (!/\/contacts\/?$/.test(location.pathname)) {
      return false;
    }
    var phoneEl = document.querySelector(CONTACT_PHONE_EMAIL_SELECTOR);
    if (phoneEl) {
      phoneEl.textContent = CONTACT_PHONE_EMAIL_TEXT;
      updated = true;
    }
    var addr1El = document.querySelector(CONTACT_ADDRESS_LINE1_SELECTOR);
    if (addr1El) {
      if (CONTACT_ADDRESS_LINE1_TEXT) {
        addr1El.textContent = CONTACT_ADDRESS_LINE1_TEXT;
      } else {
        addr1El.textContent = '';
      }
      updated = true;
    }
    var addr2El = document.querySelector(CONTACT_ADDRESS_LINE2_SELECTOR);
    if (addr2El) {
      if (CONTACT_ADDRESS_LINE2_TEXT) {
        addr2El.textContent = CONTACT_ADDRESS_LINE2_TEXT;
      } else {
        addr2El.textContent = '';
      }
      updated = true;
    }
    return updated;
  };

  var updateMap = function(){
    var updated = false;
    if (!/\/contacts\/?$/.test(location.pathname)) {
      return false;
    }
    var mapContainer = document.querySelector(MAP_CONTAINER_SELECTOR);
    if (!mapContainer) {
      return false;
    }
    ensureMapStyles();
    if (!mapContainer.dataset.mrzMapSet) {
      mapContainer.innerHTML = '';
      mapContainer.dataset.mrzMapSet = 'true';
      updated = true;
    }
    mapContainer.style.backgroundImage = 'url(' + MAP_URL + ')';
    mapContainer.style.backgroundSize = '512px 512px';
    mapContainer.style.backgroundRepeat = 'repeat';
    mapContainer.style.backgroundPosition = 'center';
    mapContainer.style.minHeight = '100vh';
    mapContainer.style.width = '100%';
    mapContainer.style.height = '100%';
    mapContainer.style.zIndex = '0';
    var parent = mapContainer.parentElement;
    if (parent && parent.style) {
      parent.style.minHeight = '100vh';
      parent.style.height = '100%';
      parent.style.backgroundImage = 'url(' + MAP_URL + ')';
      parent.style.backgroundSize = '512px 512px';
      parent.style.backgroundRepeat = 'repeat';
      parent.style.backgroundPosition = 'center';
    }
    updated = true;

    var iframe = mapContainer.querySelector('iframe');
    if (iframe) {
      iframe.remove();
      updated = true;
    }

    var overlay = document.getElementById(CONTACT_OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = CONTACT_OVERLAY_ID;
      mapContainer.appendChild(overlay);
    }
    overlay.innerHTML = '<span class="line">' + CONTACT_PHONE_EMAIL_TEXT + '</span><span class="line">' + CONTACT_ADDRESS_LINE1_TEXT + '</span>';

    var footerButton = document.querySelector(CONTACT_FOOTER_BUTTON_SELECTOR);
    if (footerButton) {
      footerButton.style.position = 'relative';
      footerButton.style.zIndex = '20';
      footerButton.style.display = 'inline-flex';
      updated = true;
    }

    var header = document.querySelector(CONTACT_HEADER_SELECTOR);
    if (header) {
      header.style.position = 'relative';
      header.style.zIndex = '20';
      updated = true;
    }

    var logo = document.querySelector(CONTACT_LOGO_SELECTOR);
    if (logo) {
      logo.style.position = 'relative';
      logo.style.zIndex = '20';
      logo.style.display = 'flex';
      logo.style.opacity = '1';
      logo.style.visibility = 'visible';
      updated = true;
    }

    var menuButton = header?.querySelector('button, .hamburger, .menu, .menu-button, .nav-mobile__toggle');
    if (menuButton) {
      menuButton.style.position = 'relative';
      menuButton.style.zIndex = '20';
      menuButton.style.display = 'block';
      updated = true;
    }

    var navList = document.querySelector(CONTACT_LOGO_SELECTOR);
    if (navList) {
      navList.style.display = 'flex';
      navList.style.position = 'relative';
      navList.style.zIndex = '20';
      navList.style.opacity = '1';
      navList.style.visibility = 'visible';
      updated = true;
    }

    return updated;
  };

  var tries = 0;
  var maxTries = 60;
  var apply = function(){
    var updatedParagraph = updateParagraph();
    var updatedFooter = updateFooter();
    var updatedContacts = updateContacts();
    var updatedMap = updateMap();
    var updatedHint = updateSwipeHint();
    return updatedParagraph || updatedFooter || updatedContacts || updatedMap || updatedHint;
  };
  var tick = function(){
    tries += 1;
    apply();
    if (tries >= maxTries) {
      clearInterval(timer);
    }
  };
  var timer = setInterval(tick, 500);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
