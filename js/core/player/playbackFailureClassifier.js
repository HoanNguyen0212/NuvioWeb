const VIDEO_INCOMPATIBILITY_REASONS = new Set([
  "UNSUPPORTED_AV1",
  "UNSUPPORTED_VP9_PROFILE2",
  "UNSUPPORTED_HEVC_MAIN10_NATIVE",
  "UNSUPPORTED_HEVC_MAIN10_MSE",
  "UNSUPPORTED_DOLBY_VISION",
  "UNSUPPORTED_HDR_PROFILE",
  "UNSUPPORTED_VIDEO_CODEC"
]);

function normalizedDetail(eventDetail = {}) {
  return [
    eventDetail.hlsErrorType,
    eventDetail.hlsErrorDetails,
    eventDetail.dashError,
    eventDetail.avplayError,
    eventDetail.compatibilityReason,
    eventDetail.failureClassification
  ].map((value) => String(value || "").toLowerCase()).join(" ");
}

export function isImmediateStartupDecoderFailure({ mediaErrorCode = 0, diagnostics = {}, now = Date.now() } = {}) {
  const elapsedMs = Math.max(0, Number(now || 0) - Number(diagnostics.startedAt || 0));
  const currentTime = Number(diagnostics.currentTime || 0);
  return Number(mediaErrorCode) === 3
    && Number(diagnostics.startedAt || 0) > 0
    && elapsedMs <= 5000
    && currentTime <= 0.25
    && !Number(diagnostics.firstTimeProgressAt || 0)
    && !diagnostics.hasTimeProgress;
}

export function classifyPlaybackFailure({
  mediaErrorCode = 0,
  eventDetail = {},
  diagnostics = {},
  capabilityDecision = null,
  now = Date.now()
} = {}) {
  const detail = normalizedDetail(eventDetail);
  const reason = String(
    eventDetail.compatibilityReason
    || capabilityDecision?.reason
    || ""
  ).trim();
  const immediateDecode = isImmediateStartupDecoderFailure({ mediaErrorCode, diagnostics, now });
  const hasPresentedFrame = Boolean(
    diagnostics.firstFrameAt
    || diagnostics.firstTimeProgressAt
    || diagnostics.hasTimeProgress
  );

  if (detail.includes("unsupported_mse_codec") || detail.includes("manifestincompatiblecodecs")) {
    return "UNSUPPORTED_MSE_CODEC";
  }
  if (/bufferfullerror|buffer full|quotaexceeded/.test(detail)) {
    return "MSE_BUFFER_PRESSURE";
  }
  if (/bufferappenderror|buffer append|appendbuffer|sourcebuffer.*append/.test(detail)) {
    return "MSE_APPEND_FAILURE";
  }
  if (/network|timeout|timed out|fragloaderror|levelloaderror|manifestloaderror|download|truncated/.test(detail)
    || Number(mediaErrorCode) === 2) {
    return "NETWORK_MEDIA_FAILURE";
  }
  if (immediateDecode && reason === "UNSUPPORTED_AUDIO_CODEC") {
    return "UNSUPPORTED_AUDIO_CODEC";
  }
  if (immediateDecode && VIDEO_INCOMPATIBILITY_REASONS.has(reason)) {
    return "UNSUPPORTED_HDR_CODEC_OR_PROFILE";
  }
  if (Number(mediaErrorCode) === 3 && hasPresentedFrame) {
    return "CORRUPT_OR_UNSUPPORTED_FRAGMENT";
  }
  if (immediateDecode) {
    return "UNKNOWN_MEDIA_DECODE";
  }
  if (Number(mediaErrorCode) === 4 && reason === "UNSUPPORTED_AUDIO_CODEC") {
    return "UNSUPPORTED_AUDIO_CODEC";
  }
  if (Number(mediaErrorCode) === 4 && VIDEO_INCOMPATIBILITY_REASONS.has(reason)) {
    return "UNSUPPORTED_HDR_CODEC_OR_PROFILE";
  }
  return "UNKNOWN_MEDIA_DECODE";
}

export function isCodecFallbackClassification(value = "") {
  return value === "UNSUPPORTED_HDR_CODEC_OR_PROFILE"
    || value === "UNSUPPORTED_AUDIO_CODEC"
    || value === "UNSUPPORTED_MSE_CODEC";
}
