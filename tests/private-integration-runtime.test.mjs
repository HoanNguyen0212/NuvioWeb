import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEnvProperties } from "../scripts/envProperties.mjs";

test("private runtime properties preserve TMDB and MDBList credentials", () => {
  const env = normalizeEnvProperties({
    TMDB_API_KEY: "private-tmdb-test-key",
    MDBLIST_API_KEY: "private-mdblist-test-key",
    MDBLIST_API_BASE_URL: "https://example.invalid/"
  });

  assert.equal(env.TMDB_API_KEY, "private-tmdb-test-key");
  assert.equal(env.MDBLIST_API_KEY, "private-mdblist-test-key");
  assert.equal(env.MDBLIST_API_BASE_URL, "https://example.invalid/");
});

test("private credentials auto-enable once without entering MDBList key in profile storage", async () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
  globalThis.__NUVIO_ENV__ = {
    TMDB_API_KEY: "private-tmdb-test-key",
    MDBLIST_API_KEY: "private-mdblist-test-key"
  };
  // Reproduce the TV state left by the original boolean-only migration: the
  // private marker exists, but an older cloud snapshot has disabled MDBList.
  values.set(
    "mdbListSettings",
    JSON.stringify({
      __profileScoped: true,
      version: 1,
      profiles: {
        "1": {
          enabled: false,
          privateCredentialInitialized: true,
          apiKey: "old-profile-key-must-not-survive"
        }
      }
    })
  );

  const [{ TmdbSettingsStore }, { MdbListSettingsStore }] = await Promise.all([
    import("../js/data/local/tmdbSettingsStore.js"),
    import("../js/data/local/mdbListSettingsStore.js")
  ]);

  const tmdb = TmdbSettingsStore.getForProfile("1");
  const mdbList = MdbListSettingsStore.getForProfile("1");
  assert.equal(tmdb.enabled, true);
  assert.equal(tmdb.privateCredentialInitialized, true);
  assert.equal(mdbList.enabled, true);
  assert.equal(mdbList.privateCredentialInitialized, true);
  assert.equal(mdbList.privateCredentialProvisionVersion, 1);
  assert.equal(mdbList.apiKey, "");

  TmdbSettingsStore.setForProfile("1", { enabled: false }, { silentSync: true });
  MdbListSettingsStore.setForProfile("1", { enabled: false }, { silentSync: true });
  assert.equal(TmdbSettingsStore.getForProfile("1").enabled, false);
  assert.equal(MdbListSettingsStore.getForProfile("1").enabled, false);
});
