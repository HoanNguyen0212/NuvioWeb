export function shouldPreserveHomeDom({
  isTizen = false,
  hasLoadedOnce = false,
  hasRows = false,
  hasDom = false
} = {}) {
  // Do not retain the focusable Home tree on legacy webOS. Chromium 53 can
  // continue dispatching remote focus through that hidden tree after Detail
  // opens, which leaves the visible screen without usable D-pad navigation.
  return Boolean(isTizen && hasLoadedOnce && hasRows && hasDom);
}

export function shouldDeferHorizontalHomeEffects({
  direction = "",
  isLegacyTvRuntime = false,
  usesImmediateNodeScroll = false
} = {}) {
  return Boolean(
    (direction === "left" || direction === "right") &&
    (isLegacyTvRuntime || usesImmediateNodeScroll)
  );
}

export function shouldResumePreservedHome({
  isTizen = false,
  isLegacyTvRuntime = false,
  isBackNavigation = false,
  homeDomPreserved = false,
  hasLoadedOnce = false,
  hasRows = false,
  hasDom = false,
  renderedLayoutMode = "",
  layoutMode = ""
} = {}) {
  return Boolean(
    shouldPreserveHomeDom({
      isTizen,
      isLegacyTvRuntime,
      hasLoadedOnce,
      hasRows,
      hasDom
    }) &&
    isBackNavigation &&
    homeDomPreserved &&
    String(renderedLayoutMode || "") === String(layoutMode || "")
  );
}
