import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let firebaseInitialized = false;

if (!admin.apps.length) {
  try {
    // Method 1: Environment variable (Vercel / production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized from environment variable');
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
        // Method 3: Default credentials (e.g., running inside GCP)
        admin.initializeApp();
        firebaseInitialized = true;
        console.log('✅ Firebase Admin initialized with default credentials');
      }
    }
  } catch (error) {
    console.error('⚠️ Firebase admin initialization failed:', (error as Error).message);
    console.error('   The app will run in demo mode with mock data.');
    firebaseInitialized = false;
  }
}

export const isFirebaseReady = firebaseInitialized || admin.apps.length > 0;

// Only export db/auth if Firebase is actually initialized
export const db = isFirebaseReady ? admin.firestore() : (null as any);
export const auth = isFirebaseReady ? admin.auth() : (null as any);
