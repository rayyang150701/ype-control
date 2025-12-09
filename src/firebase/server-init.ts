// IMPORTANT: This file should not have a 'use client' directive
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/admin/app';
import { getFirestore, Firestore } from 'firebase/admin/firestore';
import { getAuth, Auth } from 'firebase/admin/auth';
import { firebaseConfig } from './config';

// Define the return type for our initialized services
interface FirebaseServerServices {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

/**
 * Initializes and returns Firebase Admin services for server-side use.
 * This function ensures that initialization happens only once.
 */
export async function initializeFirebaseOnServer(): Promise<FirebaseServerServices> {
  // Check if the default app is already initialized
  if (getApps().find(app => app.name === '[DEFAULT]')) {
    const firebaseApp = getApp();
    return {
      firebaseApp,
      firestore: getFirestore(firebaseApp),
      auth: getAuth(firebaseApp),
    };
  }

  // Initialize the Firebase Admin app
  const firebaseApp = initializeApp({
    // In a real server environment, you would use service account credentials
    // For this context, we will re-use the client-side config, but this is not standard practice for Admin SDK
    credential: undefined, // Let App Hosting or environment variables provide credentials
    projectId: firebaseConfig.projectId,
  });

  return {
    firebaseApp,
    firestore: getFirestore(firebaseApp),
    auth: getAuth(firebaseApp),
  };
}
