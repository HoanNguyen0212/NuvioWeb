import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeRemoteItemsWithLocal } from "../js/core/profile/homeCatalogSettingsSyncService.js";

test("mergeRemoteItemsWithLocal keeps remote order for shared items and appends newer local items", () => {
  const localPayload = {
    items: [
      { addon_id: "addonA", type: "movie", catalog_id: "top", order: 0 },
      { addon_id: "addonB", type: "movie", catalog_id: "popular", order: 1 },
      { addon_id: "addonC", type: "series", catalog_id: "new", order: 2 } // newer local catalog
    ]
  };

  const rawRemote = [
    // remote order has addonB before addonA
    { addon_id: "addonB", type: "movie", catalog_id: "popular", order: 0 },
    { addon_id: "addonA", type: "movie", catalog_id: "top", order: 1 },
    { addon_id: "addonDeleted", type: "movie", catalog_id: "old", order: 2 } // deleted addon
  ];

  const result = mergeRemoteItemsWithLocal(rawRemote, localPayload);

  // 1. addonB and addonA in remote order
  // 2. addonC appended from local
  // 3. addonDeleted dropped because local no longer has it
  assert.equal(result.length, 3);
  assert.deepEqual(
    result.map((item) => `${item.addon_id}:${item.catalog_id}`),
    ["addonB:popular", "addonA:top", "addonC:new"]
  );
  assert.deepEqual(
    result.map((item) => item.order),
    [0, 1, 2],
    "order must be sequential and reindexed"
  );
});

test("mergeRemoteItemsWithLocal returns local items when remote items array is empty", () => {
  const localPayload = {
    items: [
      { addon_id: "addonA", type: "movie", catalog_id: "top", order: 0 }
    ]
  };
  const result = mergeRemoteItemsWithLocal([], localPayload);
  assert.equal(result.length, 1);
  assert.equal(result[0].addon_id, "addonA");
});
