'use server';

import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import dotenv from 'dotenv';

dotenv.config();

// Check if the service account key is available
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  throw new Error(
    'Firebase service account key is not set in the environment variables. Please set FIREBASE_SERVICE_ACCOUNT_KEY.'
  );
}

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY
);


if (!getApps().length) {
  try {
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
    throw error;
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
