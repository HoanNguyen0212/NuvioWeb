(function initBootMetrics(window) {
  "use strict";

  if (window.__NUVIO_BOOT_METRICS__) {
    return;
  }

  var metrics = {
    marks: {},
    durations: {}
  };
  var startTime = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

  function mark(name) {
    var now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    var elapsed = Math.round(now - startTime);
    metrics.marks[name] = elapsed;
    if (typeof console !== "undefined" && console.log) {
      console.log("[boot-metric] " + name + ": " + elapsed + " ms");
    }
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
