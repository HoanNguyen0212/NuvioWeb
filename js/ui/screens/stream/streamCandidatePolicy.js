function getStreamCandidateHost(url = "") {
  try {
    return String(new URL(String(url || "")).hostname || "").toLowerCase();
  } catch (_) {
    return "";
  }
}

function getStreamCandidateText(stream = {}) {
  return [stream.name, stream.title, stream.description]
    .map((value) => String(value || ""))
    .join("\n");
}

function getStreamAddonIdentity(stream = {}) {
  return [
    stream.addonId,
    stream.addonName,
    stream.addonBaseUrl,
    stream.streamOrigin?.addonId,
    stream.streamOrigin?.addonName,
    stream.streamOrigin?.addonBaseUrl
  ]
    .map((value) => String(value || ""))
    .join("\n");
}

export function isPlayableStreamCandidate(stream) {
  const url = String(stream?.url || stream?.externalUrl || stream?.raw?.url || stream?.raw?.externalUrl || "");
  if (!url) {
    return false;
  }
  const candidateText = getStreamCandidateText(stream);
  const addonIdentity = getStreamAddonIdentity(stream);
  const isPengu = /pengu/i.test(addonIdentity);

  // Some addon updates return promotional rows as ordinary stream objects.
  // Match their stable text markers as the URL itself can look media-like.
  if (
    /\b(?:looking for donations?|donation needed|click here to donate)\b/i.test(candidateText) ||
    /\/(?:donate|donation|telegram|tg|discord)\b/i.test(url)
  ) {
    return false;
  }

  // Pengu republishes 2Peckle and Artemis choices under changing labels.
  // Both source families returned MEDIA_ERR_SRC_NOT_SUPPORTED on this TV;
  // requiring both labels in one row allowed newer 2Peckle-only rows through.
  if (isPengu && /\b(?:2Peckle|Artemis)\b/i.test(candidateText)) {
    return false;
  }

  // HDHub is nested inside PenguPlay, so addon identity alone is insufficient.
  // Worker/Castle/PixelDrain/cloudflarestorage mirrors all fail with media error
  // 4 on Chromium 53. Keep Pengu's verified FSL and HLS source families visible.
  if (
    isPengu &&
    /hdhub/i.test(candidateText) &&
    /\b(?:Worker|Castle|PixelDrain|cloudflarestorage)\b/i.test(candidateText)
  ) {
    return false;
  }

  // Filter out non-streamable ZIP archives (e.g. .mkv.zip).
  if (/\.zip(?:$|\?)/i.test(url)) {
    return false;
  }
  // Filter out 10Gbps Download-only web pages.
  if (/\b(?:hubcloud|gpdl\.hubcloud)\.cx\b/i.test(url)) {
    return false;
  }
  // Filter out redirect shorteners that require browser interaction.
  if (/\b(?:hub\.pyramid\.surf|hub\.latent\.click|bzzhr\.co)\b/i.test(url)) {
    return false;
  }

  if (/hdhub/i.test(addonIdentity)) {
    const host = getStreamCandidateHost(url);
    const isDirectFslHost = host === "cdn.fsl-buckets.life";
    const isDirectR2Host = /(?:^|\.)r2\.dev$/i.test(host);
    if (!isDirectFslHost && !isDirectR2Host) {
      return false;
    }
  }

  return true;
}
