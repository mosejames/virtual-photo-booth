/* ========================================
   Canvas Rendering Engine
   Per-format frame overlays, photo compositing,
   nameplate text rendering, export
   ======================================== */

const COLORS = {
  bg: '#1a1a1a',
  bgDark: '#111111',
};

// Per-format frame images
const FRAME_PATHS = {
  portrait: 'assets/frames/frame_portrait.png',
  square:   'assets/frames/frame_square.png',
  story:    'assets/frames/frame_story.png',
};

// Nameplate box and text positioning per format (pixel coords on 1080-wide canvas)
const NAMEPLATE = {
  square: {
    box: { x: 140, y: 700, w: 800, h: 110 },
    border: 4,
    centerX: 540, nameY: 736, titleY: 774,
  },
  portrait: {
    box: { x: 140, y: 968, w: 800, h: 110 },
    border: 4,
    centerX: 540, nameY: 1006, titleY: 1044,
  },
  story: {
    box: { x: 120, y: 1466, w: 840, h: 110 },
    border: 4,
    centerX: 540, nameY: 1501, titleY: 1539,
  },
};

// Stores { img, overlay (canvas with transparency), window } per format
const frames = {};

/**
 * Check if a pixel at (x, y) is white/near-white
 */
function isWhitePixel(data, x, y, width) {
  const i = (y * width + x) * 4;
  return data[i] >= 240 && data[i + 1] >= 240 && data[i + 2] >= 240;
}

/**
 * Process a loaded frame image:
 * 1. Detect the photo window (transparent area for RGBA, white area for RGB)
 * 2. For images without alpha, convert the white photo window to transparent
 */
function processFrame(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const offCtx = offscreen.getContext('2d');
  offCtx.drawImage(img, 0, 0);

  const imageData = offCtx.getImageData(0, 0, w, h);
  const data = imageData.data;

  let hasTransparency = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 10) { hasTransparency = true; break; }
  }

  let winRect;

  if (hasTransparency) {
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] < 10) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    winRect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  } else {
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);

    let left = cx;
    while (left > 0 && isWhitePixel(data, left - 1, cy, w)) left--;
    let right = cx;
    while (right < w - 1 && isWhitePixel(data, right + 1, cy, w)) right++;
    let top = cy;
    while (top > 0 && isWhitePixel(data, cx, top - 1, w)) top--;
    let bottom = cy;
    while (bottom < h - 1 && isWhitePixel(data, cx, bottom + 1, w)) bottom++;

    winRect = { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };

    for (let y = winRect.y; y < winRect.y + winRect.h; y++) {
      for (let x = winRect.x; x < winRect.x + winRect.w; x++) {
        const i = (y * w + x) * 4;
        if (data[i] >= 240 && data[i + 1] >= 240 && data[i + 2] >= 240) {
          data[i + 3] = 0;
        }
      }
    }

    offCtx.putImageData(imageData, 0, 0);
  }

  return { overlay: offscreen, window: winRect };
}

// Preload and process all frame images
for (const [format, path] of Object.entries(FRAME_PATHS)) {
  const img = new Image();
  img.src = path;
  img.addEventListener('load', () => {
    const result = processFrame(img);
    frames[format] = {
      img,
      overlay: result.overlay,
      window: result.window,
    };
    if (format === currentFormat && onFrameReady) {
      onFrameReady();
    }
  });
}

let canvas = null;
let ctx = null;
let currentFormat = null;
let onFrameReady = null;

/**
 * Get the photo window rect for the current format.
 */
export function getWindow(canvasEl) {
  const frame = frames[currentFormat];
  if (frame) {
    const scaleX = canvasEl.width / frame.img.naturalWidth;
    const scaleY = canvasEl.height / frame.img.naturalHeight;
    return {
      x: Math.round(frame.window.x * scaleX),
      y: Math.round(frame.window.y * scaleY),
      w: Math.round(frame.window.w * scaleX),
      h: Math.round(frame.window.h * scaleY),
    };
  }

  return {
    x: 40,
    y: 40,
    w: canvasEl.width - 80,
    h: canvasEl.height - 80,
  };
}

/**
 * Initialize the canvas to the given format dimensions
 */
export function initCanvas(canvasEl, format, formatName, renderCallback) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  canvas.width = format.width;
  canvas.height = format.height;
  currentFormat = formatName;
  onFrameReady = renderCallback || null;
}

/**
 * Full redraw: background, user photo, frame overlay, nameplate text
 */
export function renderFrame(state, options) {
  if (!canvas || !ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const win = getWindow(canvas);
  const isExport = options && options.isExport;

  // Layer 1: Dark background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  // Layer 2: User photo (clipped to window)
  if (state.photo) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(win.x, win.y, win.w, win.h);
    ctx.clip();

    const scaledW = state.photo.naturalWidth * state.photoScale;
    const scaledH = state.photo.naturalHeight * state.photoScale;
    ctx.drawImage(state.photo, state.photoX, state.photoY, scaledW, scaledH);

    ctx.restore();
  } else {
    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(win.x, win.y, win.w, win.h);
  }

  // Layer 3: Frame overlay
  const frame = frames[currentFormat];
  if (frame) {
    ctx.drawImage(frame.overlay, 0, 0, w, h);
  }

  // Layer 4: Nameplate box
  const plate = NAMEPLATE[currentFormat];
  if (plate) {
    const box = plate.box;
    const b = plate.border;

    // White border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(box.x, box.y, box.w, box.h);

    // Dark interior
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(box.x + b, box.y + b, box.w - b * 2, box.h - b * 2);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const boxCenterY = box.y + box.h / 2;
    const nameY = state.userTitle ? plate.nameY : boxCenterY;

    if (state.userName) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(state.userName, plate.centerX, nameY);
    } else if (!isExport) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
      ctx.fillText('Your Name Here', plate.centerX, boxCenterY);
    }

    if (state.userTitle) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = '24px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(state.userTitle, plate.centerX, plate.titleY);
    }
  }
}

/**
 * Export canvas as a JPEG blob, trigger download, and return the blob
 */
export function exportImage(canvasEl, formatName, state) {
  renderFrame(state, { isExport: true });

  return new Promise((resolve) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const filename = `photo-booth-${formatName}.jpg`;

    canvasEl.toBlob((blob) => {
      const url = URL.createObjectURL(blob);

      if (isIOS) {
        window.open(url, '_blank');
        resolve({ ios: true, blob });
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        resolve({ ios: false, blob });
      }
    }, 'image/jpeg', 0.92);
  });
}
