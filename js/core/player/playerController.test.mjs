import assert from "node:assert/strict";
import test from "node:test";

import { PlayerController } from "./playerController.js";

function createController(renderMode) {
  const calls = [];
  const avplay = {
    setSilentSubtitle(silent) {
      calls.push(["setSilentSubtitle", silent]);
    },
    setSelectTrack(type, index) {
      calls.push(["setSelectTrack", type, index]);
    }
  };
  const controller = Object.create(PlayerController);
  Object.assign(controller, {
    avplaySubtitleRenderMode: renderMode,
    avplaySubtitleTracks: [{ avplayTrackIndex: 4 }],
    getAvPlay: () => avplay,
    getAvPlayState: () => "PLAYING",
    reapplyTizenAvPlayDisplayRect() {}
  });
  return { calls, controller };
}

test("AVPlay re-arms native subtitles before selecting a track", () => {
  const { calls, controller } = createController("native");

  assert.equal(controller.trySelectAvPlaySubtitleTrackIndex(4), true);
  assert.deepEqual(calls, [
    ["setSilentSubtitle", true],
    ["setSelectTrack", "TEXT", 4],
    ["setSilentSubtitle", false]
  ]);
  assert.equal(controller.avplaySubtitlesSilent, false);
  assert.equal(controller.avplayNativeSubtitleRendering, true);
});

test("AVPlay re-arms HTML subtitle callbacks before selecting a track", () => {
  const { calls, controller } = createController("html");

  assert.equal(controller.trySelectAvPlaySubtitleTrackIndex(4), true);
  assert.deepEqual(calls, [
    ["setSilentSubtitle", false],
    ["setSelectTrack", "TEXT", 4],
    ["setSilentSubtitle", true]
  ]);
  assert.equal(controller.avplaySubtitlesSilent, false);
  assert.equal(controller.avplayNativeSubtitleRendering, false);
});

test("HLS level 404 retry timer is bounded and cleared with the HLS instance", () => {
  const hls = {
    destroyCalls: 0,
    destroy() {
      this.destroyCalls += 1;
    },
    loadSource() {},
    startLoad() {}
  };
  const controller = Object.create(PlayerController);
  Object.assign(controller, {
    hlsInstance: hls,
    hlsTransientLevel404RetryTimer: null,
    hlsTransientLevel404RetryCount: 0,
    hlsTransientLevel404FailureRecorded: false,
    isPlaybackRequestActive: () => true
  });

  assert.equal(controller.scheduleHlsTransientLevel404Retry({
    hls,
    url: "https://media.example/master.m3u8",
    playToken: 1
  }), true);
  assert.equal(controller.hlsTransientLevel404RetryCount, 1);
  assert.notEqual(controller.hlsTransientLevel404RetryTimer, null);

  controller.teardownHlsInstance();
  assert.equal(controller.hlsTransientLevel404RetryTimer, null);
  assert.equal(controller.hlsTransientLevel404RetryCount, 0);
  assert.equal(controller.hlsInstance, null);
  assert.equal(hls.destroyCalls, 1);

  controller.hlsInstance = hls;
  controller.hlsTransientLevel404RetryCount = 2;
  assert.equal(controller.scheduleHlsTransientLevel404Retry({
    hls,
    url: "https://media.example/master.m3u8",
    playToken: 1
  }), false);
  assert.equal(controller.hlsTransientLevel404FailureRecorded, true);
  controller.clearHlsTransientLevel404Retry();
});
