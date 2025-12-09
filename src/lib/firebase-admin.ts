'use server';

import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';

if (!getApps().length) {
  try {
    // 方法 1: 使用完整的 JSON (如果你用方法1設定環境變數)
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
    } 
    // 方法 2: 使用分開的環境變數 (如果你用方法2設定環境變數)
    else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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

export const db = admin.firestore();
export const auth = admin.auth();
