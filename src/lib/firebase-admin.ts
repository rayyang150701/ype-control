import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let firebaseInitialized = false;

if (!admin.apps.length) {
  try {
    // Method 1: Try loading from a JSON key file
    const keyFilePath = path.join(process.cwd(), 'studio-751317964-5794f-firebase-adminsdk-fbsvc-9301837026.json');
    if (fs.existsSync(keyFilePath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized from service-account-key.json');
    }
    // Method 2: Fallback to environment variable
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      let keyString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      keyString = keyString.replace(/\\"/g, '"');
      keyString = keyString.replace(/\n/g, '\\n');
      const serviceAccount = JSON.parse(keyString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized from environment variable');
    }
    // Method 3: Default credentials (e.g., running inside GCP)
    else {
      admin.initializeApp();
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized with default credentials');
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
