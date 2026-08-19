import assert from "node:assert/strict";
import test from "node:test";

import { isPlayableStreamCandidate } from "./streamCandidatePolicy.js";

function penguStream(title, url = "https://pengu.uk/direct/external/token/movie.mkv") {
  return {
    addonName: "PenguPlay",
    title,
    url
  };
}

test("filters Pengu HDHub Worker mirrors nested inside Pengu identity", () => {
  assert.equal(isPlayableStreamCandidate(penguStream("4KHDHub · Worker")), false);
  assert.equal(isPlayableStreamCandidate(penguStream("HDHub · Castle")), false);
  assert.equal(isPlayableStreamCandidate(penguStream("HDHub · PixelDrain")), false);
});

test("filters current Pengu 2Peckle-only rows without requiring an Artemis label", () => {
  assert.equal(isPlayableStreamCandidate(penguStream("4K · 2Peckle")), false);
  assert.equal(isPlayableStreamCandidate(penguStream("1080p · Artemis")), false);
});

test("keeps Pengu source families that loaded metadata on the target TV", () => {
  assert.equal(isPlayableStreamCandidate(penguStream("CineFreak · CineCloud (FSL)")), true);
  assert.equal(
    isPlayableStreamCandidate(penguStream("VidKing · Yoru HLS", "https://pengu.uk/direct/external/token/master.m3u8")),
    true
  );
  assert.equal(isPlayableStreamCandidate(penguStream("VegaMovies · FSL")), true);
});

test("direct HDHub addon policy still permits only verified FSL and R2 hosts", () => {
  assert.equal(isPlayableStreamCandidate({ addonName: "HDHub", title: "FSL", url: "https://cdn.fsl-buckets.life/movie.mkv" }), true);
  assert.equal(isPlayableStreamCandidate({ addonName: "HDHub", title: "R2", url: "https://media.example.r2.dev/movie.mkv" }), true);
  assert.equal(isPlayableStreamCandidate({ addonName: "HDHub", title: "Worker", url: "https://example.workers.dev/movie.mkv" }), false);
});
