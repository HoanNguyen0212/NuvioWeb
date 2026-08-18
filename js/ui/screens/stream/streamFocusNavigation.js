function recordStreamFocusMetric(name) {
  if (!globalThis.__NUVIO_DEBUG_LEGACY_METRICS__) {
    return;
  }
  const root = globalThis.__NUVIO_LEGACY_METRICS__ || (globalThis.__NUVIO_LEGACY_METRICS__ = {});
  const stream = root.stream || (root.stream = {});
  stream[name] = Number(stream[name] || 0) + 1;
}

export function invalidateStreamFocusNavigation(owner, { clearFocusedElement = false } = {}) {
  owner._focusListsCache = null;
  if (clearFocusedElement) {
    owner.focusedElement = null;
  }
}

export function getStreamFocusLists(owner) {
  const cache = owner._focusListsCache;
  if (cache) {
    return cache;
  }

  const container = owner.container;
  const chips = Array.from(container?.querySelectorAll(".stream-route-chip.focusable") || []);
  const rows = Array.from(
    container?.querySelectorAll(".stream-route-card-row[data-stream-row]") || []
  )
    .map((rowNode) => ({
      row: Number(rowNode.dataset.streamRow || 0),
      play: rowNode.querySelector('[data-card-action="play"]'),
      native: rowNode.querySelector('[data-card-action="native"]')
    }))
    .filter((row) => row.play || row.native);

  owner._focusListsCache = { chips, rows };
  recordStreamFocusMetric("focusCacheBuildCount");
  return owner._focusListsCache;
}

export function focusStreamElement(owner, target) {
  if (!target || !owner.container) {
    return false;
  }

  let previous = owner.focusedElement;
  if (
    !previous ||
    !owner.container.contains(previous) ||
    !previous.classList.contains("focused")
  ) {
    previous = owner.container.querySelector(".focusable.focused");
    recordStreamFocusMetric("focusFullScanCount");
  }

  if (previous !== target) {
    previous?.classList?.remove("focused");
    target.classList.add("focused");
    recordStreamFocusMetric("focusMoveCount");
  } else if (!target.classList.contains("focused")) {
    target.classList.add("focused");
  }
  owner.focusedElement = target;

  try {
    target.focus({ preventScroll: true });
  } catch (_) {
    target.focus();
  }
  return true;
}
