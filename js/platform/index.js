import { browserAdapter } from "./adapters/browserAdapter.js";
import { webosAdapter } from "./adapters/webosAdapter.js";
import { tizenAdapter } from "./adapters/tizenAdapter.js";

const ADAPTERS = {
  browser: browserAdapter,
  webos: webosAdapter,
  tizen: tizenAdapter
};

function webOsMajorFromChromium(chromiumMajor) {
  const value = Number(chromiumMajor || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  // LG's engine generations are fixed for the webOS releases that this TV
  // build supports: Chromium 38→webOS 3, 53→4, 68→5 and 79→6.
  if (value <= 38) return 3;
  if (value <= 53) return 4;
  if (value <= 68) return 5;
  if (value <= 79) return 6;
  if (value <= 87) return 22;
  if (value <= 94) return 23;
  if (value <= 108) return 24;
  if (value <= 120) return 25;
  return 25;
}

export function parseWebOsMajorVersion(candidateValues = null) {
  const candidates = Array.isArray(candidateValues)
    ? candidateValues.map((value) => String(value || "")).filter(Boolean)
    : [
        String(globalThis.PalmSystem?.deviceInfo || ""),
        String(globalThis.webOSSystem?.deviceInfo || ""),
        String(globalThis.navigator?.userAgent || "")
      ].filter(Boolean);

  const patterns = [
    { kind: "webos", expression: /web0s\.tv[\s\-\/]?(\d{1,2})/i },
    { kind: "webos", expression: /webos\.tv[\s\-\/]?(\d{1,2})/i },
    { kind: "webos", expression: /web0s[\s\-\/]?(\d{1,2})/i },
    { kind: "webos", expression: /webos[\s\-\/]?(\d{1,2})/i },
    { kind: "chromium", expression: /chromium\/(\d{2,3})/i },
    { kind: "chromium", expression: /chrome\/(\d{2,3})/i }
  ];

  for (const candidate of candidates) {
    for (const pattern of patterns) {
      const match = candidate.match(pattern.expression);
      if (!match) {
        continue;
      }
      const value = Number(match[1] || 0);
      if (!Number.isFinite(value) || value <= 0) {
        continue;
      }
      return pattern.kind === "chromium" ? webOsMajorFromChromium(value) : value;
    }
  }
  return 0;
}

function detectPlatformName() {
  const override = String(globalThis.__NUVIO_PLATFORM__ || "")
    .trim()
    .toLowerCase();
  if (override && ADAPTERS[override]) {
    return override;
  }
  const searchParams = String(globalThis.location?.search || "").toLowerCase();
  if (searchParams.includes("wrapper=tizen") || searchParams.includes("source=tizenbrew")) {
    return "tizen";
  }
  const userAgent = String(globalThis.navigator?.userAgent || "").toLowerCase();
  if (globalThis.webOS || globalThis.PalmSystem || globalThis.webOSSystem) {
    return "webos";
  }
  if (userAgent.includes("webos") || userAgent.includes("web0s")) {
    return "webos";
  }
  const webapis = globalThis.webapis || {};
  if (
    globalThis.tizen ||
    globalThis.avplay ||
    webapis.avplay ||
    webapis.avPlay ||
    webapis.productinfo ||
    userAgent.includes("tizen")
  ) {
    return "tizen";
  }
  return "browser";
}

function getAdapter() {
  if (!Platform.current) {
    Platform.current = ADAPTERS[detectPlatformName()];
  }
  return Platform.current;
}

export const Platform = {
  current: null,

  init() {
    const adapter = getAdapter();
    adapter.init?.();
    return adapter;
  },

  getName() {
    return getAdapter().name;
  },

  isWebOS() {
    return this.getName() === "webos";
  },

  getWebOsMajorVersion() {
    if (!this.isWebOS()) {
      return 0;
    }
    return parseWebOsMajorVersion();
  },

  isTizen() {
    return this.getName() === "tizen";
  },

  isBrowser() {
    return this.getName() === "browser";
  },

  exitApp() {
    if (globalThis.document && typeof globalThis.CustomEvent === "function") {
      const beforeExitEvent = new CustomEvent("nuvio:beforeExitApp", {
        cancelable: true
      });
      globalThis.document.dispatchEvent(beforeExitEvent);
      if (beforeExitEvent.defaultPrevented) {
        return false;
      }
    }
    return getAdapter().exitApp();
  },

  isBackEvent(event) {
    return getAdapter().isBackEvent(event);
  },

  normalizeKey(event) {
    return getAdapter().normalizeKey(event);
  },

  getDeviceLabel() {
    return getAdapter().getDeviceLabel();
  },

  getCapabilities() {
    return getAdapter().getCapabilities();
  },

  prepareVideoElement(videoElement) {
    return getAdapter().prepareVideoElement?.(videoElement);
  }
};
