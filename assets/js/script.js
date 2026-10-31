// Henry Pham Duc — landing page
// Tiny enhancements: current year, smooth-scroll offset for sticky header.

(function () {
  'use strict';

  // Current year in footer
  var y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());

  // Platform mindmap: centre the diagram when it overflows on narrow screens
  var mapWrap = document.querySelector('.platform-map-wrap');
  function centerMap() {
    if (!mapWrap) return;
    var overflow = mapWrap.scrollWidth - mapWrap.clientWidth;
    if (overflow > 0) mapWrap.scrollLeft = overflow / 2;
  }
  centerMap();
  window.addEventListener('resize', centerMap);

  // Smooth-scroll offset for sticky header
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id && id.length > 1) {
        var target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          var headerH = 64;
          var top = target.getBoundingClientRect().top + window.pageYOffset - headerH - 8;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      }
    });
  });
})();
