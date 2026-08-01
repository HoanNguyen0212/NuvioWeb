import { evaluateStreamCompatibility, isSdrAvcFallback } from "./streamCompatibility.js";

function sourceKeys(stream = {}) {
  return [stream.id, stream.url, stream.externalUrl]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

export function selectCompatibleFallbackSource(streams = [], {
  capabilities = {},
  attemptedSourceKeys = [],
  currentSource = null,
  compatibilityContext = {}
} = {}) {
  const attempted = attemptedSourceKeys instanceof Set
    ? attemptedSourceKeys
    : new Set(Array.isArray(attemptedSourceKeys) ? attemptedSourceKeys : []);
  sourceKeys(currentSource || {}).forEach((key) => attempted.add(key));
  const candidates = (Array.isArray(streams) ? streams : [])
    .map((stream, index) => ({
      stream,
      index,
      decision: evaluateStreamCompatibility(stream, capabilities, compatibilityContext)
    }))
    .filter(({ stream, decision }) => (
      decision.status === "compatible"
      && sourceKeys(stream).some((key) => !attempted.has(key))
      && !sourceKeys(stream).some((key) => attempted.has(key))
    ))
    .sort((left, right) => {
      const leftSdr = isSdrAvcFallback(left.decision) ? 0 : 1;
      const rightSdr = isSdrAvcFallback(right.decision) ? 0 : 1;
      return leftSdr - rightSdr || left.index - right.index;
    });
  return candidates[0] || null;
}
