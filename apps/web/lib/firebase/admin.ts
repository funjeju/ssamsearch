import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let app: App | null = null;

function getAdminApp(): App {
  if (app) return app;

  if (getApps().length > 0) {
    app = getApps()[0]!;
    return app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_ADMIN_PROJECT_ID is not set');

  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

  if (useEmulator) {
    app = initializeApp({ projectId });
  } else {
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!clientEmail || !privateKey) throw new Error('Firebase Admin credentials are not set');

    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  return app;
}

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    return getAuth(getAdminApp())[prop as keyof Auth];
  },
});

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    return getFirestore(getAdminApp())[prop as keyof Firestore];
  },
});
