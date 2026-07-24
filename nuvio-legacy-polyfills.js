// Legacy Chromium 53 compatibility for Nuvio on LG webOS 4.x
(function () {
  'use strict';

  if (window.Promise && !Promise.prototype.finally) {
    Promise.prototype.finally = function (onFinally) {
      var P = this.constructor || Promise;
      return this.then(function (value) {
        return P.resolve(typeof onFinally === 'function' ? onFinally() : onFinally)
          .then(function () { return value; });
      }, function (reason) {
        return P.resolve(typeof onFinally === 'function' ? onFinally() : onFinally)
          .then(function () { throw reason; });
      });
    };
  }
  if (window.Promise && !Promise.allSettled) {
    Promise.allSettled = function (items) {
      return Promise.all([].map.call(items, function (item) {
        return Promise.resolve(item).then(function (value) {
          return { status: 'fulfilled', value: value };
        }, function (reason) { return { status: 'rejected', reason: reason }; });
      }));
    };
  }
  if (window.Promise && !Promise.any) {
    Promise.any = function (items) {
      return new Promise(function (resolve, reject) {
        var list = [].slice.call(items), errors = [], left = list.length;
        if (!left) return reject(new Error('All promises were rejected'));
        list.forEach(function (item, i) {
          Promise.resolve(item).then(resolve, function (error) {
            errors[i] = error;
            if (!--left) { var e = new Error('All promises were rejected'); e.errors = errors; reject(e); }
          });
        });
      });
    };
  }
  if (!Object.values) Object.values = function (obj) { return Object.keys(obj).map(function (k) { return obj[k]; }); };
  if (!Object.entries) Object.entries = function (obj) { return Object.keys(obj).map(function (k) { return [k, obj[k]]; }); };
  if (!Object.fromEntries) Object.fromEntries = function (items) { var out = {}; [].forEach.call(items, function (x) { out[x[0]] = x[1]; }); return out; };
  if (!Array.prototype.includes) Array.prototype.includes = function (x, start) { return this.indexOf(x, start || 0) !== -1; };
  if (!String.prototype.includes) String.prototype.includes = function (x, start) { return this.indexOf(x, start || 0) !== -1; };
  if (!String.prototype.startsWith) String.prototype.startsWith = function (x, start) { return this.substr(start || 0, x.length) === x; };
  if (!String.prototype.endsWith) String.prototype.endsWith = function (x, len) { len = len == null ? this.length : len; return this.substring(len - x.length, len) === x; };
  if (!String.prototype.padStart) String.prototype.padStart = function (n, fill) { fill = fill == null ? ' ' : String(fill); var s = String(this); while (s.length < n) s = fill + s; return s.slice(-n); };
  if (!String.prototype.padEnd) String.prototype.padEnd = function (n, fill) { fill = fill == null ? ' ' : String(fill); var s = String(this); while (s.length < n) s += fill; return s.slice(0, n); };
  if (window.NodeList && !NodeList.prototype.forEach) NodeList.prototype.forEach = Array.prototype.forEach;
  if (window.Element && !Element.prototype.matches) Element.prototype.matches = Element.prototype.webkitMatchesSelector;
  if (window.Element && !Element.prototype.closest) Element.prototype.closest = function (selector) { var e = this; while (e) { if (e.matches(selector)) return e; e = e.parentElement; } return null; };

  // Chrome 53 ClientRect exposes left/top but not x/y. Nuvio spatial navigation uses x/y.
  try {
    var rectProto = Object.getPrototypeOf(document.documentElement.getBoundingClientRect());
    if (rectProto && !('x' in rectProto)) Object.defineProperty(rectProto, 'x', { configurable: true, get: function () { return this.left; } });
    if (rectProto && !('y' in rectProto)) Object.defineProperty(rectProto, 'y', { configurable: true, get: function () { return this.top; } });
  } catch (e) {}

  if (!window.AbortController) {
    window.AbortController = function () {
      var listeners = [];
      this.signal = {
        aborted: false,
        addEventListener: function (type, fn) { if (type === 'abort') listeners.push(fn); },
        removeEventListener: function (type, fn) { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }
      };
      this.abort = function () { if (this.signal.aborted) return; this.signal.aborted = true; listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); };
    };
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = function (callback) { this.observe = function (el) { if (callback) callback([{ target: el, contentRect: el.getBoundingClientRect() }]); }; this.unobserve = function () {}; this.disconnect = function () {}; };
  }
  if (!window.requestAnimationFrame) window.requestAnimationFrame = function (fn) { return setTimeout(fn, 16); };
  if (!window.cancelAnimationFrame) window.cancelAnimationFrame = clearTimeout;

  // Legacy TV quick catalog manager: Nuvio normally exposes three focus targets
  // per row (up/down/toggle). On the slow webOS focus engine this makes the
  // 52-row screen nearly unusable. Keep only one large Enable/Disable target.
  function optimizeCatalogManager() {
    var cards = document.querySelectorAll('.catalog-order-card');
    if (!cards.length) return;
    [].forEach.call(cards, function (card) {
      var toggle = card.querySelector('.catalog-order-toggle');
      var actions = card.querySelectorAll('.catalog-order-action:not(.catalog-order-toggle)');
      [].forEach.call(actions, function (button) {
        button.classList.remove('catalog-order-focusable', 'focused');
        button.setAttribute('aria-hidden', 'true');
        button.tabIndex = -1;
      });
      if (!toggle) return;
      toggle.classList.add('nuvio-legacy-catalog-toggle');
      toggle.setAttribute('aria-label', (toggle.textContent || '').trim() + ' catalog');
      if (!card.getAttribute('data-nuvio-legacy-ready')) {
        card.setAttribute('data-nuvio-legacy-ready', '1');
        card.addEventListener('click', function (event) {
          if (event.target && event.target.closest && event.target.closest('button')) return;
          var currentToggle = card.querySelector('.catalog-order-toggle');
          if (currentToggle) currentToggle.click();
        });
      }
    });
    var oldFocused = document.querySelector('.catalog-order-action.focused:not(.catalog-order-toggle)');
    if (oldFocused) {
      oldFocused.classList.remove('focused');
      var replacement = oldFocused.parentElement && oldFocused.parentElement.querySelector('.catalog-order-toggle');
      if (replacement) replacement.classList.add('focused');
    }
  }
  var catalogOptimizeTimer = null;
  function scheduleCatalogOptimize() {
    if (catalogOptimizeTimer) return;
    catalogOptimizeTimer = setTimeout(function () {
      catalogOptimizeTimer = null;
      optimizeCatalogManager();
    }, 80);
  }
  if (window.MutationObserver) {
    new MutationObserver(scheduleCatalogOptimize).observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener('DOMContentLoaded', scheduleCatalogOptimize);
})();
