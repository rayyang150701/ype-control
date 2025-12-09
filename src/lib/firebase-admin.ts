import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { Auth, getAuth } from 'firebase-admin/auth';

let db: Firestore;
let auth: Auth;

if (!getApps().length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      );

      initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      throw new Error(
        'Firebase service account key is not set in the environment variables. Please set FIREBASE_SERVICE_ACCOUNT_KEY.'
      );
    }
  } catch (error) {
    console.error('Firebase admin init error:', error);
    throw error;
  }
}

db = getFirestore();
auth = getAuth();

export { db, auth };
