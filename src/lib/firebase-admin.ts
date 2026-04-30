import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let firebaseInitialized = false;
let firebaseInitError = '';

if (!admin.apps.length) {
  try {
    // Method 1: Environment variable (Vercel / production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      let raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      
      let serviceAccount: any;
      try {
        serviceAccount = JSON.parse(raw);
      } catch (parseErr) {
        // If JSON.parse fails, the value might have been double-escaped or corrupted
        // Try removing surrounding quotes if present
        if (raw.startsWith('"') && raw.endsWith('"')) {
          raw = raw.slice(1, -1);
        }
        // Try unescaping
        raw = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        serviceAccount = JSON.parse(raw);
      }

      // Fix private_key newlines — Vercel may store literal "\\n" instead of actual newlines
      if (serviceAccount.private_key) {
        // Replace literal \\n with actual newline characters
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized from environment variable');
      console.log('   Project ID:', serviceAccount.project_id);
    }
    // Method 2: Local JSON key file (development)
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
        firebaseInitError = 'No FIREBASE_SERVICE_ACCOUNT_KEY env var and no service-account-key.json found';
        console.error('⚠️', firebaseInitError);
      }
    }
  } catch (error) {
    firebaseInitError = (error as Error).message;
    console.error('⚠️ Firebase admin initialization failed:', firebaseInitError);
    console.error('   Stack:', (error as Error).stack);
    firebaseInitialized = false;
  }
}

export const isFirebaseReady = firebaseInitialized || admin.apps.length > 0;
export const initError = firebaseInitError;

// Only export db/auth if Firebase is actually initialized
export const db = isFirebaseReady ? admin.firestore() : (null as any);
export const auth = isFirebaseReady ? admin.auth() : (null as any);
