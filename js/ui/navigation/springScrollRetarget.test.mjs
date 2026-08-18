import assert from "node:assert/strict";
import test from "node:test";

import { retargetSpringScrollState } from "./springScrollRetarget.js";

test("spring retarget clears momentum when horizontal direction reverses", () => {
  const state = { position: 420, target: 700, velocity: 900 };
  retargetSpringScrollState(state, 460, 280);
  assert.deepEqual(state, { position: 460, target: 280, velocity: 0 });
});

test("spring retarget keeps momentum while continuing in the same direction", () => {
  const state = { position: 420, target: 700, velocity: 900 };
  retargetSpringScrollState(state, 460, 820);
  assert.deepEqual(state, { position: 460, target: 820, velocity: 900 });
});
