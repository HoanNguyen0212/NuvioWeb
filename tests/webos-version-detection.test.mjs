import assert from "node:assert/strict";
import test from "node:test";
import { parseWebOsMajorVersion } from "../js/platform/index.js";

test("maps LG Chromium generations to their webOS major release", () => {
  assert.equal(parseWebOsMajorVersion(["Mozilla/5.0 Chromium/38.0.2125.111"]), 3);
  assert.equal(parseWebOsMajorVersion(["Mozilla/5.0 Chromium/53.0.2785.34"]), 4);
  assert.equal(parseWebOsMajorVersion(["Mozilla/5.0 Chrome/68.0.3440.84"]), 5);
  assert.equal(parseWebOsMajorVersion(["Mozilla/5.0 Chrome/79.0.3945.88"]), 6);
});

test("prefers an explicit webOS version over an engine token in the same device string", () => {
  assert.equal(
    parseWebOsMajorVersion(["Web0S.TV 4.10.0 Chromium/53.0.2785.34"]),
    4
  );
});

test("returns zero without usable webOS or Chromium version data", () => {
  assert.equal(parseWebOsMajorVersion(["Mozilla/5.0"]), 0);
});
