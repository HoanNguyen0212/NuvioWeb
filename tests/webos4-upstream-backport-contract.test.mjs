import assert from "node:assert/strict";
import test from "node:test";
import { shouldWriteMarkup } from "../js/ui/screens/renderMarkupGuard.js";

function container(hasShell) {
  return {
    querySelector(selector) {
      return hasShell && selector === ".shell" ? {} : null;
    }
  };
}

test("identical retained Home or Stream markup skips a DOM write", () => {
  assert.equal(shouldWriteMarkup(container(true), ".shell", "same", "same"), false);
});

test("missing shell or changed markup writes the DOM", () => {
  assert.equal(shouldWriteMarkup(container(false), ".shell", "same", "same"), true);
  assert.equal(shouldWriteMarkup(container(true), ".shell", "old", "new"), true);
});
