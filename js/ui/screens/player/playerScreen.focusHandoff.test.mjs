import assert from "node:assert/strict";
import test from "node:test";
import { releasePlayerDomFocus } from "./playerScreen.js";

test("player cleanup blurs an active element owned by the player", () => {
  let blurCount = 0;
  const activeElement = {
    blur() {
      blurCount += 1;
    }
  };
  const container = {
    contains(node) {
      return node === activeElement;
    }
  };

  assert.equal(releasePlayerDomFocus(container, activeElement), true);
  assert.equal(blurCount, 1);
});

test("player cleanup leaves focus outside the player untouched", () => {
  let blurCount = 0;
  const activeElement = {
    blur() {
      blurCount += 1;
    }
  };
  const container = {
    contains() {
      return false;
    }
  };

  assert.equal(releasePlayerDomFocus(container, activeElement), false);
  assert.equal(blurCount, 0);
});
