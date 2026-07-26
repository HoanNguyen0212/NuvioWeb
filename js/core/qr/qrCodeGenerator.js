// js/core/qr/qrCodeGenerator.js

const QR_LIBRARY_PATH = "assets/libs/qrcode-generator.js";
let qrLibraryPromise = null;

function getQrFactory() {
  return typeof globalThis.qrcode === "function" ? globalThis.qrcode : null;
}

function loadQrLibrary() {
  if (getQrFactory()) {
    return Promise.resolve(true);
  }
  if (qrLibraryPromise) {
    return qrLibraryPromise;
  }

  qrLibraryPromise = new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${QR_LIBRARY_PATH}"]`);
    const script = existing || document.createElement("script");
    let settled = false;
    let timeoutId = null;

    const finish = (loaded) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      resolve(Boolean(loaded && getQrFactory()));
    };
    const onLoad = () => finish(true);
    const onError = () => finish(false);

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    timeoutId = setTimeout(() => finish(false), 2000);
    if (!existing) {
      script.src = QR_LIBRARY_PATH;
      script.async = true;
      document.body.appendChild(script);
    }
  });

  return qrLibraryPromise;
}

export const QrCodeGenerator = {
  ensureLoaded() {
    return loadQrLibrary();
  },

  generate(canvas, content, size = 512) {
    const factory = getQrFactory();
    if (factory) {
      this.draw(canvas, content, size, factory);
      return Promise.resolve(true);
    }
    return loadQrLibrary().then((loaded) => {
      const loadedFactory = getQrFactory();
      if (!loaded || !loadedFactory) {
        console.warn("QR generator library could not be loaded");
        return false;
      }
      this.draw(canvas, content, size, loadedFactory);
      return true;
    });
  },

  draw(canvas, content, size, factory) {
    if (!canvas || typeof canvas.getContext !== "function") {
      return;
    }
    const qr = factory(0, "M");
    qr.addData(content);
    qr.make();

    const ctx = canvas.getContext("2d");
    canvas.width = size;
    canvas.height = size;
    const cornerRadius = size * 0.06;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#ffffff";
    this.roundRect(ctx, 0, 0, size, size, cornerRadius);
    ctx.fill();

    const moduleCount = qr.getModuleCount();
    const quietZoneModules = 4;
    const totalModules = moduleCount + quietZoneModules * 2;
    const moduleSize = size / totalModules;
    const moduleRadius = moduleSize * 0.08;

    ctx.fillStyle = "#000000";
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        if (qr.isDark(row, col)) {
          const x = (col + quietZoneModules) * moduleSize;
          const y = (row + quietZoneModules) * moduleSize;
          this.roundRect(ctx, x, y, moduleSize, moduleSize, moduleRadius);
          ctx.fill();
        }
      }
    }

    const imageData = ctx.getImageData(0, 0, size, size);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    this.roundRect(ctx, 0, 0, size, size, cornerRadius);
    ctx.clip();
    ctx.putImageData(imageData, 0, 0);
    ctx.restore();
  },

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
};
