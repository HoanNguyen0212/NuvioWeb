import assert from "node:assert/strict";
import test from "node:test";

import { resolveHomeVerticalTarget } from "./homeRowAlignment.js";

function node({ left, width = 240, col }) {
  return {
    dataset: { navCol: String(col) },
    offsetLeft: left,
    offsetWidth: width,
    getBoundingClientRect() {
      return { left, width };
    }
  };
}

test("vertical Home movement stays aligned with the current card center", () => {
  const source = node({ left: 574, col: 2 });
  const destination = [
    node({ left: 46, col: 0 }),
    node({ left: 310, col: 1 }),
    node({ left: 574, col: 2 }),
    node({ left: 838, col: 3 })
  ];

  assert.equal(resolveHomeVerticalTarget(destination, source, 2), destination[2]);
});

test("a previously visited destination column cannot pull vertical focus sideways", () => {
  const source = node({ left: 838, col: 3 });
  const destination = [
    node({ left: 46, col: 0 }),
    node({ left: 310, col: 1 }),
    node({ left: 574, col: 2 }),
    node({ left: 838, col: 3 })
  ];

  // Destination row column 0 may have been focused previously. The source
  // geometry and fallback column must still select the visually aligned card.
  assert.equal(resolveHomeVerticalTarget(destination, source, 3), destination[3]);
});

test("different card widths align by visual center instead of raw column index", () => {
  const source = node({ left: 500, width: 400, col: 2 });
  const destination = [
    node({ left: 300, width: 220, col: 1 }),
    node({ left: 590, width: 220, col: 2 }),
    node({ left: 880, width: 220, col: 3 })
  ];

  assert.equal(resolveHomeVerticalTarget(destination, source, 2), destination[1]);
});

test("falls back to the nearest navigation column when geometry is unavailable", () => {
  const destination = [
    { dataset: { navCol: "0" } },
    { dataset: { navCol: "2" } },
    { dataset: { navCol: "5" } }
  ];

  assert.equal(resolveHomeVerticalTarget(destination, null, 3), destination[1]);
  assert.equal(resolveHomeVerticalTarget([], null, 0), null);
});
