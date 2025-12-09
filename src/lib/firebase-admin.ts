'use server';

import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import serviceAccount from '../../docs/service-account.json';

if (!getApps().length) {
  try {
    // The most robust way is to pass the entire service account object
    // directly to cert(), letting the SDK handle the parsing.
    initializeApp({
      credential: cert(serviceAccount),
    });

  } catch (error) {
    console.error('Firebase Admin initialization error', error);
    // Re-throw the error to halt execution if initialization fails.
    // This prevents the "default app does not exist" error downstream.
    throw error;
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
