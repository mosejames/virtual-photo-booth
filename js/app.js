/* ========================================
   App Controller
   State management, screen transitions,
   file upload, and module wiring
   ======================================== */

import { initCanvas, renderFrame, exportImage, getWindow } from './canvas.js';
import { initTouch, setMinScale, destroyTouch } from './touch.js';
import { uploadPhoto, isConfigured } from './firebase.js';

// ---- Format Definitions ----
const FORMATS = {
  square:   { width: 1080, height: 1080, label: 'Square (1:1)' },
  portrait: { width: 1080, height: 1350, label: 'Portrait (4:5)' },
  story:    { width: 1080, height: 1920, label: 'Story (9:16)' },
};

// ---- App State ----
const state = {
  screen: 'select',
  format: null,
  formatName: null,
  photo: null,
  photoX: 0,
  photoY: 0,
  photoScale: 1,
  userName: '',
  userTitle: '',
};

// ---- DOM Elements ----
const app = document.getElementById('app');
const canvasEl = document.getElementById('preview-canvas');
const photoInput = document.getElementById('photo-input');
const uploadOverlay = document.getElementById('upload-overlay');
const btnDownload = document.getElementById('btn-download');
const btnUpload = document.getElementById('btn-upload');
const btnBack = document.getElementById('btn-back');
const btnAnother = document.getElementById('btn-another');
const editHint = document.getElementById('edit-hint');
const iosHint = document.getElementById('ios-hint');
const inputName = document.getElementById('input-name');
const inputTitle = document.getElementById('input-title');

// ---- Screen Navigation ----
function goToScreen(name) {
  state.screen = name;
  app.setAttribute('data-screen', name);
}

// ---- Photo Loading ----
function loadPhoto(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const img = new Image();
  const objectUrl = URL.createObjectURL(file);

  img.onload = () => {
    state.photo = img;

    const win = getWindow(canvasEl);
    const coverScale = Math.max(win.w / img.naturalWidth, win.h / img.naturalHeight);
    state.photoScale = coverScale;
    setMinScale(coverScale);

    const scaledW = img.naturalWidth * coverScale;
    const scaledH = img.naturalHeight * coverScale;
    state.photoX = win.x + (win.w - scaledW) / 2;
    state.photoY = win.y + (win.h - scaledH) / 2;

    uploadOverlay.classList.add('hidden');
    editHint.classList.add('visible');
    btnDownload.disabled = false;

    renderFrame(state);
  };

  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
  };

  img.src = objectUrl;
}

// ---- Reset State ----
function resetPhotoState() {
  if (state.photo && state.photo.src) {
    URL.revokeObjectURL(state.photo.src);
  }
  state.photo = null;
  state.photoX = 0;
  state.photoY = 0;
  state.photoScale = 1;
  btnDownload.disabled = true;
  editHint.classList.remove('visible');
  uploadOverlay.classList.remove('hidden');
  photoInput.value = '';
}

function resetAll() {
  resetPhotoState();
  state.format = null;
  state.formatName = null;
  state.userName = '';
  state.userTitle = '';
  inputName.value = '';
  inputTitle.value = '';
}

// ---- Event Handlers ----

// Format selection buttons
document.querySelectorAll('.format-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const formatName = btn.dataset.format;
    const format = FORMATS[formatName];
    if (!format) return;

    state.format = format;
    state.formatName = formatName;

    initCanvas(canvasEl, format, formatName, () => renderFrame(state));
    renderFrame(state);
    initTouch(canvasEl, state, () => renderFrame(state), getWindow);

    goToScreen('edit');
  });
});

// Photo input
photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) loadPhoto(file);
});

// Upload overlay click
uploadOverlay.addEventListener('click', () => {
  photoInput.click();
});

// Change photo button
btnUpload.addEventListener('click', () => {
  photoInput.click();
});

// Name and title inputs
inputName.addEventListener('input', () => {
  state.userName = inputName.value.trim();
  renderFrame(state);
});

inputTitle.addEventListener('input', () => {
  state.userTitle = inputTitle.value.trim();
  renderFrame(state);
});

// Download button
btnDownload.addEventListener('click', async () => {
  if (!state.photo) return;
  btnDownload.disabled = true;
  btnDownload.textContent = 'Saving...';

  try {
    const result = await exportImage(canvasEl, state.formatName, state);
    renderFrame(state);
    btnDownload.textContent = 'Download Photo';
    btnDownload.disabled = false;

    // Upload to Firebase in the background (non-blocking)
    if (isConfigured() && result.blob) {
      uploadPhoto(result.blob, {
        name: state.userName,
        title: state.userTitle,
        format: state.formatName,
      });
    }

    goToScreen('done');
  } catch {
    btnDownload.textContent = 'Download Photo';
    btnDownload.disabled = false;
  }
});

// Back button
btnBack.addEventListener('click', () => {
  destroyTouch();
  resetAll();
  goToScreen('select');
});

// Take Another button
btnAnother.addEventListener('click', () => {
  iosHint.hidden = true;
  destroyTouch();
  resetAll();
  goToScreen('select');
});

// Prevent default drag behavior
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());
