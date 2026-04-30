import { NextResponse } from 'next/server';
import { isFirebaseReady, db } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const subProjectId = searchParams.get('subProjectId');

  if (!projectId || !subProjectId) {
    return NextResponse.json({ logs: [] });
  }

  if (!isFirebaseReady) {
    return NextResponse.json({ logs: [] });
  }

  try {
    const logsCol = db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`);
    const snapshot = await logsCol.orderBy('updatedAt', 'desc').get();

    // Get users for name mapping
    const usersSnapshot = await db.collection('users').get();
    const userMap = new Map<string, string>();
    usersSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      userMap.set(doc.id, data.displayName || '');
    });

    const logs = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      const updatedAt = data.updatedAt as FirebaseFirestore.Timestamp;
      return {
        id: doc.id,
        ...data,
        updatedAt: updatedAt ? updatedAt.toDate().toISOString() : new Date().toISOString(),
        createdByName: userMap.get(data.createdBy) || data.createdBy,
      };
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching progress logs:', error);
    return NextResponse.json({ logs: [] });
  }
}
