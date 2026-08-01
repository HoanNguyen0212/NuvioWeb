import assert from "node:assert/strict";
import test from "node:test";
import { parseCodecStringTraits, parseStreamVideoTraits } from "../js/core/streams/streamVideoTraits.js";

function namedStream(filename, extra = {}) {
  return {
    url: `https://media.example/${encodeURIComponent(filename)}`,
    behaviorHints: { filename },
    ...extra
  };
}

test("parses HEVC Main10 HDR10 and TrueHD release traits", () => {
  const traits = parseStreamVideoTraits(namedStream("Movie.2160p.HDR10.HEVC.Main10.TrueHD.mkv"));
  assert.equal(traits.videoCodec, "hevc");
  assert.equal(traits.videoProfile, "main10");
  assert.equal(traits.bitDepth, 10);
  assert.equal(traits.hdrFormat, "hdr10");
  assert.equal(traits.container, "mkv");
  assert.deepEqual(traits.audioCodecs, ["truehd"]);
});

test("keeps Dolby Vision primary while retaining HDR10 fallback metadata", () => {
  const traits = parseStreamVideoTraits(namedStream("Movie.2160p.DV.HDR10.x265.mkv"));
  assert.equal(traits.videoCodec, "hevc");
  assert.equal(traits.hdrFormat, "dolby-vision");
  assert.deepEqual(traits.hdrFormats, ["dolby-vision", "hdr10"]);
});

test("parses SDR AVC AAC without inventing HDR or 10-bit", () => {
  const traits = parseStreamVideoTraits(namedStream("Movie.1080p.SDR.x264.AAC.mp4"));
  assert.equal(traits.videoCodec, "avc");
  assert.equal(traits.videoProfile, "unknown");
  assert.equal(traits.bitDepth, 0);
  assert.equal(traits.hdrFormat, "sdr");
  assert.equal(traits.container, "mp4");
  assert.deepEqual(traits.audioCodecs, ["aac"]);
});

test("marketing-only HDR without codec remains unknown HDR and is not a codec rejection", () => {
  const traits = parseStreamVideoTraits(namedStream("Movie.HDR.Remux.mkv"));
  assert.equal(traits.videoCodec, "unknown");
  assert.equal(traits.hdrFormat, "unknown-hdr");
  assert.equal(traits.confidence, "filename");
});

test("explicit AVC SDR metadata wins over HDR word in the movie title", () => {
  const traits = parseStreamVideoTraits({
    title: "HDR: A Documentary",
    url: "https://media.example/movie.mp4",
    videoCodec: "avc1.4d401f",
    hdrFormat: "SDR",
    audioCodecs: ["AAC"]
  });
  assert.equal(traits.videoCodec, "avc");
  assert.equal(traits.hdrFormat, "sdr");
  assert.equal(traits.confidence, "explicit");
});

test("recognizes HLG, HDR10+, VP9 profile 2, AV1 and Dolby Vision profiles", () => {
  assert.equal(parseStreamVideoTraits(namedStream("Movie.HLG.HEVC.10-bit.mkv")).hdrFormat, "hlg");
  assert.equal(parseStreamVideoTraits(namedStream("Movie.HDR10Plus.x265.mkv")).hdrFormat, "hdr10plus");
  const vp9 = parseCodecStringTraits("vp09.02.10.10, opus");
  assert.equal(vp9.videoCodec, "vp9");
  assert.equal(vp9.videoProfile, "profile2");
  const av1 = parseCodecStringTraits("av01.0.08M.10, mp4a.40.2");
  assert.equal(av1.videoCodec, "av1");
  const dv = parseStreamVideoTraits(namedStream("Movie.DoVi.P7.HEVC.Main10.TrueHD.mkv"));
  assert.equal(dv.hdrFormat, "dolby-vision");
  assert.equal(dv.dolbyVisionProfile, "7");
});

test("conflicting explicit and parsed codecs remain unknown", () => {
  const traits = parseStreamVideoTraits({
    videoCodec: "avc1",
    raw: { parsed: { codec: "HEVC" } }
  });
  assert.equal(traits.videoCodec, "unknown");
  assert.equal(traits.confidence, "unknown");
});
