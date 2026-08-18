export function shouldPreserveHomeDom({
  isTizen = false,
  isLegacyTvRuntime = false,
  hasLoadedOnce = false,
  hasRows = false,
  hasDom = false
} = {}) {
  return Boolean(
    (isTizen || isLegacyTvRuntime)
    && hasLoadedOnce
    && hasRows
    && hasDom
  );
}

export function shouldDeferHorizontalHomeEffects({
  direction = "",
  isLegacyTvRuntime = false,
  usesImmediateNodeScroll = false
} = {}) {
  return Boolean(
    (direction === "left" || direction === "right")
    && (isLegacyTvRuntime || usesImmediateNodeScroll)
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
    })
    && isBackNavigation
    && homeDomPreserved
    && String(renderedLayoutMode || "") === String(layoutMode || "")
  );
}
