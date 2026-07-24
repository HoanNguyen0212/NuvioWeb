(function () {
  "use strict";

  var stats = {
    version: "legacy-fast-home-v2",
    postersReduced: 0,
    unusedLayersRemoved: 0,
    streamingWarmupDeferred: 0
  };
  window.__NUVIO_LEGACY_FAST_HOME_STATS__ = stats;

  /* Nuvio schedules hls.js + dash.js warmup through requestIdleCallback with a
     2600ms timeout. Parsing both libraries during cold boot blocks this TV's
     main thread for many seconds. Suppress only that one warmup; the player
     still calls loadStreamingLibs() on demand before actual playback. */
  if (typeof window.requestIdleCallback === "function") {
    var nativeRequestIdleCallback = window.requestIdleCallback.bind(window);
    window.requestIdleCallback = function (callback, options) {
      var timeout = options && Number(options.timeout || 0);
      if (!stats.streamingWarmupDeferred && timeout === 2600) {
        stats.streamingWarmupDeferred = 1;
        return -90053;
      }
      return nativeRequestIdleCallback(callback, options);
    };
  }

  function activeLayoutPreferences() {
    try {
      var active = JSON.parse(localStorage.getItem("activeProfileId"));
      var store = JSON.parse(localStorage.getItem("layoutPreferences") || "{}");
      return (store.profiles && store.profiles[String(active)]) || {};
    } catch (_) {
      return {};
    }
  }

  function expandedPosterEffectsDisabled() {
    var prefs = activeLayoutPreferences();
    return prefs.focusedPosterBackdropExpandEnabled !== true &&
      prefs.focusedPosterBackdropTrailerEnabled !== true;
  }

  function reduceTmdbPoster(image) {
    if (!image || !image.classList || !image.classList.contains("content-poster")) {
      return;
    }
    ["src", "data-src"].forEach(function (attribute) {
      var value = image.getAttribute(attribute);
      if (!value || value.indexOf("image.tmdb.org/t/p/") === -1) {
        return;
      }
      var reduced = value.replace(/\/t\/p\/(?:w342|w500|w780)\//, "/t/p/w185/");
      if (reduced !== value) {
        image.setAttribute(attribute, reduced);
        stats.postersReduced += 1;
      }
    });
    image.setAttribute("decoding", "async");
    image.setAttribute("loading", "lazy");
  }

  function removeUnusedExpandedLayers(root) {
    if (!expandedPosterEffectsDisabled() || !root.querySelectorAll) {
      return;
    }
    var selectors = [
      ".home-poster-expanded-backdrop",
      ".home-poster-trailer-layer",
      ".home-poster-expanded-gradient",
      ".home-poster-expanded-brand"
    ].join(",");
    var layers = root.querySelectorAll(selectors);
    Array.prototype.forEach.call(layers, function (layer) {
      if (layer.parentNode) {
        layer.parentNode.removeChild(layer);
        stats.unusedLayersRemoved += 1;
      }
    });
  }

  function optimize(root) {
    if (!root || root.nodeType !== 1) {
      return;
    }
    if (root.matches && root.matches("img.content-poster")) {
      reduceTmdbPoster(root);
    }
    if (root.querySelectorAll) {
      Array.prototype.forEach.call(root.querySelectorAll("img.content-poster"), reduceTmdbPoster);
    }
    removeUnusedExpandedLayers(root);
  }

  var style = document.createElement("style");
  style.id = "nuvio-legacy-fast-home-style";
  style.textContent =
    ".nuvio-legacy-low-power .home-catalog-row{" +
      "contain:layout paint;" +
    "}" +
    ".nuvio-legacy-low-power .home-content-card," +
    ".nuvio-legacy-low-power .home-poster-frame," +
    ".nuvio-legacy-low-power .home-row-track{" +
      "contain:layout paint style;" +
    "}";
  (document.head || document.documentElement).appendChild(style);

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes || [], optimize);
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.body) {
    optimize(document.body);
  }
})();
