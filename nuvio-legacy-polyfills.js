// Legacy Chromium 53 compatibility for Nuvio on LG webOS 4.x
(function () {
  'use strict';

  if (typeof window.globalThis === 'undefined') {
    try {
      Object.defineProperty(window, 'globalThis', { configurable: true, value: window });
    } catch (e) {
      window.globalThis = window;
    }
  }

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
        if (!left) {
          var AggregateErrorClass = window.AggregateError || function (errList, msg) {
            var err = new Error(msg || 'All promises were rejected');
            err.name = 'AggregateError';
            err.errors = errList;
            return err;
          };
          return reject(new AggregateErrorClass([], 'All promises were rejected'));
        }
        list.forEach(function (item, i) {
          Promise.resolve(item).then(resolve, function (error) {
            errors[i] = error;
            if (!--left) {
              var AggregateErrorClass = window.AggregateError || function (errList, msg) {
                var err = new Error(msg || 'All promises were rejected');
                err.name = 'AggregateError';
                err.errors = errList;
                return err;
              };
              reject(new AggregateErrorClass(errors, 'All promises were rejected'));
            }
          });
        });
      });
    };
  }
  if (!Object.values) Object.values = function (obj) { return Object.keys(obj).map(function (k) { return obj[k]; }); };
  if (!Object.entries) Object.entries = function (obj) { return Object.keys(obj).map(function (k) { return [k, obj[k]]; }); };
  if (!Object.fromEntries) Object.fromEntries = function (items) {
    var out = {}, iterator, step, i, entry;
    if (items != null && window.Symbol && Symbol.iterator && typeof items[Symbol.iterator] === 'function') {
      iterator = items[Symbol.iterator]();
      while (!(step = iterator.next()).done) {
        entry = step.value;
        out[entry[0]] = entry[1];
      }
      return out;
    }
    for (i = 0; items && i < items.length; i += 1) {
      entry = items[i];
      out[entry[0]] = entry[1];
    }
    return out;
  };
  if (!Array.prototype.includes) Array.prototype.includes = function (x, start) { return this.indexOf(x, start || 0) !== -1; };
  if (!Array.prototype.flat) Array.prototype.flat = function (depth) {
    var out = [], maxDepth = depth === undefined ? 1 : Math.max(0, Number(depth) || 0);
    function append(input, remaining) {
      for (var i = 0; i < input.length; i += 1) {
        if (!(i in input)) continue;
        var value = input[i];
        if (remaining > 0 && Array.isArray(value)) append(value, remaining - 1);
        else out.push(value);
      }
    }
    append(this, maxDepth);
    return out;
  };
  if (!Array.prototype.flatMap) Array.prototype.flatMap = function (callback, thisArg) {
    if (typeof callback !== 'function') throw new TypeError('flatMap callback must be a function');
    var mapped = [];
    for (var i = 0; i < this.length; i += 1) {
      if (i in this) mapped.push(callback.call(thisArg, this[i], i, this));
    }
    return mapped.flat(1);
  };
  if (!String.prototype.includes) String.prototype.includes = function (x, start) { return this.indexOf(x, start || 0) !== -1; };
  if (!String.prototype.startsWith) String.prototype.startsWith = function (x, start) { return this.substr(start || 0, x.length) === x; };
  if (!String.prototype.endsWith) String.prototype.endsWith = function (x, len) { len = len == null ? this.length : len; return this.substring(len - x.length, len) === x; };
  if (!String.prototype.padStart) String.prototype.padStart = function (n, fill) { fill = fill == null ? ' ' : String(fill); var s = String(this); while (s.length < n) s = fill + s; return s.slice(-n); };
  if (!String.prototype.padEnd) String.prototype.padEnd = function (n, fill) { fill = fill == null ? ' ' : String(fill); var s = String(this); while (s.length < n) s += fill; return s.slice(0, n); };
  if (!String.prototype.replaceAll) String.prototype.replaceAll = function (searchValue, replaceValue) {
    var source = String(this), search = String(searchValue), cursor = 0, index, out = '';
    if (searchValue instanceof RegExp) {
      if (!searchValue.global) throw new TypeError('replaceAll RegExp must be global');
      return source.replace(searchValue, replaceValue);
    }
    if (search === '') {
      for (var j = 0; j <= source.length; j += 1) {
        out += typeof replaceValue === 'function' ? String(replaceValue('', j, source)) : String(replaceValue);
        if (j < source.length) out += source.charAt(j);
      }
      return out;
    }
    while ((index = source.indexOf(search, cursor)) !== -1) {
      out += source.slice(cursor, index);
      out += typeof replaceValue === 'function'
        ? String(replaceValue(search, index, source))
        : String(replaceValue).replace(/\$&/g, search);
      cursor = index + search.length;
    }
    return out + source.slice(cursor);
  };
  if (!String.prototype.trimStart) String.prototype.trimStart = function () { return String(this).replace(/^\s+/, ''); };
  if (!String.prototype.trimEnd) String.prototype.trimEnd = function () { return String(this).replace(/\s+$/, ''); };

  // Chrome 53 has URLSearchParams but does not accept a plain record until Chrome 54.
  // Wrap only that constructor case and retain the native parser/encoder/prototype.
  if (window.URLSearchParams) {
    try {
      var recordSupported = new window.URLSearchParams({ nuvio_test: '1' }).get('nuvio_test') === '1';
      if (!recordSupported) {
        var NativeURLSearchParams = window.URLSearchParams;
        var URLSearchParamsCompat = function (init) {
          var isRecord = init && typeof init === 'object' && !Array.isArray(init) &&
            !(window.Symbol && Symbol.iterator && typeof init[Symbol.iterator] === 'function');
          if (!isRecord) return new NativeURLSearchParams(init);
          var params = new NativeURLSearchParams();
          Object.keys(init).forEach(function (key) { params.append(key, init[key]); });
          return params;
        };
        URLSearchParamsCompat.prototype = NativeURLSearchParams.prototype;
        window.URLSearchParams = URLSearchParamsCompat;
      }
    } catch (e) {}
  }

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
        reason: undefined,
        throwIfAborted: function () {
          if (this.aborted) {
            throw this.reason || new Error('Aborted');
          }
        },
        addEventListener: function (type, fn) { if (type === 'abort') listeners.push(fn); },
        removeEventListener: function (type, fn) { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }
      };
      this.abort = function (reason) {
        if (this.signal.aborted) return;
        this.signal.aborted = true;
        this.signal.reason = reason !== undefined ? reason : new Error('Aborted');
        listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} });
      };
    };
  } else if (window.AbortSignal && !window.AbortSignal.prototype.throwIfAborted) {
    window.AbortSignal.prototype.throwIfAborted = function () {
      if (this.aborted) {
        throw this.reason || new Error('Aborted');
      }
    };
  }

  if (typeof window.queueMicrotask !== 'function') {
    window.queueMicrotask = function (fn) {
      if (typeof fn !== 'function') {
        throw new TypeError('queueMicrotask callback must be a function');
      }
      Promise.resolve().then(fn);
    };
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = function (callback) {
      var targets = [];
      var resizeTimer = null;
      function notify() {
        resizeTimer = null;
        if (typeof callback !== 'function' || !targets.length) return;
        var entries = targets.map(function (el) {
          var rect = el.getBoundingClientRect();
          return {
            target: el,
            contentRect: rect,
            borderBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
            contentBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
            devicePixelContentBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }]
          };
        });
        try { callback(entries, this); } catch (e) {}
      }
      function onWindowResize() {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(notify, 120);
      }
      this.observe = function (el) {
        if (!el || !(el instanceof Element)) return;
        if (targets.indexOf(el) === -1) {
          targets.push(el);
          if (targets.length === 1) {
            window.addEventListener('resize', onWindowResize);
          }
        }
      };
      this.unobserve = function (el) {
        var idx = targets.indexOf(el);
        if (idx >= 0) {
          targets.splice(idx, 1);
          if (!targets.length) {
            window.removeEventListener('resize', onWindowResize);
            if (resizeTimer) { clearTimeout(resizeTimer); resizeTimer = null; }
          }
        }
      };
      this.disconnect = function () {
        targets = [];
        window.removeEventListener('resize', onWindowResize);
        if (resizeTimer) { clearTimeout(resizeTimer); resizeTimer = null; }
      };
    };
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
