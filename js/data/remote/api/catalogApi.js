import { httpRequest } from "../../../core/network/httpClient.js";

export const CatalogApi = {
  async getCatalog(url) {
    return httpRequest(url, {
      includeSessionAuth: false
    });
  },

  getCatalogCancelable(url) {
    let xhr = null;
    let settled = false;
    const promise = new Promise((resolve, reject) => {
      xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.onreadystatechange = function () {
        if (!xhr || xhr.readyState !== 4 || settled) return;
        settled = true;
        const status = Number(xhr.status || 0);
        if (status >= 200 && status < 300) {
          try {
            resolve(JSON.parse(String(xhr.responseText || "")));
          } catch (error) {
            reject(error);
          }
          return;
        }
        const error = new Error(`HTTP ${status || 0}`);
        error.status = status;
        reject(error);
      };
      xhr.onerror = function () {
        if (settled) return;
        settled = true;
        reject(new Error("Network request failed"));
      };
      xhr.onabort = function () {
        if (settled) return;
        settled = true;
        const error = new Error("Request aborted");
        error.code = "ABORTED";
        reject(error);
      };
      xhr.send();
    });
    return {
      promise,
      cancel() {
        if (!settled && xhr) {
          xhr.abort();
        }
      }
    };
  }
};
