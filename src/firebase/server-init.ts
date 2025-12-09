'use server';
// IMPORTANT: This file should not have a 'use client' directive
import { initializeApp, getApps, getApp, App as FirebaseAdminApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

// Define the return type for our initialized services
interface FirebaseServerServices {
  firebaseApp: FirebaseAdminApp;
  firestore: Firestore;
  auth: Auth;
}

/**
 * Initializes and returns Firebase Admin services for server-side use.
 * This function ensures that initialization happens only once.
 */
export async function initializeFirebaseOnServer(): Promise<FirebaseServerServices> {
  // Check if the default app is already initialized
  if (getApps().length) {
    const firebaseApp = getApp();
    return {
      firebaseApp,
      firestore: getFirestore(firebaseApp),
      auth: getAuth(firebaseApp),
    };
  }

  // Initialize the Firebase Admin app. In a managed environment like App Hosting,
  // initializeApp() will automatically use the available service account credentials.
  const firebaseApp = initializeApp();

  return {
    firebaseApp,
    firestore: getFirestore(firebaseApp),
    auth: getAuth(firebaseApp),
  };
}
