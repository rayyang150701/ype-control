import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { Auth, getAuth } from 'firebase-admin/auth';
import serviceAccount from '../../docs/service-account.json';

let db: Firestore;
let auth: Auth;

if (getApps().length === 0) {
  try {
    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin init error:', error);
    throw error; // Re-throw the error to halt execution if initialization fails
  }
}

db = getFirestore();
auth = getAuth();

export { db, auth };
