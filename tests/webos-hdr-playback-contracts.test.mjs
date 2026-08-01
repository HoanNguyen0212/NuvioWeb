import assert from "node:assert/strict";
import test from "node:test";
import {
  compatibleIndexesAreContiguousFromZero,
  getLegacyHlsBufferPolicy,
  pickConservativeInitialLevel
} from "../js/core/player/legacyStreamingPolicy.js";
import { evaluateStreamCompatibility } from "../js/core/streams/streamCompatibility.js";
import { selectCompatibleFallbackSource } from "../js/core/streams/streamFallbackSelector.js";
import { classifyPlaybackFailure } from "../js/core/player/playbackFailureClassifier.js";
import { SUPPORT } from "../js/platform/webos/webosVideoCapabilities.js";

const capabilities = {
  native: {
    avc: SUPPORT.PROBABLY,
    hevcMain: SUPPORT.PROBABLY,
    hevcMain10: SUPPORT.UNSUPPORTED,
    vp9Profile2: SUPPORT.UNSUPPORTED,
    av1: SUPPORT.UNSUPPORTED,
    dolbyVision: SUPPORT.UNSUPPORTED,
    hls: SUPPORT.PROBABLY,
    dash: SUPPORT.UNSUPPORTED
  },
  mse: {
    available: SUPPORT.PROBABLY,
    avc: SUPPORT.PROBABLY,
    hevcMain: SUPPORT.UNSUPPORTED,
    hevcMain10: SUPPORT.UNSUPPORTED,
    vp9Profile2: SUPPORT.UNSUPPORTED,
    av1: SUPPORT.UNSUPPORTED,
    dolbyVision: SUPPORT.UNSUPPORTED
  },
  unsupportedAudioCodecs: ["dts", "truehd"]
};

test("legacy webOS HLS policy preserves bounded MSE buffers", () => {
  assert.deepEqual(getLegacyHlsBufferPolicy(true), {
    enableWorker: false,
    lowLatencyMode: false,
    backBufferLength: 9,
    maxBufferLength: 11,
    maxMaxBufferLength: 15,
    maxBufferSize: 12 * 1024 * 1024
  });
});

test("initial HLS level is conservative and never forced to 4K", () => {
  const levels = [
    { height: 720, bitrate: 2_000_000 },
    { height: 1080, bitrate: 5_000_000 },
    { height: 2160, bitrate: 18_000_000 }
  ];
  assert.equal(pickConservativeInitialLevel(levels), 1);
  assert.equal(pickConservativeInitialLevel(levels, [0, 2]), 0);
});

test("mixed codec level layouts identify when ABR needs a fixed compatible level", () => {
  assert.equal(compatibleIndexesAreContiguousFromZero([0, 1]), true);
  assert.equal(compatibleIndexesAreContiguousFromZero([1]), false);
  assert.equal(compatibleIndexesAreContiguousFromZero([0, 2]), false);
});

test("direct Main10 keeps native when native capability is strong", () => {
  const decision = evaluateStreamCompatibility({
    url: "https://example.test/hdr.mkv",
    name: "HDR10 HEVC Main10 AAC"
  }, {
    ...capabilities,
    native: { ...capabilities.native, hevcMain10: SUPPORT.PROBABLY }
  });
  assert.equal(decision.status, "compatible");
  assert.equal(decision.preferredEngine, "native-file");
});

test("HLS Main10 does not enter hls.js when exact MSE codec is unsupported", () => {
  const decision = evaluateStreamCompatibility({
    url: "https://example.test/master.m3u8",
    name: "HDR10 HEVC Main10 AAC"
  }, capabilities, { engine: "hls.js", manifestCodecs: "hvc1.2.4.L153.B0,mp4a.40.2" });
  assert.equal(decision.status, "incompatible");
  assert.equal(decision.reason, "UNSUPPORTED_HEVC_MAIN10_MSE");
});

test("mixed HLS AVC rendition remains compatible even when HEVC rendition is not", () => {
  const stream = { url: "https://example.test/master.m3u8", name: "HDR package" };
  const avc = evaluateStreamCompatibility(stream, capabilities, {
    engine: "hls.js",
    manifestCodecs: "avc1.640028,mp4a.40.2"
  });
  const hevc = evaluateStreamCompatibility(stream, capabilities, {
    engine: "hls.js",
    manifestCodecs: "hvc1.2.4.L153.B0,ec-3"
  });
  assert.notEqual(avc.status, "incompatible");
  assert.equal(hevc.status, "incompatible");
});

test("one SDR fallback cannot loop back to either attempted source", () => {
  const hdr = { id: "hdr", url: "https://example.test/hdr.mkv", name: "HEVC Main10 HDR10 AAC" };
  const sdr = { id: "sdr", url: "https://example.test/sdr.mp4", name: "AVC SDR AAC" };
  const first = selectCompatibleFallbackSource([hdr, sdr], {
    capabilities,
    currentSource: hdr,
    attemptedSourceKeys: new Set([hdr.id, hdr.url])
  });
  assert.equal(first?.stream.id, "sdr");
  const second = selectCompatibleFallbackSource([hdr, sdr], {
    capabilities,
    currentSource: sdr,
    attemptedSourceKeys: new Set([hdr.id, hdr.url, sdr.id, sdr.url])
  });
  assert.equal(second, null);
});

test("append pressure after playback is not mislabeled unsupported HDR", () => {
  const classification = classifyPlaybackFailure({
    mediaErrorCode: 3,
    eventDetail: { hlsErrorDetails: "bufferFullError" },
    diagnostics: {
      startedAt: 1000,
      firstFrameAt: 1500,
      firstTimeProgressAt: 1800,
      hasTimeProgress: true,
      currentTime: 30
    },
    capabilityDecision: { reason: "UNSUPPORTED_HEVC_MAIN10_MSE" },
    now: 31_000
  });
  assert.equal(classification, "MSE_BUFFER_PRESSURE");
});
