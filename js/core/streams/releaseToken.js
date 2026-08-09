// Release labels must be token-bound: words in a title such as "Camp" and
// "Lights" are not CAM/TS quality markers.
export function hasReleaseToken(text = "", token = "") {
  const escaped = String(token || "")
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) {
    return false;
  }
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(String(text || ""));
}
