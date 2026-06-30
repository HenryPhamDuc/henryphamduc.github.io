// Henry Pham Duc — landing page
// Tiny enhancements: current year, smooth-scroll offset for sticky header.

(function () {
  'use strict';

  // Current year in footer
  var y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());

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
