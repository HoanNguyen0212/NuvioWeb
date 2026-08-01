export function getLegacyHlsBufferPolicy(isWebOs = false) {
  return isWebOs ? {
    enableWorker: false,
    lowLatencyMode: false,
    backBufferLength: 9,
    maxBufferLength: 11,
    maxMaxBufferLength: 15,
    maxBufferSize: 12 * 1024 * 1024
  } : {
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 90,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    maxBufferSize: 60 * 1024 * 1024
  };
}

export function pickConservativeInitialLevel(levels = [], compatibleIndexes = null) {
  const candidates = Array.isArray(levels) ? levels : [];
  const allowed = compatibleIndexes instanceof Set
    ? compatibleIndexes
    : Array.isArray(compatibleIndexes) ? new Set(compatibleIndexes) : null;
  let selectedIndex = -1;
  let selectedScore = -1;
  candidates.forEach((level, index) => {
    if (allowed && !allowed.has(index)) return;
    const height = Number(level?.height || 0);
    const bitrate = Number(level?.bitrate || level?.attrs?.BANDWIDTH || 0);
    const withinConservativeStart = height <= 0 || height <= 1080;
    const score = (withinConservativeStart ? 1000000000000000 : 0) + (height * 1000000000) + bitrate;
    if (score > selectedScore) {
      selectedScore = score;
      selectedIndex = index;
    }
  });
  return selectedIndex;
}

export function compatibleIndexesAreContiguousFromZero(compatibleIndexes = []) {
  const allowed = compatibleIndexes instanceof Set
    ? compatibleIndexes
    : new Set(Array.isArray(compatibleIndexes) ? compatibleIndexes : []);
  if (!allowed.size) return false;
  const maxIndex = Math.max(...Array.from(allowed));
  for (let index = 0; index <= maxIndex; index += 1) {
    if (!allowed.has(index)) return false;
  }
  return true;
}
