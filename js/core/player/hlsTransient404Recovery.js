export const HLS_TRANSIENT_LEVEL_404_RETRY_LIMIT = 2;
export const HLS_TRANSIENT_LEVEL_404_RETRY_BASE_DELAY_MS = 1500;

export function getHlsErrorHttpStatus(data = {}) {
  const candidates = [
    data?.response?.code,
    data?.networkDetails?.status,
    data?.response?.status,
    data?.networkDetails?.statusCode
  ];
  for (const candidate of candidates) {
    const status = Number(candidate);
    if (Number.isFinite(status) && status > 0) {
      return status;
    }
  }
  return 0;
}

export function isTransientHlsLevel404(data = {}, Hls = null) {
  const networkError = Hls?.ErrorTypes?.NETWORK_ERROR || "networkError";
  const levelLoadError = Hls?.ErrorDetails?.LEVEL_LOAD_ERROR || "levelLoadError";
  return data?.type === networkError
    && data?.details === levelLoadError
    && getHlsErrorHttpStatus(data) === 404;
}

export function getHlsTransient404RetryDelay(retryNumber = 1) {
  const boundedRetry = Math.max(
    1,
    Math.min(HLS_TRANSIENT_LEVEL_404_RETRY_LIMIT, Number(retryNumber || 1))
  );
  return HLS_TRANSIENT_LEVEL_404_RETRY_BASE_DELAY_MS * boundedRetry;
}
