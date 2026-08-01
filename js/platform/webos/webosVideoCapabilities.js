const SUPPORT = Object.freeze({
  PROBABLY: "probably",
  MAYBE: "maybe",
  UNSUPPORTED: "unsupported",
  UNKNOWN: "unknown"
});

const MIME_PROBES = Object.freeze({
  avc: ['video/mp4; codecs="avc1.4d401f,mp4a.40.2"', 'video/mp4; codecs="avc1.640028,mp4a.40.2"'],
  hevcMain: ['video/mp4; codecs="hvc1.1.6.L93.B0,mp4a.40.2"', 'video/mp4; codecs="hev1.1.6.L93.B0,mp4a.40.2"'],
  hevcMain10: ['video/mp4; codecs="hvc1.2.4.L153.B0,mp4a.40.2"', 'video/mp4; codecs="hev1.2.4.L153.B0,mp4a.40.2"'],
  vp9: ['video/webm; codecs="vp9"'],
  vp9Profile2: ['video/webm; codecs="vp09.02.10.10"'],
  av1: ['video/mp4; codecs="av01.0.08M.10"'],
  dolbyVision: ['video/mp4; codecs="dvh1.05.06,ec-3"', 'video/mp4; codecs="dvhe.05.06,ec-3"'],
  aac: ['audio/mp4; codecs="mp4a.40.2"'],
  ac3: ['audio/mp4; codecs="ac-3"', 'audio/mp4; codecs="dac3"'],
  eac3: ['audio/mp4; codecs="ec-3"', 'audio/mp4; codecs="dec3"']
});

function normalizeCanPlayType(value) {
  const result = String(value || "").trim().toLowerCase();
  if (result === SUPPORT.PROBABLY) return SUPPORT.PROBABLY;
  if (result === SUPPORT.MAYBE) return SUPPORT.MAYBE;
  return SUPPORT.UNSUPPORTED;
}

function strongest(results = []) {
  if (results.includes(SUPPORT.PROBABLY)) return SUPPORT.PROBABLY;
  if (results.includes(SUPPORT.MAYBE)) return SUPPORT.MAYBE;
  if (results.includes(SUPPORT.UNKNOWN)) return SUPPORT.UNKNOWN;
  return SUPPORT.UNSUPPORTED;
}

function probeNative(video, mimeTypes) {
  if (!video || typeof video.canPlayType !== "function") return SUPPORT.UNKNOWN;
  return strongest(mimeTypes.map((mimeType) => {
    try {
      return normalizeCanPlayType(video.canPlayType(mimeType));
    } catch (_) {
      return SUPPORT.UNKNOWN;
    }
  }));
}

function probeMse(mediaSource, mimeTypes) {
  if (!mediaSource || typeof mediaSource.isTypeSupported !== "function") {
    return SUPPORT.UNKNOWN;
  }
  const results = mimeTypes.map((mimeType) => {
    try {
      return mediaSource.isTypeSupported(mimeType) ? SUPPORT.PROBABLY : SUPPORT.UNSUPPORTED;
    } catch (_) {
      return SUPPORT.UNKNOWN;
    }
  });
  return strongest(results);
}

function createVideo(documentRef) {
  try {
    return documentRef?.createElement?.("video") || null;
  } catch (_) {
    return null;
  }
}

let cachedProfile = null;

export function probeWebOsVideoCapabilities({
  videoElement = null,
  documentRef = globalThis.document,
  mediaSource = globalThis.MediaSource,
  forceRefresh = false,
  debug = Boolean(globalThis.__NUVIO_DEBUG_PLAYBACK__)
} = {}) {
  if (cachedProfile && !forceRefresh && !videoElement) return cachedProfile;
  const video = videoElement || createVideo(documentRef);
  const native = {};
  const mse = {};
  Object.entries(MIME_PROBES).forEach(([key, mimeTypes]) => {
    native[key] = probeNative(video, mimeTypes);
    mse[key] = probeMse(mediaSource, mimeTypes);
  });
  native.hls = probeNative(video, ["application/vnd.apple.mpegurl", "application/x-mpegurl"]);
  native.dash = probeNative(video, ["application/dash+xml"]);
  native.mp4 = probeNative(video, ["video/mp4"]);
  native.webm = probeNative(video, ["video/webm"]);
  native.mkv = probeNative(video, ["video/x-matroska"]);
  mse.available = mediaSource && typeof mediaSource.isTypeSupported === "function"
    ? SUPPORT.PROBABLY
    : SUPPORT.UNSUPPORTED;
  const profile = Object.freeze({
    native: Object.freeze(native),
    mse: Object.freeze(mse),
    probedAt: Date.now()
  });
  if (!videoElement) cachedProfile = profile;
  if (debug) console.info("webOS video capability profile", profile);
  return profile;
}

export function getCachedWebOsVideoCapabilities() {
  return cachedProfile;
}

export function resetWebOsVideoCapabilitiesCache() {
  cachedProfile = null;
}

export function isCapabilitySupported(value, { allowMaybe = true } = {}) {
  return value === SUPPORT.PROBABLY || (allowMaybe && value === SUPPORT.MAYBE);
}

export function capabilityConfidence(value) {
  if (value === SUPPORT.PROBABLY) return "strong";
  if (value === SUPPORT.MAYBE) return "uncertain";
  if (value === SUPPORT.UNSUPPORTED) return "none";
  return "unknown";
}

export { MIME_PROBES, SUPPORT };
