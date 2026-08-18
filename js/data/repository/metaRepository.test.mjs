import assert from "node:assert/strict";
import test from "node:test";

import { isUsableMetaPayload, metaRepository } from "./metaRepository.js";

test("empty or malformed metadata payloads are rejected", () => {
  assert.equal(isUsableMetaPayload(null), false);
  assert.equal(isUsableMetaPayload(undefined), false);
  assert.equal(isUsableMetaPayload({}), false);
  assert.equal(isUsableMetaPayload([]), false);
  assert.equal(isUsableMetaPayload("metadata"), false);
  assert.equal(metaRepository.mapMeta(null), null);
  assert.equal(metaRepository.mapMeta(undefined), null);
  assert.equal(metaRepository.mapMeta({}), null);
  assert.equal(metaRepository.mapMeta([]), null);
  assert.equal(metaRepository.mapMeta(42), null);
});

test("valid metadata still uses the existing mapping behavior", () => {
  const mapped = metaRepository.mapMeta({
    id: "tt123",
    type: "movie",
    name: "Example",
    genres: ["Drama"],
    videos: [{ id: "video-1" }]
  });

  assert.equal(mapped.id, "tt123");
  assert.equal(mapped.type, "movie");
  assert.equal(mapped.name, "Example");
  assert.deepEqual(mapped.genres, ["Drama"]);
  assert.deepEqual(mapped.videos, [{ id: "video-1" }]);
});
