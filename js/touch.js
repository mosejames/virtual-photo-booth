/* ========================================
   Touch / Pointer Event Handler
   Drag and pinch-to-zoom for photo positioning
   ======================================== */

let canvasEl = null;
let state = null;
let onUpdate = null;
let minScale = 1;
let getWindowFn = null;

const pointers = new Map();
let lastPinchDist = 0;

function screenToCanvas(clientX, clientY) {
  const rect = canvasEl.getBoundingClientRect();
  const scaleX = canvasEl.width / rect.width;
  const scaleY = canvasEl.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function clampPosition() {
  if (!state.photo) return;
  const win = getWindowFn(canvasEl);
  const scaledW = state.photo.naturalWidth * state.photoScale;
  const scaledH = state.photo.naturalHeight * state.photoScale;

  state.photoX = Math.min(win.x, Math.max(win.x + win.w - scaledW, state.photoX));
  state.photoY = Math.min(win.y, Math.max(win.y + win.h - scaledH, state.photoY));
}

function onPointerDown(e) {
  if (!state.photo) return;
  canvasEl.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, screenToCanvas(e.clientX, e.clientY));
  lastPinchDist = 0;
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId) || !state.photo) return;

  const prev = pointers.get(e.pointerId);
  const curr = screenToCanvas(e.clientX, e.clientY);

  if (pointers.size === 1) {
    state.photoX += curr.x - prev.x;
    state.photoY += curr.y - prev.y;
    clampPosition();
    onUpdate();
  } else if (pointers.size === 2) {
    pointers.set(e.pointerId, curr);
    const pts = Array.from(pointers.values());
    const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);

    if (lastPinchDist > 0) {
      const scaleDelta = newDist / lastPinchDist;
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      const newScale = Math.max(minScale, Math.min(minScale * 5, state.photoScale * scaleDelta));
      const actualDelta = newScale / state.photoScale;

      state.photoX = midX - (midX - state.photoX) * actualDelta;
      state.photoY = midY - (midY - state.photoY) * actualDelta;
      state.photoScale = newScale;

      clampPosition();
      onUpdate();
    }
    lastPinchDist = newDist;
    return;
  }

  pointers.set(e.pointerId, curr);
}

function onPointerUp(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) {
    lastPinchDist = 0;
  }
}

function onWheel(e) {
  if (!state.photo) return;
  e.preventDefault();

  const pos = screenToCanvas(e.clientX, e.clientY);
  const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
  const newScale = Math.max(minScale, Math.min(minScale * 5, state.photoScale * zoomFactor));
  const actualDelta = newScale / state.photoScale;

  state.photoX = pos.x - (pos.x - state.photoX) * actualDelta;
  state.photoY = pos.y - (pos.y - state.photoY) * actualDelta;
  state.photoScale = newScale;

  clampPosition();
  onUpdate();
}

export function initTouch(el, appState, updateCb, getWin) {
  canvasEl = el;
  state = appState;
  onUpdate = updateCb;
  getWindowFn = getWin;

  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  canvasEl.addEventListener('pointerup', onPointerUp);
  canvasEl.addEventListener('pointercancel', onPointerUp);
  canvasEl.addEventListener('wheel', onWheel, { passive: false });
}

export function setMinScale(scale) {
  minScale = scale;
}

export function destroyTouch() {
  if (!canvasEl) return;
  canvasEl.removeEventListener('pointerdown', onPointerDown);
  canvasEl.removeEventListener('pointermove', onPointerMove);
  canvasEl.removeEventListener('pointerup', onPointerUp);
  canvasEl.removeEventListener('pointercancel', onPointerUp);
  canvasEl.removeEventListener('wheel', onWheel);
  pointers.clear();
}
