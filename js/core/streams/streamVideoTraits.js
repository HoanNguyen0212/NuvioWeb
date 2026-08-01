const VIDEO_CODEC_UNKNOWN = "unknown";

function clean(value) {
  return String(value == null ? "" : value).replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

function values(value) {
  if (Array.isArray(value)) {
    return value.reduce((items, entry) => items.concat(values(entry)), []);
  }
  if (value && typeof value === "object") {
    return Object.keys(value).reduce((items, key) => items.concat(values(value[key])), []);
  }
  const text = clean(value);
  return text ? [text] : [];
}

function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getSources(stream = {}) {
  const raw = stream.raw || {};
  const parsed = raw.parsed || stream.parsed || {};
  const presentation = stream.streamPresentation || raw.streamPresentation || {};
  const explicit = values([
    stream.videoCodec,
    stream.codec,
    stream.videoProfile,
    stream.bitDepth,
    stream.hdrFormat,
    stream.audioCodec,
    stream.audioCodecs,
    stream.container,
    stream.protocol,
    raw.videoCodec,
    raw.codec,
    raw.videoProfile,
    raw.bitDepth,
    raw.hdrFormat,
    raw.audioCodec,
    raw.audioCodecs,
    raw.container,
    raw.protocol,
    raw.codecs,
    raw.mimeType,
    stream.mimeType
  ]);
  const parsedValues = values([
    parsed.codec,
    parsed.videoCodec,
    parsed.profile,
    parsed.videoProfile,
    parsed.bitDepth,
    parsed.hdr,
    parsed.audio,
    parsed.audioCodec,
    parsed.audioCodecs,
    parsed.container,
    presentation.encode,
    presentation.videoCodec,
    presentation.videoProfile,
    presentation.bitDepth,
    presentation.hdr,
    presentation.visualTags,
    presentation.audioTags,
    presentation.audioChannels
  ]);
  const filename = values([
    stream.behaviorHints?.filename,
    raw.behaviorHints?.filename,
    raw.filename,
    parsed.rawTitle,
    parsed.parsedTitle,
    raw.torrentName,
    stream.clientResolve?.filename,
    stream.clientResolve?.torrentName,
    stream.debridCacheStatus?.cachedName
  ]);
  const marketing = values([stream.name, stream.title, stream.description]);
  return { explicit, parsed: parsedValues, filename, marketing };
}

function joined(items) {
  return ` ${items.join(" ").toLowerCase().replace(/[._-]+/g, " ")} `;
}

function detectVideoCodec(text) {
  const found = [];
  if (/\b(?:h\.?264|avc|x264|avc1)\b/i.test(text)) found.push("avc");
  if (/\b(?:h\.?265|hevc|x265|hvc1|hev1)\b/i.test(text)) found.push("hevc");
  if (/\b(?:vp9|vp09)\b/i.test(text)) found.push("vp9");
  if (/\b(?:av1|av01)\b/i.test(text)) found.push("av1");
  return unique(found);
}

function detectAudioCodecs(text) {
  const codecs = [];
  if (/\b(?:dts[ .-]?hd(?:[ .-]?ma)?|dts:x|dtsx)\b/i.test(text)) codecs.push("dts-hd");
  else if (/\bdts\b/i.test(text)) codecs.push("dts");
  if (/\b(?:true[ .-]?hd|mlp[ .-]?fba)\b/i.test(text)) codecs.push("truehd");
  if (/\b(?:e[ .-]?ac[ .-]?3|eac3|ec[ .-]?3|ddp|dolby digital plus)\b/i.test(text)) codecs.push("eac3");
  if (/\b(?:ac[ .-]?3|ac3|dolby digital)\b/i.test(text) && !/dolby digital plus/i.test(text)) codecs.push("ac3");
  if (/\b(?:aac|mp4a(?:\.40\.\d+)?)\b/i.test(text)) codecs.push("aac");
  if (/\bopus\b/i.test(text)) codecs.push("opus");
  if (/\bflac\b/i.test(text)) codecs.push("flac");
  if (/\b(?:mp3|mpeg audio)\b/i.test(text)) codecs.push("mp3");
  return unique(codecs);
}

function detectHdrFormats(text) {
  const formats = [];
  if (/\b(?:dolby[ .-]?vision|dovi|do[ .-]?vi|dv(?:he|h1)?(?:[ .-]?(?:p|profile)?[ .-]?[578])?)\b/i.test(text)) formats.push("dolby-vision");
  if (/\bhdr10\+|\bhdr10[ .-]?plus\b/i.test(text)) formats.push("hdr10plus");
  if (/\bhdr10\b/i.test(text)) formats.push("hdr10");
  if (/\bhlg\b|hybrid log[ .-]?gamma/i.test(text)) formats.push("hlg");
  if (/\bhdr\b/i.test(text) && !formats.length) formats.push("unknown-hdr");
  if (/\bsdr\b/i.test(text)) formats.push("sdr");
  return unique(formats);
}

function detectContainer(text, url = "") {
  const probe = `${text} ${String(url || "").split(/[?#]/)[0]}`;
  if (/\bmatroska\b|\.mkv\b/i.test(probe)) return "mkv";
  if (/\.webm\b|\bwebm\b/i.test(probe)) return "webm";
  if (/\.m3u8\b|\bmpeg[ -]?ts\b|\.m2?ts\b/i.test(probe)) return "ts";
  if (/\.mp4\b|\.m4v\b|\b(?:mp4|quicktime)\b/i.test(probe)) return "mp4";
  return "unknown";
}

function detectProtocol(stream, text) {
  const url = String(stream.url || stream.externalUrl || stream.raw?.url || "").toLowerCase();
  const mime = String(stream.mimeType || stream.sourceType || stream.raw?.mimeType || "").toLowerCase();
  if (/\.m3u8(?:$|[?#])/.test(url) || /mpegurl|\bhls\b/.test(`${mime} ${text}`)) return "hls";
  if (/\.mpd(?:$|[?#])/.test(url) || /dash\+xml|\bdash\b/.test(`${mime} ${text}`)) return "dash";
  if (url || stream.infoHash || stream.clientResolve || stream.engineFs) return "direct";
  return "unknown";
}

function firstReliableDetection(sources, detector) {
  for (const confidence of ["explicit", "parsed", "filename"]) {
    const sourceItems = confidence === "filename"
      ? sources.filename.concat(sources.marketing)
      : sources[confidence];
    const detected = detector(joined(sourceItems));
    if (detected.length) return { detected, confidence };
  }
  return { detected: [], confidence: "unknown" };
}

export function parseCodecStringTraits(codecString = "") {
  const text = joined(values(codecString));
  const codecs = detectVideoCodec(text);
  const hdrFormats = detectHdrFormats(text);
  const main10 = /\bmain[ .-]?10\b|\bhvc1\.2\.|\bhev1\.2\.|\b10[ .-]?bit\b/i.test(text);
  const vp9Profile2 = /\bvp(?:9|09)(?:\.|[ .-])?0?2\b|\bprofile[ .-]?2\b/i.test(text) && codecs.includes("vp9");
  const bitDepthMatch = text.match(/\b(8|10|12)[ .-]?bit\b/i);
  return {
    videoCodec: codecs.length === 1 ? codecs[0] : VIDEO_CODEC_UNKNOWN,
    videoProfile: main10 ? "main10" : vp9Profile2 ? "profile2" : codecs.includes("hevc") ? "main" : "unknown",
    bitDepth: Number(bitDepthMatch?.[1] || (main10 || vp9Profile2 ? 10 : 0)),
    hdrFormats,
    audioCodecs: detectAudioCodecs(text)
  };
}

export function parseStreamVideoTraits(stream = {}) {
  const sources = getSources(stream);
  const codecResult = firstReliableDetection(sources, detectVideoCodec);
  const explicitCodec = detectVideoCodec(joined(sources.explicit));
  const parsedCodec = detectVideoCodec(joined(sources.parsed));
  const codecConflict = explicitCodec.length > 1
    || (explicitCodec.length === 1 && parsedCodec.length === 1 && explicitCodec[0] !== parsedCodec[0]);
  const videoCodec = codecConflict || codecResult.detected.length !== 1
    ? VIDEO_CODEC_UNKNOWN
    : codecResult.detected[0];

  const trustedText = joined(sources.explicit.concat(sources.parsed));
  const fallbackText = joined(sources.filename.concat(sources.marketing));
  const allText = `${trustedText} ${fallbackText}`;
  const explicitSdr = /\bsdr\b/i.test(trustedText);
  const trustedHdr = detectHdrFormats(trustedText);
  const filenameHdr = detectHdrFormats(fallbackText);
  let hdrFormats = trustedHdr.length ? trustedHdr : filenameHdr;
  if (explicitSdr && !trustedHdr.some((format) => format !== "sdr")) hdrFormats = ["sdr"];
  const hdrConflict = hdrFormats.includes("sdr") && hdrFormats.some((format) => format !== "sdr");
  if (hdrConflict) hdrFormats = [];

  const hasMain10 = /\bmain[ .-]?10\b|\b10[ .-]?bit\b|\bhvc1\.2\.|\bhev1\.2\./i.test(allText);
  const hasVp9Profile2 = videoCodec === "vp9" && (/\bprofile[ .-]?2\b|\bvp(?:9|09)(?:\.|[ .-])?0?2\b/i.test(allText));
  const bitDepthMatches = [];
  const bitDepthPattern = /\b(8|10|12)[ .-]?bit\b/gi;
  let bitDepthMatch = bitDepthPattern.exec(allText);
  while (bitDepthMatch) {
    bitDepthMatches.push(bitDepthMatch[1]);
    bitDepthMatch = bitDepthPattern.exec(allText);
  }
  const uniqueBitDepthMatches = unique(bitDepthMatches);
  const bitDepth = uniqueBitDepthMatches.length === 1
    ? Number(uniqueBitDepthMatches[0])
    : hasMain10 || hasVp9Profile2 ? 10 : 0;
  const videoProfile = hasMain10 && videoCodec === "hevc"
    ? "main10"
    : hasVp9Profile2 ? "profile2" : videoCodec === "hevc" ? "main" : "unknown";
  const dolbyVisionProfileMatch = allText.match(/\b(?:dolby[ .-]?vision|dovi|do[ .-]?vi|dv)(?:[ .-]?(?:p|profile))?[ .-]?([578])\b/i);
  const hdrFormat = hdrFormats.includes("dolby-vision")
    ? "dolby-vision"
    : hdrFormats.includes("hdr10plus") ? "hdr10plus"
      : hdrFormats.includes("hdr10") ? "hdr10"
        : hdrFormats.includes("hlg") ? "hlg"
          : hdrFormats.includes("sdr") ? "sdr"
            : hdrFormats.includes("unknown-hdr") ? "unknown-hdr" : "unknown";
  const audioCodecs = unique(detectAudioCodecs(allText));
  const url = stream.url || stream.externalUrl || stream.raw?.url || "";
  const container = detectContainer(allText, url);
  const protocol = detectProtocol(stream, allText);
  const hasTrustedExplicitHdr = detectHdrFormats(joined(sources.explicit)).length > 0;
  const hasTrustedParsedHdr = detectHdrFormats(joined(sources.parsed)).length > 0;
  const confidence = codecConflict || hdrConflict
    ? "unknown"
    : codecResult.confidence === "explicit" || hasTrustedExplicitHdr ? "explicit"
      : codecResult.confidence === "parsed" || hasTrustedParsedHdr ? "parsed"
        : codecResult.confidence === "filename" || filenameHdr.length ? "filename"
          : "unknown";

  return {
    videoCodec,
    videoProfile,
    videoLevel: clean(stream.videoLevel || stream.raw?.videoLevel || stream.raw?.parsed?.level || ""),
    bitDepth,
    hdrFormat,
    hdrFormats,
    dolbyVisionProfile: dolbyVisionProfileMatch?.[1] || "",
    container,
    protocol,
    audioCodecs,
    confidence
  };
}
