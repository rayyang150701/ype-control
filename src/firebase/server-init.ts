'use server';
// IMPORTANT: This file should not have a 'use client' directive
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

// Define the return type for our initialized services
interface FirebaseServerServices {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

/**
 * Initializes and returns Firebase services for server-side use using the client SDK.
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

  // Initialize the Firebase app using the client-side config.
  // This is safe because this function only runs on the server.
  const firebaseApp = initializeApp(firebaseConfig);

  return {
    firebaseApp,
    firestore: getFirestore(firebaseApp),
    auth: getAuth(firebaseApp),
  };
}
