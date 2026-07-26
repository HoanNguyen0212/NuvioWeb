(function initBootMetrics(window) {
  "use strict";

  if (window.__NUVIO_BOOT_METRICS__) {
    return;
  }

  var earlyMarks = window.__NUVIO_EARLY_BOOT_MARKS__ || {};
  var metrics = {
    marks: {},
    durations: {}
  };
  var startTime = Number(window.__NUVIO_BOOT_EPOCH__);
  var earlyName;
  if (!isFinite(startTime)) {
    startTime = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }
  for (earlyName in earlyMarks) {
    if (Object.prototype.hasOwnProperty.call(earlyMarks, earlyName)) {
      metrics.marks[earlyName] = Math.max(0, Math.round(Number(earlyMarks[earlyName]) || 0));
    }
  }

  function mark(name) {
    var now;
    var elapsed;
    if (Object.prototype.hasOwnProperty.call(metrics.marks, name)) {
      return metrics.marks[name];
    }
    now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    elapsed = Math.round(now - startTime);
    metrics.marks[name] = elapsed;
    if (typeof console !== "undefined" && console.log) {
      console.log("[boot-metric] " + name + ": " + elapsed + " ms");
    }
    return elapsed;
  }

  function printSummary() {
    if (typeof console !== "undefined") {
      if (console.table && typeof console.table === "function") {
        console.table(metrics.marks);
      } else if (console.log) {
        console.log("[boot-metrics-summary]", JSON.stringify(metrics.marks, null, 2));
      }
    }
  }

  window.__NUVIO_BOOT_METRICS__ = {
    mark: mark,
    printSummary: printSummary,
    getMarks: function getMarks() { return metrics.marks; }
  };

  mark("html-start");
})(window);
