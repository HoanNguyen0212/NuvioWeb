import assert from "node:assert/strict";
import test from "node:test";

import {
  HLS_TRANSIENT_LEVEL_404_RETRY_LIMIT,
  getHlsErrorHttpStatus,
  getHlsTransient404RetryDelay,
  isTransientHlsLevel404
} from "./hlsTransient404Recovery.js";

const Hls = {
  ErrorTypes: { NETWORK_ERROR: "networkError" },
  ErrorDetails: { LEVEL_LOAD_ERROR: "levelLoadError" }
};

test("HLS transient level 404 detection accepts legacy hls.js response shapes", () => {
  assert.equal(getHlsErrorHttpStatus({ response: { code: 404 } }), 404);
  assert.equal(getHlsErrorHttpStatus({ networkDetails: { status: 404 } }), 404);
  assert.equal(isTransientHlsLevel404({
    type: "networkError",
    details: "levelLoadError",
    response: { code: 404 }
  }, Hls), true);
  assert.equal(isTransientHlsLevel404({
    type: "networkError",
    details: "levelLoadError",
    networkDetails: { status: 404 }
  }, Hls), true);
  assert.equal(isTransientHlsLevel404({
    type: "networkError",
    details: "levelLoadError",
    response: { code: 500 }
  }, Hls), false);
  assert.equal(isTransientHlsLevel404({
    type: "networkError",
    details: "manifestLoadError",
    response: { code: 404 }
  }, Hls), false);
});

test("HLS transient level 404 backoff is bounded to two retries", () => {
  assert.equal(HLS_TRANSIENT_LEVEL_404_RETRY_LIMIT, 2);
  assert.equal(getHlsTransient404RetryDelay(1), 1500);
  assert.equal(getHlsTransient404RetryDelay(2), 3000);
  assert.equal(getHlsTransient404RetryDelay(20), 3000);
});
