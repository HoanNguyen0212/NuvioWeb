import assert from "node:assert/strict";
import test from "node:test";
import { selectCompatibleFallbackSource } from "../js/core/streams/streamFallbackSelector.js";
import { SUPPORT } from "../js/platform/webos/webosVideoCapabilities.js";

const capabilities = {
  native: {
    avc: SUPPORT.PROBABLY,
    hevcMain: SUPPORT.PROBABLY,
    hevcMain10: SUPPORT.UNSUPPORTED,
    dolbyVision: SUPPORT.UNSUPPORTED
  },
  mse: { available: SUPPORT.PROBABLY },
  unsupportedAudioCodecs: ["truehd", "dts"]
};
const hdr = { id: "hdr", url: "https://example.test/hdr.mkv", name: "HEVC Main10 HDR10 TrueHD" };
const sdr = { id: "sdr", url: "https://example.test/sdr.mp4", name: "AVC SDR AAC" };
const hevc8 = { id: "hevc8", url: "https://example.test/hevc.mp4", name: "HEVC Main SDR AAC" };

test("selects untried compatible SDR AVC before other compatible sources", () => {
  const selected = selectCompatibleFallbackSource([hdr, hevc8, sdr], {
    capabilities,
    currentSource: hdr,
    attemptedSourceKeys: new Set([hdr.id, hdr.url])
  });
  assert.equal(selected?.stream.id, "sdr");
});

test("never returns an already attempted URL or id", () => {
  const selected = selectCompatibleFallbackSource([sdr, { ...sdr, id: "duplicate" }], {
    capabilities,
    attemptedSourceKeys: new Set([sdr.url])
  });
  assert.equal(selected, null);
});

test("does not return unknown or incompatible sources as automatic fallback", () => {
  const selected = selectCompatibleFallbackSource([
    hdr,
    { id: "unknown", url: "https://example.test/remux.mkv", name: "HDR Remux" }
  ], {
    capabilities,
    currentSource: hdr
  });
  assert.equal(selected, null);
});

test("returns null after the only SDR fallback was attempted", () => {
  const selected = selectCompatibleFallbackSource([hdr, sdr], {
    capabilities,
    currentSource: hdr,
    attemptedSourceKeys: new Set([sdr.id, sdr.url])
  });
  assert.equal(selected, null);
});
