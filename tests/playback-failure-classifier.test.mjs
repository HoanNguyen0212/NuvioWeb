import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPlaybackFailure,
  isImmediateStartupDecoderFailure
} from "../js/core/player/playbackFailureClassifier.js";

const startedAt = 1_000_000;
function diagnostics(overrides = {}) {
  return {
    startedAt,
    currentTime: 0,
    firstFrameAt: 0,
    firstTimeProgressAt: 0,
    hasTimeProgress: false,
    ...overrides
  };
}

test("recognizes code 3 before progress inside five-second startup window", () => {
  assert.equal(isImmediateStartupDecoderFailure({
    mediaErrorCode: 3,
    diagnostics: diagnostics({ currentTime: 0.1 }),
    now: startedAt + 2000
  }), true);
  assert.equal(isImmediateStartupDecoderFailure({
    mediaErrorCode: 3,
    diagnostics: diagnostics({ currentTime: 0.5 }),
    now: startedAt + 2000
  }), false);
});

test("classifies explicit Main10 immediate decoder failure separately", () => {
  assert.equal(classifyPlaybackFailure({
    mediaErrorCode: 3,
    diagnostics: diagnostics(),
    capabilityDecision: { reason: "UNSUPPORTED_HEVC_MAIN10_NATIVE" },
    now: startedAt + 2000
  }), "UNSUPPORTED_HDR_CODEC_OR_PROFILE");
});

test("runtime code 3 overrides an optimistic probe for explicit Main10 traits", () => {
  assert.equal(classifyPlaybackFailure({
    mediaErrorCode: 3,
    diagnostics: diagnostics({
      traits: { videoCodec: "hevc", videoProfile: "main10", bitDepth: 10, hdrFormat: "hdr10" }
    }),
    capabilityDecision: { status: "compatible", reason: "" },
    now: startedAt + 1200
  }), "UNSUPPORTED_HDR_CODEC_OR_PROFILE");
});

test("classifies unsupported audio without calling it HDR", () => {
  assert.equal(classifyPlaybackFailure({
    mediaErrorCode: 3,
    diagnostics: diagnostics(),
    capabilityDecision: { reason: "UNSUPPORTED_AUDIO_CODEC" },
    now: startedAt + 1200
  }), "UNSUPPORTED_AUDIO_CODEC");
});

test("distinguishes HLS append, pressure, codec and network failures", () => {
  assert.equal(classifyPlaybackFailure({ eventDetail: { hlsErrorDetails: "bufferAppendError" } }), "MSE_APPEND_FAILURE");
  assert.equal(classifyPlaybackFailure({ eventDetail: { hlsErrorDetails: "bufferFullError" } }), "MSE_BUFFER_PRESSURE");
  assert.equal(classifyPlaybackFailure({ eventDetail: { hlsErrorDetails: "UNSUPPORTED_MSE_CODEC" } }), "UNSUPPORTED_MSE_CODEC");
  assert.equal(classifyPlaybackFailure({ eventDetail: { hlsErrorDetails: "fragLoadError" } }), "NETWORK_MEDIA_FAILURE");
});

test("decode after real playback progress is a fragment failure", () => {
  assert.equal(classifyPlaybackFailure({
    mediaErrorCode: 3,
    diagnostics: diagnostics({ currentTime: 30, firstFrameAt: startedAt + 500, firstTimeProgressAt: startedAt + 800, hasTimeProgress: true }),
    now: startedAt + 31_000
  }), "CORRUPT_OR_UNSUPPORTED_FRAGMENT");
});

test("network code before first frame stays network, not codec", () => {
  assert.equal(classifyPlaybackFailure({
    mediaErrorCode: 2,
    diagnostics: diagnostics(),
    now: startedAt + 1000
  }), "NETWORK_MEDIA_FAILURE");
});

test("code 3 with insufficient evidence stays unknown decode", () => {
  assert.equal(classifyPlaybackFailure({
    mediaErrorCode: 3,
    diagnostics: diagnostics(),
    now: startedAt + 1500
  }), "UNKNOWN_MEDIA_DECODE");
});
