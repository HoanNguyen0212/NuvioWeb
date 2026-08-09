// Keep this DOM-free so it can be regression-tested under Node as well as used
// by legacy TV routes. A retained shell is safe only when the full markup is
// byte-identical; partial/hash comparisons can retain stale catalog content.
export function shouldWriteMarkup(container, shellSelector, previousMarkup, nextMarkup) {
  const shellMounted = Boolean(container?.querySelector?.(shellSelector));
  return !shellMounted || previousMarkup !== nextMarkup;
}
