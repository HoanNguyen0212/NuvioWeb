import assert from "node:assert/strict";
import test from "node:test";

import {
  focusStreamElement,
  getStreamFocusLists,
  invalidateStreamFocusNavigation
} from "./streamFocusNavigation.js";

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(value) {
      values.add(value);
    },
    contains(value) {
      return values.has(value);
    },
    remove(value) {
      values.delete(value);
    }
  };
}

function createTarget(row) {
  return {
    classList: createClassList(["focusable"]),
    dataset: { cardAction: "play", streamRow: String(row) },
    focusCalls: 0,
    focus() {
      this.focusCalls += 1;
    }
  };
}

function createOwner(rowCount = 400) {
  const targets = Array.from({ length: rowCount }, (_, row) => createTarget(row));
  const rows = targets.map((target, row) => ({
    dataset: { streamRow: String(row) },
    querySelector(selector) {
      return selector === '[data-card-action="play"]' ? target : null;
    }
  }));
  const container = {
    fullScanCount: 0,
    listScanCount: 0,
    contains(node) {
      return targets.includes(node);
    },
    querySelector(selector) {
      assert.equal(selector, ".focusable.focused");
      this.fullScanCount += 1;
      return targets.find((target) => target.classList.contains("focused")) || null;
    },
    querySelectorAll(selector) {
      this.listScanCount += 1;
      if (selector === ".stream-route-chip.focusable") {
        return [];
      }
      if (selector === ".stream-route-card-row[data-stream-row]") {
        return rows;
      }
      throw new Error(`Unexpected selector: ${selector}`);
    }
  };
  return { container, owner: { container, focusedElement: null }, targets };
}

test("stream D-pad focus reuses cached rows and only changes the previous target", () => {
  globalThis.__NUVIO_DEBUG_LEGACY_METRICS__ = true;
  globalThis.__NUVIO_LEGACY_METRICS__ = {};
  const { container, owner, targets } = createOwner();

  const firstLists = getStreamFocusLists(owner);
  const secondLists = getStreamFocusLists(owner);
  assert.equal(firstLists, secondLists);
  assert.equal(firstLists.rows.length, 400);

  for (let move = 0; move < 100; move += 1) {
    assert.equal(focusStreamElement(owner, targets[move]), true);
  }

  assert.equal(container.listScanCount, 2);
  assert.equal(container.fullScanCount, 1);
  assert.equal(targets[98].classList.contains("focused"), false);
  assert.equal(targets[99].classList.contains("focused"), true);
  assert.deepEqual(globalThis.__NUVIO_LEGACY_METRICS__.stream, {
    focusCacheBuildCount: 1,
    focusFullScanCount: 1,
    focusMoveCount: 100
  });

  invalidateStreamFocusNavigation(owner, { clearFocusedElement: true });
  assert.notEqual(getStreamFocusLists(owner), firstLists);
  assert.equal(globalThis.__NUVIO_LEGACY_METRICS__.stream.focusCacheBuildCount, 2);

  delete globalThis.__NUVIO_DEBUG_LEGACY_METRICS__;
  delete globalThis.__NUVIO_LEGACY_METRICS__;
});
