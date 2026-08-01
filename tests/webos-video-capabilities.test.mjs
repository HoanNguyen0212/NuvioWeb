import assert from "node:assert/strict";
import test from "node:test";
import {
  probeWebOsVideoCapabilities,
  resetWebOsVideoCapabilitiesCache,
  SUPPORT
} from "../js/platform/webos/webosVideoCapabilities.js";
import { evaluateStreamCompatibility } from "../js/core/streams/streamCompatibility.js";

function fakeVideo(support = {}) {
  return {
    canPlayType(mimeType) {
      const text = String(mimeType);
      if (text.includes("hvc1.2") || text.includes("hev1.2")) return support.hevcMain10 || "";
      if (text.includes("hvc1.1") || text.includes("hev1.1")) return support.hevcMain || "";
      if (text.includes("avc1")) return support.avc || "";
      if (text.includes("mpegurl")) return support.hls || "";
      return "";
    }
  };
}

function fakeMse(support = {}) {
  return {
    isTypeSupported(mimeType) {
      const text = String(mimeType);
      if (text.includes("hvc1.2") || text.includes("hev1.2")) return Boolean(support.hevcMain10);
      if (text.includes("hvc1.1") || text.includes("hev1.1")) return Boolean(support.hevcMain);
      if (text.includes("avc1")) return Boolean(support.avc);
      return false;
    }
  };
}

function main10Stream(protocol = "direct") {
  const url = protocol === "hls" ? "https://example.test/master.m3u8" : "https://example.test/movie.mkv";
  return { url, videoCodec: "HEVC", videoProfile: "Main10", bitDepth: 10, hdrFormat: "HDR10" };
}

test("separates native and MSE HEVC Main10 probes and caches session profile", () => {
  resetWebOsVideoCapabilitiesCache();
  const video = fakeVideo({ hevcMain10: "probably", hls: "probably" });
  const mediaSource = fakeMse({ hevcMain10: false });
  const profile = probeWebOsVideoCapabilities({ videoElement: video, mediaSource });
  assert.equal(profile.native.hevcMain10, SUPPORT.PROBABLY);
  assert.equal(profile.mse.hevcMain10, SUPPORT.UNSUPPORTED);
});

test("native HEVC Main10 supported and MSE unsupported selects direct native only", () => {
  const capabilities = {
    native: { hevcMain10: SUPPORT.PROBABLY, hls: SUPPORT.PROBABLY },
    mse: { hevcMain10: SUPPORT.UNSUPPORTED, available: SUPPORT.PROBABLY }
  };
  const direct = evaluateStreamCompatibility(main10Stream(), capabilities, { engine: "native-file" });
  assert.equal(direct.status, "compatible");
  assert.equal(direct.preferredEngine, "native-file");
  const hlsJs = evaluateStreamCompatibility(main10Stream("hls"), capabilities, { engine: "hls.js" });
  assert.equal(hlsJs.status, "incompatible");
  assert.equal(hlsJs.reason, "UNSUPPORTED_HEVC_MAIN10_MSE");
});

test("HEVC Main10 is incompatible when neither native nor MSE supports it", () => {
  const capabilities = {
    native: { hevcMain10: SUPPORT.UNSUPPORTED },
    mse: { hevcMain10: SUPPORT.UNSUPPORTED, available: SUPPORT.PROBABLY }
  };
  const decision = evaluateStreamCompatibility(main10Stream(), capabilities);
  assert.equal(decision.status, "incompatible");
  assert.equal(decision.reason, "UNSUPPORTED_HEVC_MAIN10_NATIVE");
});

test("unknown capability remains unknown and manual playback is not hard rejected", () => {
  const capabilities = {
    native: { hevcMain10: SUPPORT.UNKNOWN },
    mse: { hevcMain10: SUPPORT.UNKNOWN, available: SUPPORT.PROBABLY }
  };
  const decision = evaluateStreamCompatibility(main10Stream(), capabilities);
  assert.equal(decision.status, "unknown");
  assert.equal(decision.severity, "warning");
});

test("Dolby Vision and unsupported audio are classified separately", () => {
  const capabilities = {
    native: { dolbyVision: SUPPORT.UNSUPPORTED, hevcMain10: SUPPORT.PROBABLY },
    mse: { dolbyVision: SUPPORT.UNSUPPORTED, available: SUPPORT.PROBABLY },
    unsupportedAudioCodecs: ["dts", "truehd"]
  };
  const dv = evaluateStreamCompatibility({
    url: "https://example.test/movie.mkv",
    name: "Movie DoVi P7 HEVC Main10 AAC"
  }, capabilities);
  assert.equal(dv.reason, "UNSUPPORTED_DOLBY_VISION");
  const audio = evaluateStreamCompatibility({
    url: "https://example.test/movie.mkv",
    name: "Movie SDR AVC TrueHD"
  }, { ...capabilities, native: { avc: SUPPORT.PROBABLY } });
  assert.equal(audio.reason, "UNSUPPORTED_AUDIO_CODEC");
});

test("explicit EAC3-only audio is rejected when the selected pipeline probe is unsupported", () => {
  const decision = evaluateStreamCompatibility({
    url: "https://example.test/movie.mp4",
    videoCodec: "AVC",
    hdrFormat: "SDR",
    audioCodecs: ["EAC3"]
  }, {
    native: { avc: SUPPORT.PROBABLY, eac3: SUPPORT.UNSUPPORTED },
    mse: { available: SUPPORT.PROBABLY }
  });
  assert.equal(decision.reason, "UNSUPPORTED_AUDIO_CODEC");
});

test("AAC alternative keeps a source from being rejected for an additional TrueHD track", () => {
  const decision = evaluateStreamCompatibility({
    url: "https://example.test/movie.mp4",
    videoCodec: "AVC",
    hdrFormat: "SDR",
    audioCodecs: ["TrueHD", "AAC"]
  }, {
    native: { avc: SUPPORT.PROBABLY },
    mse: { available: SUPPORT.PROBABLY },
    unsupportedAudioCodecs: ["truehd"]
  });
  assert.equal(decision.status, "compatible");
});
