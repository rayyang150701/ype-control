'use server';

import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import serviceAccount from '../../docs/service-account.json';

if (!getApps().length) {
  try {
    // Ensure the service account has the correct properties.
    if (
      !serviceAccount.project_id ||
      !serviceAccount.client_email ||
      !serviceAccount.private_key
    ) {
      throw new Error(
        'The service account JSON file is missing required properties (project_id, client_email, private_key).'
      );
    }
    
    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        // The key is to replace the literal `\n` strings with actual newline characters.
        privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
      }),
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
