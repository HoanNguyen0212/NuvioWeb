import assert from "node:assert/strict";
import test from "node:test";

import { reconcileCatalogOrderWithAddonGroups } from "./homeCatalogs.js";

test("Home catalog order follows addon groups and preserves order within each addon", () => {
  const saved = ["addonB_movie_2", "collection_custom", "addonA_movie_2", "addonB_movie_1", "addonA_movie_1"];
  const groups = [
    ["addonA_movie_1", "addonA_movie_2"],
    ["addonB_movie_1", "addonB_movie_2"]
  ];
  assert.deepEqual(reconcileCatalogOrderWithAddonGroups(saved, groups), [
    "addonA_movie_2",
    "collection_custom",
    "addonA_movie_1",
    "addonB_movie_2",
    "addonB_movie_1"
  ]);
});

test("Home catalog order seeds missing catalogs in manifest order without moving collection slots", () => {
  assert.deepEqual(
    reconcileCatalogOrderWithAddonGroups(["collection_custom", "addonA_movie_2"], [
      ["addonA_movie_1", "addonA_movie_2"],
      ["addonB_series_1"]
    ]),
    ["collection_custom", "addonA_movie_2", "addonA_movie_1", "addonB_series_1"]
  );
});
