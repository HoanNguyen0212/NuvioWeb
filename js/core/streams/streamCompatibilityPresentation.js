export function getStreamTraitLabels(traits = {}) {
  const labels = [];
  if (traits.hdrFormat === "dolby-vision") labels.push("Dolby Vision");
  else if (traits.hdrFormat === "hdr10plus") labels.push("HDR10+");
  else if (traits.hdrFormat === "hdr10") labels.push("HDR10");
  else if (traits.hdrFormat === "hlg") labels.push("HLG");
  else if (traits.hdrFormat === "unknown-hdr") labels.push("HDR");
  if (traits.videoCodec === "hevc" && (traits.videoProfile === "main10" || Number(traits.bitDepth || 0) >= 10)) {
    labels.push("HEVC 10-bit");
  } else if (traits.videoCodec === "hevc") {
    labels.push("HEVC");
  } else if (traits.videoCodec === "vp9" && traits.videoProfile === "profile2") {
    labels.push("VP9 Profile 2");
  } else if (traits.videoCodec === "av1") {
    labels.push("AV1");
  }
  return labels;
}

export function getCompatibilityLabel(decision = {}) {
  if (decision.status === "incompatible") return "Không tương thích với webOS Player";
  if (decision.status === "unknown") return "Có thể không tương thích";
  if (
    decision.status === "compatible"
    && decision.traits?.videoCodec === "avc"
    && ["sdr", "unknown"].includes(decision.traits?.hdrFormat)
  ) {
    return "SDR fallback";
  }
  return "";
}

export function getCompatibilityReasonLabel(reason = "") {
  const labels = {
    UNSUPPORTED_AV1: "AV1 không được hỗ trợ",
    UNSUPPORTED_VP9_PROFILE2: "VP9 Profile 2 không được hỗ trợ",
    UNSUPPORTED_HEVC_MAIN10_NATIVE: "Native Player không hỗ trợ HEVC Main10",
    UNSUPPORTED_HEVC_MAIN10_MSE: "MediaSource không hỗ trợ HEVC Main10",
    UNSUPPORTED_DOLBY_VISION: "Dolby Vision không được hỗ trợ qua HTML video",
    UNSUPPORTED_HDR_PROFILE: "HDR profile chưa được xác nhận tương thích",
    UNSUPPORTED_VIDEO_CODEC: "Video codec không được hỗ trợ",
    UNSUPPORTED_AUDIO_CODEC: "Không có audio codec tương thích",
    UNKNOWN_HDR_COMPATIBILITY: "Khả năng HDR chưa được xác nhận",
    MISSING_CODEC_METADATA: "Nguồn không cung cấp codec metadata"
  };
  return labels[String(reason || "")] || String(reason || "");
}
