import assert from "node:assert/strict";
import test from "node:test";
import { selectAutoPlayStream } from "../js/core/streams/streamAutoPlaySelector.js";
import { SUPPORT } from "../js/platform/webos/webosVideoCapabilities.js";

const capabilities = {
  native: {
    avc: SUPPORT.PROBABLY,
    hevcMain10: SUPPORT.UNSUPPORTED,
    dolbyVision: SUPPORT.UNSUPPORTED
  },
  mse: { available: SUPPORT.PROBABLY },
  unsupportedAudioCodecs: ["dts", "truehd"]
};

const hdr = {
  id: "hdr",
  url: "https://example.test/movie-hdr.mkv",
  name: "Movie HEVC Main10 HDR10 TrueHD"
};
const unknownHdr = {
  id: "unknown-hdr",
  url: "https://example.test/movie-hdr-remux.mkv",
  name: "Movie HDR Remux"
};
const sdr = {
  id: "sdr",
  url: "https://example.test/movie-sdr.mp4",
  name: "Movie SDR AVC AAC"
};

test("FIRST_STREAM prefers compatible SDR and never autoplays known incompatible HDR", () => {
  const selected = selectAutoPlayStream([hdr, unknownHdr, sdr], {
    mode: "FIRST_STREAM",
    capabilities
  });
  assert.equal(selected?.id, "sdr");
});

test("unknown remains eligible when no compatible stream is available", () => {
  const selected = selectAutoPlayStream([hdr, unknownHdr], {
    mode: "FIRST_STREAM",
    capabilities
  });
  assert.equal(selected?.id, "unknown-hdr");
});

test("exact binge-group match still passes through compatibility gate", () => {
  const selected = selectAutoPlayStream([
    { ...hdr, behaviorHints: { bingeGroup: "same" } },
    { ...sdr, behaviorHints: { bingeGroup: "other" } }
  ], {
    mode: "FIRST_STREAM",
    preferredBingeGroup: "same",
    preferBingeGroupInSelection: true,
    capabilities
  });
  assert.equal(selected?.id, "sdr");
});

test("regex ordering is preserved inside the same compatibility class", () => {
  const selected = selectAutoPlayStream([
    { ...sdr, id: "first", name: "WEB SDR AVC AAC" },
    { ...sdr, id: "second", name: "WEB SDR AVC AAC 1080p" }
  ], {
    mode: "REGEX_MATCH",
    regexPattern: "WEB",
    capabilities
  });
  assert.equal(selected?.id, "first");
});
