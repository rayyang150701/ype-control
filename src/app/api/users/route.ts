import { NextResponse } from 'next/server';
import { isFirebaseReady, db } from '@/lib/firebase-admin';

export async function GET() {
  if (!isFirebaseReady) {
    return NextResponse.json({ users: [] });
  }

  try {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      const createdAt = data.createdAt as FirebaseFirestore.Timestamp;
      return {
        uid: doc.id,
        displayName: data.displayName || '',
        email: data.email || '',
        role: data.role || 'viewer',
        status: data.status || 'pending',
        createdAt: createdAt ? createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    });
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ users: [] });
  }
}
