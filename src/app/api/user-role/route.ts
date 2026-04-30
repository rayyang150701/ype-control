import { NextResponse } from 'next/server';
import { isFirebaseReady, db } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');

  if (!uid) {
    return NextResponse.json({ role: 'viewer' });
  }

  if (!isFirebaseReady) {
    // Demo mode: return admin role
    return NextResponse.json({ role: 'admin', displayName: 'Admin (Demo)' });
  }

  try {
    const userDoc = await db.collection('users').where('email', '==', uid).limit(1).get();
    if (!userDoc.empty) {
      const userData = userDoc.docs[0].data();
      return NextResponse.json({
        role: userData.role || 'viewer',
        displayName: userData.displayName || '',
      });
    }

    // Try by UID
    const userByUid = await db.collection('users').doc(uid).get();
    if (userByUid.exists) {
      const userData = userByUid.data()!;
      return NextResponse.json({
        role: userData.role || 'viewer',
        displayName: userData.displayName || '',
      });
    }

    return NextResponse.json({ role: 'viewer' });
  } catch (error) {
    console.error('Error fetching user role:', error);
    return NextResponse.json({ role: 'viewer' });
  }
}
