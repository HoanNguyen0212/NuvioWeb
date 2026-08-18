import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldDeferHorizontalHomeEffects,
  shouldPreserveHomeDom,
  shouldResumePreservedHome
} from "./homeDomPreservation.js";

test("legacy webOS removes the focusable Home DOM before opening another screen", () => {
  assert.equal(
    shouldPreserveHomeDom({
      isLegacyTvRuntime: true,
      hasLoadedOnce: true,
      hasRows: true,
      hasDom: true
    }),
    false
  );
});

test("Back resumes preserved Tizen Home only when layout and DOM still match", () => {
  const accepted = {
    isTizen: true,
    isBackNavigation: true,
    homeDomPreserved: true,
    hasLoadedOnce: true,
    hasRows: true,
    hasDom: true,
    renderedLayoutMode: "modern",
    layoutMode: "modern"
  };
  assert.equal(shouldResumePreservedHome(accepted), true);
  assert.equal(shouldResumePreservedHome({ ...accepted, isBackNavigation: false }), false);
  assert.equal(shouldResumePreservedHome({ ...accepted, layoutMode: "classic" }), false);
});

test("legacy TV defers expensive Home effects during either horizontal direction", () => {
  assert.equal(
    shouldDeferHorizontalHomeEffects({
      direction: "right",
      isLegacyTvRuntime: true
    }),
    true
  );
  assert.equal(
    shouldDeferHorizontalHomeEffects({
      direction: "left",
      isLegacyTvRuntime: true
    }),
    true
  );
  assert.equal(
    shouldDeferHorizontalHomeEffects({
      direction: "down",
      isLegacyTvRuntime: true
    }),
    false
  );
});

test("Tizen can retain Home DOM while ordinary browser sessions cannot", () => {
  const loadedHome = {
    hasLoadedOnce: true,
    hasRows: true,
    hasDom: true
  };
  assert.equal(shouldPreserveHomeDom(loadedHome), false);
  assert.equal(shouldPreserveHomeDom({ ...loadedHome, isTizen: true }), true);
});
