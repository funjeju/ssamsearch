import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin() {
  if (getApps().length > 0) return;

  const privateKey = process.env['FIREBASE_ADMIN_PRIVATE_KEY']?.replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({
      projectId: process.env['FIREBASE_ADMIN_PROJECT_ID']!,
      clientEmail: process.env['FIREBASE_ADMIN_CLIENT_EMAIL']!,
      privateKey: privateKey!,
    }),
  });
}

initAdmin();

export const adminDb = getFirestore();
