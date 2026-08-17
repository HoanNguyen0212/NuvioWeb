import { createProfileScopedStore } from "./profileScopedStore.js";
import { MDBLIST_API_KEY } from "../../config.js";

const KEY = "mdbListSettings";

const DEFAULTS = {
  enabled: false,
  privateCredentialInitialized: false,
  apiKey: "",
  showTrakt: true,
  showImdb: true,
  showTmdb: true,
  showLetterboxd: true,
  showTomatoes: true,
  showAudience: true,
  showMetacritic: true
};

function normalizeMdbListSettings(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const hasPrivateCredential = Boolean(String(MDBLIST_API_KEY || "").trim());
  const privateCredentialInitialized = source.privateCredentialInitialized === true;
  return {
    ...DEFAULTS,
    ...source,
    enabled: privateCredentialInitialized
      ? Boolean(source.enabled)
      : Boolean(source.enabled || hasPrivateCredential),
    privateCredentialInitialized: privateCredentialInitialized || hasPrivateCredential,
    // A private runtime credential must never be copied into profile storage or
    // profile-cloud sync. Keep the old per-profile field only as a fallback for
    // installations without a provisioned runtime key.
    apiKey: hasPrivateCredential ? "" : String(source.apiKey || "").trim(),
    showTrakt: value?.showTrakt !== false,
    showImdb: value?.showImdb !== false,
    showTmdb: value?.showTmdb !== false,
    showLetterboxd: value?.showLetterboxd !== false,
    showTomatoes: value?.showTomatoes !== false,
    showAudience: value?.showAudience !== false,
    showMetacritic: value?.showMetacritic !== false
  };
}

const store = createProfileScopedStore({
  key: KEY,
  normalize: normalizeMdbListSettings
});

export const MdbListSettingsStore = {
  getForProfile(profileId) {
    return store.getForProfile(profileId);
  },

  get() {
    return store.get();
  },

  replaceForProfile(profileId, nextValue, options = {}) {
    return store.replaceForProfile(profileId, nextValue, options);
  },

  setForProfile(profileId, partial, options = {}) {
    return store.setForProfile(profileId, partial, options);
  },

  set(partial, options = {}) {
    return store.set(partial, options);
  }
};
