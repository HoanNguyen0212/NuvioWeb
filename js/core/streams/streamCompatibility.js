import { isCapabilitySupported, SUPPORT } from "../../platform/webos/webosVideoCapabilities.js";
import { parseCodecStringTraits, parseStreamVideoTraits } from "./streamVideoTraits.js";

function result(status, severity, reason, preferredEngine, traits, extra = {}) {
  return { status, severity, reason, preferredEngine, traits, ...extra };
}

function capabilityForTraits(profile = {}, traits = {}) {
  if (traits.videoCodec === "avc") return profile.avc;
  if (traits.videoCodec === "hevc") {
    return traits.videoProfile === "main10" || traits.bitDepth >= 10
      ? profile.hevcMain10
      : profile.hevcMain;
  }
  if (traits.videoCodec === "vp9") {
    return traits.videoProfile === "profile2" || traits.bitDepth >= 10
      ? profile.vp9Profile2
      : profile.vp9;
  }
  if (traits.videoCodec === "av1") return profile.av1;
  return SUPPORT.UNKNOWN;
}

function unsupportedReason(traits, pipeline) {
  const suffix = pipeline === "mse" ? "MSE" : "NATIVE";
  if (traits.hdrFormat === "dolby-vision") return "UNSUPPORTED_DOLBY_VISION";
  if (traits.videoCodec === "av1") return "UNSUPPORTED_AV1";
  if (traits.videoCodec === "vp9" && (traits.videoProfile === "profile2" || traits.bitDepth >= 10)) {
    return "UNSUPPORTED_VP9_PROFILE2";
  }
  if (traits.videoCodec === "hevc" && (traits.videoProfile === "main10" || traits.bitDepth >= 10)) {
    return `UNSUPPORTED_HEVC_MAIN10_${suffix}`;
  }
  if (traits.videoCodec !== "unknown") return "UNSUPPORTED_VIDEO_CODEC";
  return "MISSING_CODEC_METADATA";
}

function isAdaptiveEngine(engine) {
  return engine === "hls.js" || engine === "dash.js" || engine === "mse";
}

function nativeEngineForProtocol(protocol) {
  if (protocol === "hls") return "native-hls";
  if (protocol === "dash") return "native-dash";
  return "native-file";
}

function mseEngineForProtocol(protocol) {
  return protocol === "dash" ? "dash.js" : "hls.js";
}

function audioDecision(traits, capabilities, context) {
  const unsupported = new Set(
    (context.unsupportedAudioCodecs || capabilities.unsupportedAudioCodecs || [])
      .map((codec) => String(codec || "").toLowerCase())
  );
  const codecs = traits.audioCodecs || [];
  if (!codecs.length) return null;
  const normalize = (codec) => codec === "dts-hd" ? "dts" : codec;
  const supportedKnownTrack = codecs.some((codec) => !unsupported.has(normalize(codec)));
  const unsupportedTracks = codecs.filter((codec) => unsupported.has(normalize(codec)));
  if (unsupportedTracks.length && !supportedKnownTrack) {
    return { status: "incompatible", severity: "fatal", reason: "UNSUPPORTED_AUDIO_CODEC" };
  }
  return null;
}

export function evaluateStreamCompatibility(stream = {}, capabilities = {}, context = {}) {
  let traits = context.traits || parseStreamVideoTraits(stream);
  if (context.manifestCodecs) {
    const manifestTraits = parseCodecStringTraits(context.manifestCodecs);
    traits = {
      ...traits,
      videoCodec: manifestTraits.videoCodec !== "unknown" ? manifestTraits.videoCodec : traits.videoCodec,
      videoProfile: manifestTraits.videoProfile !== "unknown" ? manifestTraits.videoProfile : traits.videoProfile,
      bitDepth: manifestTraits.bitDepth || traits.bitDepth,
      hdrFormats: manifestTraits.hdrFormats.length ? manifestTraits.hdrFormats : traits.hdrFormats,
      hdrFormat: manifestTraits.hdrFormats.includes("dolby-vision")
        ? "dolby-vision"
        : traits.hdrFormat,
      audioCodecs: manifestTraits.audioCodecs.length ? manifestTraits.audioCodecs : traits.audioCodecs,
      confidence: "explicit"
    };
  }

  const native = capabilities.native || {};
  const mse = capabilities.mse || {};
  const requestedEngine = String(context.engine || context.playbackEngine || "auto").toLowerCase();
  const protocol = context.protocol || traits.protocol;
  const nativeEngine = nativeEngineForProtocol(protocol);
  const mseEngine = mseEngineForProtocol(protocol);
  const nativeProtocolCapability = protocol === "hls"
    ? native.hls
    : protocol === "dash" ? native.dash : SUPPORT.PROBABLY;
  const nativeCodecCapability = traits.hdrFormat === "dolby-vision"
    ? native.dolbyVision
    : capabilityForTraits(native, traits);
  const mseCodecCapability = traits.hdrFormat === "dolby-vision"
    ? mse.dolbyVision
    : capabilityForTraits(mse, traits);

  let pipeline = "native";
  let preferredEngine = nativeEngine;
  if (isAdaptiveEngine(requestedEngine)) {
    pipeline = "mse";
    preferredEngine = requestedEngine === "mse" ? mseEngine : requestedEngine;
  } else if (requestedEngine.startsWith("native")) {
    pipeline = "native";
    preferredEngine = requestedEngine;
  } else if (protocol === "hls" || protocol === "dash") {
    const nativeUsable = isCapabilitySupported(nativeProtocolCapability)
      && (traits.videoCodec === "unknown" || isCapabilitySupported(nativeCodecCapability));
    if (!nativeUsable) {
      pipeline = "mse";
      preferredEngine = mseEngine;
    }
  }

  const audio = audioDecision(traits, capabilities, context);
  if (audio) return result(audio.status, audio.severity, audio.reason, preferredEngine, traits, {
    nativeCapability: nativeCodecCapability || SUPPORT.UNKNOWN,
    mseCapability: mseCodecCapability || SUPPORT.UNKNOWN
  });

  const selectedCapability = pipeline === "mse" ? mseCodecCapability : nativeCodecCapability;
  const selectedProtocolCapability = pipeline === "native" ? nativeProtocolCapability : mse.available;
  const diagnostic = {
    nativeCapability: nativeCodecCapability || SUPPORT.UNKNOWN,
    mseCapability: mseCodecCapability || SUPPORT.UNKNOWN
  };

  if (traits.videoCodec === "unknown") {
    const reason = traits.hdrFormat === "unknown-hdr"
      ? "UNKNOWN_HDR_COMPATIBILITY"
      : "MISSING_CODEC_METADATA";
    return result("unknown", "warning", reason, preferredEngine, traits, diagnostic);
  }

  if (pipeline === "native" && (protocol === "hls" || protocol === "dash") && selectedProtocolCapability === SUPPORT.UNSUPPORTED) {
    return result("incompatible", "fatal", "UNSUPPORTED_VIDEO_CODEC", preferredEngine, traits, diagnostic);
  }
  if (pipeline === "mse" && mse.available === SUPPORT.UNSUPPORTED) {
    return result("incompatible", "fatal", "UNSUPPORTED_VIDEO_CODEC", preferredEngine, traits, diagnostic);
  }
  if (selectedCapability === SUPPORT.UNSUPPORTED) {
    return result("incompatible", "fatal", unsupportedReason(traits, pipeline), preferredEngine, traits, diagnostic);
  }
  if (selectedCapability === SUPPORT.UNKNOWN) {
    return result("unknown", "warning", traits.hdrFormat !== "sdr" && traits.hdrFormat !== "unknown"
      ? "UNKNOWN_HDR_COMPATIBILITY"
      : "MISSING_CODEC_METADATA", preferredEngine, traits, diagnostic);
  }
  if (selectedCapability === SUPPORT.MAYBE) {
    return result("unknown", "warning", traits.hdrFormat !== "sdr" && traits.hdrFormat !== "unknown"
      ? "UNKNOWN_HDR_COMPATIBILITY"
      : "MISSING_CODEC_METADATA", preferredEngine, traits, diagnostic);
  }

  if (["hdr10plus", "hlg"].includes(traits.hdrFormat)) {
    return result("unknown", "warning", "UNSUPPORTED_HDR_PROFILE", preferredEngine, traits, diagnostic);
  }
  return result("compatible", "none", "", preferredEngine, traits, diagnostic);
}

export function compatibilityRank(decision = {}) {
  if (decision.status === "compatible") return 0;
  if (decision.status === "unknown") return 1;
  return 2;
}

export function isSdrAvcFallback(decision = {}) {
  const traits = decision.traits || {};
  return decision.status === "compatible"
    && traits.videoCodec === "avc"
    && (traits.hdrFormat === "sdr" || traits.hdrFormat === "unknown")
    && Number(traits.bitDepth || 0) < 10;
}
