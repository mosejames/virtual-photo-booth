/* ========================================
   Gallery Page Controller
   Real-time photo grid from Firestore
   ======================================== */

import { onGalleryUpdate, isConfigured } from './firebase.js';

const grid = document.getElementById('gallery-grid');
const emptyState = document.getElementById('gallery-empty');
const photoCount = document.getElementById('photo-count');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxName = document.getElementById('lightbox-name');
const lightboxTitle = document.getElementById('lightbox-title');
const lightboxClose = document.getElementById('lightbox-close');

// ---- Lightbox ----
function openLightbox(photo) {
  lightboxImg.src = photo.imageUrl;
  lightboxName.textContent = photo.name || '';
  lightboxTitle.textContent = photo.title || '';
  lightbox.hidden = false;
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.src = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

// ---- Render Gallery ----
function renderGallery(photos) {
  if (photos.length === 0) {
    emptyState.classList.remove('hidden');
    grid.innerHTML = '';
    photoCount.textContent = '';
    return;
  }

  emptyState.classList.add('hidden');
  photoCount.textContent = `${photos.length} photo${photos.length !== 1 ? 's' : ''}`;

  grid.innerHTML = photos.map((photo) => `
    <div class="gallery-card" data-id="${photo.id}">
      <img src="${photo.imageUrl}" alt="${photo.name || 'Photo'}" loading="lazy">
      ${photo.name ? `
        <div class="gallery-card-meta">
          <p class="gallery-card-name">${photo.name}</p>
          ${photo.title ? `<p class="gallery-card-title">${photo.title}</p>` : ''}
        </div>
      ` : ''}
    </div>
  `).join('');

  // Attach click handlers for lightbox
  grid.querySelectorAll('.gallery-card').forEach((card) => {
    card.addEventListener('click', () => {
      const photo = photos.find((p) => p.id === card.dataset.id);
      if (photo) openLightbox(photo);
    });
  });
}

// ---- Init ----
if (isConfigured()) {
  onGalleryUpdate(renderGallery);
} else {
  emptyState.innerHTML = `
    <p>Firebase is not configured yet.</p>
    <p style="font-size: 13px; color: #555; max-width: 400px; line-height: 1.6;">
      Open <code>js/firebase.js</code> and replace the placeholder config with your Firebase project credentials.
    </p>
  `;
}
