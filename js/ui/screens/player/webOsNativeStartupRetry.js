export const MAX_WEBOS_NATIVE_STARTUP_RETRIES = 1;

export function shouldRetryWebOsNativeStartup({
  isWebOs = false,
  playerRouteActive = false,
  routeName = "",
  activeUrl = "",
  expectedUrl = "",
  playbackEngine = "",
  readyState = 0,
  networkState = 0,
  mediaError = null,
  lastPlaybackErrorCode = 0,
  hasPresentedPlaybackFrame = false,
  currentTimeAdvanced = false,
  retryCount = 0,
  hasEngineFsStream = false
} = {}) {
  const normalizedEngine = String(playbackEngine || "");
  const sourceIsCurrent = Boolean(activeUrl) && String(activeUrl) === String(expectedUrl || "");
  const sourceLoaded = Number(networkState) === 1 || Number(networkState) === 2;
  return Boolean(
    isWebOs &&
    playerRouteActive &&
    routeName === "player" &&
    sourceIsCurrent &&
    normalizedEngine.indexOf("native") === 0 &&
    Number(readyState) >= 3 &&
    sourceLoaded &&
    !mediaError &&
    Number(lastPlaybackErrorCode || 0) === 0 &&
    !hasPresentedPlaybackFrame &&
    !currentTimeAdvanced &&
    !hasEngineFsStream &&
    Number(retryCount || 0) < MAX_WEBOS_NATIVE_STARTUP_RETRIES
  );
}
