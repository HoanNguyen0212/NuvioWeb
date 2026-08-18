import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_WEBOS_NATIVE_STARTUP_RETRIES,
  shouldRetryWebOsNativeStartup
} from "./webOsNativeStartupRetry.js";

const eligible = {
  isWebOs: true,
  playerRouteActive: true,
  routeName: "player",
  activeUrl: "https://media.example/video.mp4",
  expectedUrl: "https://media.example/video.mp4",
  playbackEngine: "native-file",
  readyState: 3,
  networkState: 2,
  mediaError: null,
  lastPlaybackErrorCode: 0,
  hasPresentedPlaybackFrame: false,
  currentTimeAdvanced: false,
  retryCount: 0,
  hasEngineFsStream: false
};

test("webOS native startup retry is limited to the loaded-but-not-advancing edge case", () => {
  assert.equal(MAX_WEBOS_NATIVE_STARTUP_RETRIES, 1);
  assert.equal(shouldRetryWebOsNativeStartup(eligible), true);
  assert.equal(shouldRetryWebOsNativeStartup({ ...eligible, playbackEngine: "hls.js" }), false);
  assert.equal(shouldRetryWebOsNativeStartup({ ...eligible, playbackEngine: "dash.js" }), false);
  assert.equal(shouldRetryWebOsNativeStartup({ ...eligible, readyState: 2 }), false);
  assert.equal(shouldRetryWebOsNativeStartup({ ...eligible, networkState: 3 }), false);
  assert.equal(shouldRetryWebOsNativeStartup({ ...eligible, mediaError: { code: 3 } }), false);
  assert.equal(shouldRetryWebOsNativeStartup({ ...eligible, currentTimeAdvanced: true }), false);
  assert.equal(shouldRetryWebOsNativeStartup({ ...eligible, retryCount: 1 }), false);
  assert.equal(shouldRetryWebOsNativeStartup({ ...eligible, hasEngineFsStream: true }), false);
  assert.equal(shouldRetryWebOsNativeStartup({ ...eligible, expectedUrl: "https://other" }), false);
  assert.equal(shouldRetryWebOsNativeStartup({ ...eligible, routeName: "home" }), false);
});
