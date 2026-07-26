export function requestWithDeadline(promise, deadlineMs, errorMessage = "Operation deadline exceeded") {
  let timerId = 0;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`${errorMessage} (${deadlineMs}ms)`));
    }, deadlineMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timerId) {
      clearTimeout(timerId);
    }
  });
}

export function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const signal = controller ? controller.signal : null;
  const mergedOptions = { ...options };
  if (signal) {
    mergedOptions.signal = signal;
  }

  let timerId = 0;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      if (controller && typeof controller.abort === "function") {
        try { controller.abort(); } catch (_) {}
      }
      reject(new Error(`Network request timeout (${url}, ${timeoutMs}ms)`));
    }, timeoutMs);
  });

  return Promise.race([fetch(url, mergedOptions), timeoutPromise]).finally(() => {
    if (timerId) {
      clearTimeout(timerId);
    }
  });
}
