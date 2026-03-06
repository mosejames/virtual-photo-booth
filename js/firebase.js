/* ========================================
   Firebase Integration
   Storage uploads + Firestore gallery data
   ======================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

// ============================================================
// CONFIGURE: Replace with your Firebase project config
// https://console.firebase.google.com → Project Settings → Your apps
// ============================================================
const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};

// ============================================================
// CONFIGURE: Change this per event to keep photos separated
// ============================================================
const EVENT_ID = 'default-event';

// ---- Init ----
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);

const photosCollection = collection(db, 'events', EVENT_ID, 'photos');

/**
 * Upload a photo blob to Firebase Storage and save metadata to Firestore.
 * Runs in the background — does not block the UI.
 * @param {Blob} blob - JPEG blob from canvas export
 * @param {object} meta - { name, title, format }
 */
export async function uploadPhoto(blob, meta) {
  try {
    const timestamp = Date.now();
    const filename = `${timestamp}_${meta.format}.jpg`;
    const storageRef = ref(storage, `events/${EVENT_ID}/${filename}`);

    const snapshot = await uploadBytes(storageRef, blob, {
      contentType: 'image/jpeg',
    });

    const imageUrl = await getDownloadURL(snapshot.ref);

    await addDoc(photosCollection, {
      imageUrl,
      name: meta.name || '',
      title: meta.title || '',
      format: meta.format,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Firebase upload failed:', err);
  }
}

/**
 * Subscribe to real-time gallery updates.
 * Calls the callback with an array of photo docs whenever data changes.
 * @param {function} callback - Called with [{ id, imageUrl, name, title, format, createdAt }]
 * @returns {function} Unsubscribe function
 */
export function onGalleryUpdate(callback) {
  const q = query(photosCollection, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const photos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(photos);
  });
}

/**
 * Check if Firebase is configured (not using placeholder values)
 */
export function isConfigured() {
  return firebaseConfig.apiKey !== 'YOUR_API_KEY';
}
