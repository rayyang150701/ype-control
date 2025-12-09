'use server';

import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import dotenv from 'dotenv';

dotenv.config();

if (!getApps().length) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
        throw new Error('Firebase Admin SDK service account credentials are not defined in environment variables.');
    }

    initializeApp({
      credential: cert(serviceAccount as any),
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
