import { LocalStore } from "../../core/storage/localStore.js";

const PERSISTENT_CACHE_PREFIX = "nuvio_home_catalog_cache_v1_";
const CACHE_SCHEMA_VERSION = 1;

export const PersistentHomeCache = {
  buildKey(profileId, addonId, type, catalogId, language = "en") {
    return `${PERSISTENT_CACHE_PREFIX}${profileId || "1"}_${addonId}_${type}_${catalogId}_${language}`;
  },

  get(profileId, addonId, type, catalogId, language = "en") {
    try {
      const key = this.buildKey(profileId, addonId, type, catalogId, language);
      const data = LocalStore.get(key, null);
      if (!data || typeof data !== "object") {
        return null;
      }
      if (data.version !== CACHE_SCHEMA_VERSION || !Array.isArray(data.items)) {
        LocalStore.remove(key);
        return null;
      }
      return data;
    } catch (err) {
      console.warn("Failed to read persistent home cache", err);
      return null;
    }
  },

  set(profileId, addonId, type, catalogId, language = "en", items = [], nextPage = null) {
    try {
      const key = this.buildKey(profileId, addonId, type, catalogId, language);
      const payload = {
        version: CACHE_SCHEMA_VERSION,
        updatedAt: Date.now(),
        items: Array.isArray(items) ? items.slice(0, 20) : [],
        nextPage: nextPage || null
      };
      LocalStore.set(key, payload);
    } catch (err) {
      console.warn("Failed to write persistent home cache", err);
    }
  },

  remove(profileId, addonId, type, catalogId, language = "en") {
    try {
      const key = this.buildKey(profileId, addonId, type, catalogId, language);
      LocalStore.remove(key);
    } catch (_) {}
  }
};
