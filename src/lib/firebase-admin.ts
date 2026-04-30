import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let firebaseInitialized = false;
let firebaseInitError = '';

if (!admin.apps.length) {
  try {
    // Method 1: Base64-encoded service account (recommended for Vercel)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64) {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decoded);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized from Base64 env var');
      console.log('   Project ID:', serviceAccount.project_id);
    }
    // Method 2: Raw JSON environment variable
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
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
        firebaseInitError = 'No Firebase credentials found';
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
