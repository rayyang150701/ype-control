'use server';

import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import serviceAccount from '../../docs/service-account.json';

if (!getApps().length) {
  try {
    initializeApp({
      // The cert function can take the full service account object directly.
      // This avoids all issues with environment variable parsing and private key formatting.
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error('Firebase admin init error:', error);
    // Re-throw the error to halt execution if initialization fails.
    // This provides a clearer error message in the server logs.
    throw error;
  }
}

export const db = admin.firestore();
export const auth = admin.auth();