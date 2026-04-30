import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let firebaseInitialized = false;
let firebaseInitError = '';

if (!admin.apps.length) {
  try {
    // Method 1: Individual env vars (most reliable for Vercel)
    // Supports Base64-encoded private key (FIREBASE_SA_PRIVATE_KEY_B64) or raw with \n (FIREBASE_SA_PRIVATE_KEY)
    const rawPrivateKey = process.env.FIREBASE_SA_PRIVATE_KEY_B64
      ? Buffer.from(process.env.FIREBASE_SA_PRIVATE_KEY_B64.trim(), 'base64').toString('utf8')
      : process.env.FIREBASE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (rawPrivateKey && process.env.FIREBASE_SA_CLIENT_EMAIL && process.env.FIREBASE_SA_PROJECT_ID) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_SA_PROJECT_ID,
          clientEmail: process.env.FIREBASE_SA_CLIENT_EMAIL,
          privateKey: rawPrivateKey,
        } as admin.ServiceAccount),
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized from individual env vars');
      console.log('   Project ID:', process.env.FIREBASE_SA_PROJECT_ID);
    }
    // Method 2: Full JSON env var (fallback)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      let raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();

      // Try Base64 decode first
      let serviceAccount: any;
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
      } catch (_) {
        serviceAccount = JSON.parse(raw);
      }

      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized from JSON env var');
    }
    // Method 3: Local JSON key file (development)
    else {
      const keyFileName = 'service-account-key.json';
      const keyFilePath = path.join(process.cwd(), keyFileName);
      if (fs.existsSync(keyFilePath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        firebaseInitialized = true;
        console.log('✅ Firebase Admin initialized from', keyFileName);
      } else {
        firebaseInitError = 'No Firebase credentials found in env or file system';
        console.error('⚠️', firebaseInitError);
      }
    }
  } catch (error) {
    firebaseInitError = (error as Error).message;
    console.error('⚠️ Firebase admin initialization failed:', firebaseInitError);
    firebaseInitialized = false;
  }
}

export const isFirebaseReady = firebaseInitialized || admin.apps.length > 0;
export const initError = firebaseInitError;

export const db = isFirebaseReady ? admin.firestore() : (null as any);
export const auth = isFirebaseReady ? admin.auth() : (null as any);
