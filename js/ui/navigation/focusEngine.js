import { Router } from "./router.js";
import { Platform } from "../../platform/index.js";

function buildNormalizedEvent(event) {
  const normalizedKey = Platform.normalizeKey(event);
  const normalizedCode = Number(normalizedKey.keyCode || 0);

  return {
    key: normalizedKey.key,
    code: normalizedKey.code,
    keyName: normalizedKey.keyName,
    target: event?.target || null,
    altKey: Boolean(event?.altKey),
    ctrlKey: Boolean(event?.ctrlKey),
    shiftKey: Boolean(event?.shiftKey),
    metaKey: Boolean(event?.metaKey),
    repeat: Boolean(event?.repeat),
    defaultPrevented: Boolean(event?.defaultPrevented),
    keyCode: normalizedCode,
    which: normalizedCode,
    originalKeyCode: Number(normalizedKey.originalKeyCode || event?.keyCode || 0),
    keyDownDurationMs: 0,
    preventDefault: () => {
      if (typeof event?.preventDefault === "function") {
        event.preventDefault();
      }
    },
    stopPropagation: () => {
      if (typeof event?.stopPropagation === "function") {
        event.stopPropagation();
      }
    },
    stopImmediatePropagation: () => {
      if (typeof event?.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
    }
  };
}

function hasActiveModal() {
  return Boolean(globalThis?.document?.body?.classList?.contains("nuvio-modal-open"));
}

const BACK_DEBOUNCE_MS = 250;
const TIZEN_PAIRED_BACK_EVENT_WINDOW_MS = 3000;

function getBackInputChannel(event) {
  return String(event?.type || "").toLowerCase() === "tizenhwkey"
    ? "tizenhwkey"
    : "keydown";
}

function recordFocusMetric(name) {
  if (!globalThis?.__NUVIO_DEBUG_LEGACY_METRICS__) {
    return;
  }
  const root = globalThis.__NUVIO_LEGACY_METRICS__ || (globalThis.__NUVIO_LEGACY_METRICS__ = {});
  const focus = root.focus || (root.focus = {});
  focus[name] = Number(focus[name] || 0) + 1;
}

function getPointerFocusable(node, root) {
  var curr = node;
  while (curr && curr !== root && curr !== document.body) {
    if (curr.nodeType === 1 && curr.classList && curr.classList.contains("focusable")) {
      if (
        curr.disabled ||
        curr.classList.contains("is-disabled") ||
        curr.classList.contains("disabled") ||
        curr.getAttribute("aria-disabled") === "true"
      ) {
        return null;
      }
      return curr;
    }
    curr = curr.parentNode;
  }
  return null;
}

export const FocusEngine = {
  initialized: false,
  lastBackHandledAt: 0,
  lastBackHandledChannel: "",
  currentFocusedElement: null,
  lastPointerFocusTarget: null,
  pointerMoveFrame: null,
  pendingPointerMoveEvent: null,
  activeKeyDownStartedAt: new Map(),

  // Magic Remote / Mouse jitter threshold & Remote Lock state
  inputMode: "remote",
  mouseLockedUntil: 0,
  lastMouseX: -1,
  lastMouseY: -1,
  mouseThresholdPx: 8,
  remoteLockMs: 450,
  lastActivationTime: 0,
  lastActivationTarget: null,

  init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.boundHandleKey = this.handleKey.bind(this);
    this.boundHandleKeyUp = this.handleKeyUp.bind(this);
    this.boundHandleTizenHardwareKey = this.handleTizenHardwareKey.bind(this);
    this.boundHandlePointerMove = this.handlePointerMove.bind(this);
    this.boundHandlePointerClick = this.handlePointerClick.bind(this);
    document.addEventListener("keydown", this.boundHandleKey, true);
    document.addEventListener("keyup", this.boundHandleKeyUp, true);
    if (Platform.isTizen()) {
      document.addEventListener("tizenhwkey", this.boundHandleTizenHardwareKey, true);
      window.addEventListener("tizenhwkey", this.boundHandleTizenHardwareKey, true);
    }
    if (Platform.isWebOS()) {
      // Only attach mousemove on webOS legacy to avoid dual event callbacks.
      document.addEventListener("mousemove", this.boundHandlePointerMove, true);
      document.addEventListener("click", this.boundHandlePointerClick, true);
      document.documentElement?.classList?.add("webos-pointer-remote");
      document.body?.classList?.add("webos-pointer-remote");
    }
  },

  destroy() {
    if (!this.initialized) {
      return;
    }
    document.removeEventListener("keydown", this.boundHandleKey, true);
    document.removeEventListener("keyup", this.boundHandleKeyUp, true);
    if (Platform.isTizen()) {
      document.removeEventListener("tizenhwkey", this.boundHandleTizenHardwareKey, true);
      window.removeEventListener("tizenhwkey", this.boundHandleTizenHardwareKey, true);
    }
    if (Platform.isWebOS()) {
      document.removeEventListener("mousemove", this.boundHandlePointerMove, true);
      document.removeEventListener("click", this.boundHandlePointerClick, true);
      document.documentElement?.classList?.remove("webos-pointer-remote");
      document.body?.classList?.remove("webos-pointer-remote");
    }
    if (this.pointerMoveFrame != null) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.pointerMoveFrame);
      }
      clearTimeout(this.pointerMoveFrame);
    }
    this.pointerMoveFrame = null;
    this.pendingPointerMoveEvent = null;
    this.currentFocusedElement = null;
    this.lastPointerFocusTarget = null;
    this.lastActivationTarget = null;
    this.activeKeyDownStartedAt.clear();
    this.boundHandleKey = null;
    this.boundHandleKeyUp = null;
    this.boundHandleTizenHardwareKey = null;
    this.boundHandlePointerMove = null;
    this.boundHandlePointerClick = null;
    this.initialized = false;
  },

  handleTizenHardwareKey(event) {
    const normalizedEvent = buildNormalizedEvent(event);
    if (!Platform.isBackEvent({
      target: normalizedEvent.target,
      key: normalizedEvent.key,
      code: normalizedEvent.code,
      keyName: normalizedEvent.keyName,
      keyCode: normalizedEvent.keyCode,
      originalKeyCode: normalizedEvent.originalKeyCode,
      detail: event?.detail || null
    })) {
      return;
    }
    this.handleBack(event, normalizedEvent);
  },

  handleBack(event, normalizedEvent = buildNormalizedEvent(event)) {
    const now = Date.now();
    const elapsedSinceHandled = now - Number(this.lastBackHandledAt || 0);
    const inputChannel = getBackInputChannel(event);
    const isPairedTizenEvent = Boolean(
      Platform.isTizen() &&
      this.lastBackHandledChannel &&
      this.lastBackHandledChannel !== inputChannel &&
      elapsedSinceHandled < TIZEN_PAIRED_BACK_EVENT_WINDOW_MS
    );
    if (
      normalizedEvent.repeat ||
      elapsedSinceHandled < BACK_DEBOUNCE_MS ||
      isPairedTizenEvent
    ) {
      normalizedEvent.preventDefault();
      normalizedEvent.stopPropagation();
      normalizedEvent.stopImmediatePropagation();
      Router.consumeRouteReturnBackGuard?.();
      return;
    }
    this.lastBackHandledAt = now;
    this.lastBackHandledChannel = inputChannel;

    normalizedEvent.preventDefault();
    normalizedEvent.stopPropagation();
    normalizedEvent.stopImmediatePropagation();

    if (Router.consumeRouteReturnBackGuard?.()) {
      return;
    }

    const currentScreen = Router.getCurrentScreen();
    const consumeResult = currentScreen?.consumeBackRequest?.();
    if (consumeResult) {
      if (consumeResult === "history") {
        return;
      }
      Router.suppressNextPopstate?.();
      return;
    }

    Router.back();
  },

  handleKey(event) {
    if (event?.target && !document.contains(event.target)) {
      return;
    }

    // Switch to remote mode and lock pointer focus during D-pad navigation
    this.inputMode = "remote";
    this.mouseLockedUntil = Date.now() + this.remoteLockMs;

    if (hasActiveModal()) {
      return;
    }

    const normalizedEvent = buildNormalizedEvent(event);
    const keyIdentity = this.getKeyIdentity(normalizedEvent);
    if (keyIdentity && !this.activeKeyDownStartedAt.has(keyIdentity)) {
      this.activeKeyDownStartedAt.set(keyIdentity, Date.now());
    }

    if (
      Platform.isBackEvent({
        target: normalizedEvent.target,
        key: normalizedEvent.key,
        code: normalizedEvent.code,
        keyName: normalizedEvent.keyName,
        keyCode: normalizedEvent.keyCode,
        originalKeyCode: normalizedEvent.originalKeyCode
      })
    ) {
      this.handleBack(event, normalizedEvent);
      return;
    }

    const currentScreen = Router.getCurrentScreen();

    if (currentScreen?.onKeyDown) {
      Promise.resolve(currentScreen.onKeyDown(normalizedEvent)).catch((error) => {
        console.warn("Screen keydown handler failed", error);
      });
    }
  },

  handleKeyUp(event) {
    if (event?.target && !document.contains(event.target)) return;

    if (hasActiveModal()) {
      return;
    }

    const normalizedEvent = buildNormalizedEvent(event);
    const keyIdentity = this.getKeyIdentity(normalizedEvent);
    if (keyIdentity) {
      const startedAt = Number(this.activeKeyDownStartedAt.get(keyIdentity) || 0);
      normalizedEvent.keyDownDurationMs = startedAt > 0 ? Math.max(0, Date.now() - startedAt) : 0;
      this.activeKeyDownStartedAt.delete(keyIdentity);
    }

    const currentScreen = Router.getCurrentScreen();
    if (!currentScreen?.onKeyUp) {
      return;
    }
    Promise.resolve(currentScreen.onKeyUp(normalizedEvent)).catch((error) => {
      console.warn("Screen keyup handler failed", error);
    });
  },

  getKeyIdentity(event) {
    const keyCode = Number(event?.keyCode || event?.which || 0);
    if (keyCode) {
      return `code:${keyCode}`;
    }
    const key = String(event?.key || event?.code || event?.keyName || "").trim();
    return key ? `key:${key}` : "";
  },

  getPointerFocusable(event) {
    return getPointerFocusable(event?.target, document.body);
  },

  focusPointerTarget(target, event = null) {
    if (!target) {
      return false;
    }
    if (hasActiveModal() && !target.closest?.(".nuvio-dialog-backdrop")) {
      return false;
    }
    const currentScreen = Router.getCurrentScreen();
    const screenContainer =
      currentScreen?.container instanceof HTMLElement
        ? currentScreen.container
        : target.closest(".screen");
    if (screenContainer && !screenContainer.contains(target)) {
      return false;
    }

    if (target === this.currentFocusedElement && target.classList.contains("focused")) {
      return true;
    }

    const focusRoot = screenContainer || document;
    let previous = this.currentFocusedElement;
    if (
      !previous
      || !document.contains(previous)
      || !previous.classList.contains("focused")
      || (screenContainer && !screenContainer.contains(previous))
    ) {
      recordFocusMetric("focusReconcileScans");
      previous = focusRoot.querySelector?.(".focusable.focused") || null;
    }
    if (previous && previous !== target) {
      previous.classList.remove("focused");
    }
    target.classList.add("focused");
    this.currentFocusedElement = target;
    recordFocusMetric("focusChanges");

    // Native focus is reserved for text/select controls and explicit opt-ins.
    const usesNativeFocus =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.getAttribute("contenteditable") === "true" ||
      target.getAttribute("data-native-focus") === "true";
    if (usesNativeFocus) {
      recordFocusMetric("nativeFocusCalls");
      try {
        target.focus({ preventScroll: true });
      } catch (_) {
        try {
          target.focus();
        } catch (_) {}
      }
    }

    currentScreen?.onPointerFocus?.(target, event);
    this.lastPointerFocusTarget = target;
    return true;
  },

  handlePointerMove(event) {
    if (!Platform.isWebOS()) {
      return;
    }
    recordFocusMetric("mousemoveReceived");
    this.pendingPointerMoveEvent = event;
    if (this.pointerMoveFrame) {
      return;
    }
    const run = () => {
      this.pointerMoveFrame = null;
      const pendingEvent = this.pendingPointerMoveEvent;
      this.pendingPointerMoveEvent = null;
      this.processPointerMove(pendingEvent);
    };
    if (typeof requestAnimationFrame === "function") {
      this.pointerMoveFrame = requestAnimationFrame(run);
    } else {
      this.pointerMoveFrame = setTimeout(run, 16);
    }
  },

  processPointerMove(event) {
    if (!Platform.isWebOS() || !event) {
      return;
    }

    const now = Date.now();
    if (now < this.mouseLockedUntil) {
      recordFocusMetric("mousemoveIgnoredRemoteLock");
      return;
    }

    const clientX = Number(event.clientX || 0);
    const clientY = Number(event.clientY || 0);
    if (this.lastMouseX >= 0 && this.lastMouseY >= 0) {
      const dx = Math.abs(clientX - this.lastMouseX);
      const dy = Math.abs(clientY - this.lastMouseY);
      if (dx + dy < this.mouseThresholdPx) {
        recordFocusMetric("mousemoveIgnoredThreshold");
        return;
      }
    }
    this.lastMouseX = clientX;
    this.lastMouseY = clientY;
    this.inputMode = "mouse";

    const currentScreen = Router.getCurrentScreen();
    currentScreen?.onPointerMove?.(event);
    const target = this.getPointerFocusable(event);
    if (!target || target === this.lastPointerFocusTarget) {
      return;
    }
    if (hasActiveModal() && !target.closest?.(".nuvio-dialog-backdrop")) {
      return;
    }
    this.focusPointerTarget(target, event);
  },

  async handlePointerClick(event) {
    if (!Platform.isWebOS()) {
      return;
    }
    const target = this.getPointerFocusable(event);
    if (!target) {
      return;
    }

    // Double-activation prevention within 300ms on the same target
    const now = Date.now();
    if (this.lastActivationTarget === target && now - this.lastActivationTime < 300) {
      recordFocusMetric("duplicateActivationsBlocked");
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return;
    }
    recordFocusMetric("activations");
    this.lastActivationTime = now;
    this.lastActivationTarget = target;
    this.inputMode = "mouse";
    this.mouseLockedUntil = 0;

    if (hasActiveModal() && !target.closest?.(".nuvio-dialog-backdrop")) {
      return;
    }
    this.focusPointerTarget(target, event);
    const currentScreen = Router.getCurrentScreen();
    if (hasActiveModal()) {
      return;
    }

    // Root sidebar buttons already have the shared navigation handler bound
    // directly by sidebarNavigation. Invoke it during capture instead of
    // relying on the screen's cached focus zone, which may still point at the
    // previous content card after Magic Remote hover.
    const sidebarTarget = target.closest?.(
      ".home-sidebar .focusable, .modern-sidebar-panel .focusable"
    );
    if (sidebarTarget && typeof sidebarTarget.onclick === "function") {
      await sidebarTarget.onclick.call(sidebarTarget, event);
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      return;
    }

    const handled = typeof currentScreen?.onPointerActivate === "function"
      ? await currentScreen.onPointerActivate(target, event)
      : false;
    if (handled) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      return;
    }

    // Some legacy screens implement only special pointer actions and keep the
    // complete activation path in their Enter handler. Reuse that path after
    // pointer focus so a Magic Remote click does not require a D-pad nudge.
    if (typeof currentScreen?.onKeyDown === "function") {
      const routeBeforeActivation = Router.getCurrent();
      const enterEvent = buildNormalizedEvent({
        target,
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {}
      });
      await currentScreen.onKeyDown(enterEvent);

      // Poster grids and several legacy screens complete a short Enter press
      // on keyup so they can distinguish click from hold. A Magic Remote click
      // must provide that complete press, but only while the keydown has not
      // already navigated to another route.
      if (
        Router.getCurrent() === routeBeforeActivation &&
        Router.getCurrentScreen() === currentScreen &&
        typeof currentScreen.onKeyUp === "function"
      ) {
        await currentScreen.onKeyUp(enterEvent);
      }
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
    }
  }
};
