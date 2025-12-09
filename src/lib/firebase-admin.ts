'use server';

import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import serviceAccount from '../../docs/service-account.json';

if (!getApps().length) {
  try {
    const privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
    
    initializeApp({
      // The cert function can take the full service account object directly,
      // but we must manually handle the private key's newline characters.
      credential: cert({
        ...serviceAccount,
        private_key: privateKey,
      }),
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
