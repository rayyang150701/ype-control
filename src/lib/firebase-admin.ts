import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let firebaseInitialized = false;
let firebaseInitError = '';

function parseServiceAccountKey(raw: string): any {
  // Try 1: Direct JSON parse
  try {
    const parsed = JSON.parse(raw);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (_) {
    // Not valid JSON, try Base64
  }

  // Try 2: Base64 decode then JSON parse
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (_) {
    // Not valid Base64 JSON either
  }

  throw new Error('Unable to parse service account key as JSON or Base64');
}

if (!admin.apps.length) {
  try {
    const envKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
      || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (envKey) {
      const serviceAccount = parseServiceAccountKey(envKey.trim());
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized from env var');
      console.log('   Project ID:', serviceAccount.project_id);
      console.log('   Client Email:', serviceAccount.client_email);
    } else {
      // Local file fallback (development)
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
