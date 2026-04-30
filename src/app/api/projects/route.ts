import { NextResponse } from 'next/server';
import { isFirebaseReady, db } from '@/lib/firebase-admin';

export async function GET() {
  if (!isFirebaseReady) {
    return NextResponse.json({ projects: [] });
  }

  try {
    const projectsSnapshot = await db.collection('projects').orderBy('createdAt', 'desc').get();
    const usersSnapshot = await db.collection('users').get();
    const userMap = new Map<string, string>();
    usersSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      userMap.set(doc.id, data.displayName || '');
    });

    const projects = [];

    for (const projectDoc of projectsSnapshot.docs) {
      const projectData = projectDoc.data();
      const createdAt = projectData.createdAt as FirebaseFirestore.Timestamp;
      const onHoldStartDate = projectData.onHoldStartDate as FirebaseFirestore.Timestamp | undefined;
      const onHoldEndDate = projectData.onHoldEndDate as FirebaseFirestore.Timestamp | undefined;

      const project = {
        id: projectDoc.id,
        ...projectData,
        createdAt: createdAt ? createdAt.toDate().toISOString() : new Date().toISOString(),
        onHoldStartDate: onHoldStartDate ? onHoldStartDate.toDate().toISOString() : undefined,
        onHoldEndDate: onHoldEndDate ? onHoldEndDate.toDate().toISOString() : undefined,
      };

      const subProjectsSnapshot = await projectDoc.ref.collection('sub_projects').orderBy('createdAt', 'asc').get();
      const subProjects = [];

      for (const subDoc of subProjectsSnapshot.docs) {
        const spData = subDoc.data();
        const spCreatedAt = spData.createdAt as FirebaseFirestore.Timestamp;
        const expectedDate = spData.expectedCompletionDate as FirebaseFirestore.Timestamp | undefined;
        const actualDate = spData.actualCompletionDate as FirebaseFirestore.Timestamp | undefined;

        // Get latest log
        const logsSnapshot = await subDoc.ref.collection('progress_logs').orderBy('updatedAt', 'desc').limit(1).get();
        let latestLog = null;
        if (!logsSnapshot.empty) {
          const logData = logsSnapshot.docs[0].data();
          const logUpdatedAt = logData.updatedAt as FirebaseFirestore.Timestamp;
          latestLog = {
            id: logsSnapshot.docs[0].id,
            ...logData,
            updatedAt: logUpdatedAt ? logUpdatedAt.toDate().toISOString() : new Date().toISOString(),
            createdByName: userMap.get(logData.createdBy) || logData.createdBy,
          };
        }

        // Check overdue (7 days without report)
        const subIsOnHold = spData.isOnHold ?? false;
        const parentIsOnHold = projectData.isOnHold ?? false;
        let isOverdue = false;
        if (!subIsOnHold && !parentIsOnHold) {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          isOverdue = latestLog?.updatedAt
            ? new Date(latestLog.updatedAt) < sevenDaysAgo
            : true;
        }

        subProjects.push({
          id: subDoc.id,
          ...spData,
          projectId: projectDoc.id,
          projectName: projectData.name,
          projectCaseNumber: projectData.caseNumber,
          ownerName: userMap.get(spData.owner) || spData.owner,
          createdAt: spCreatedAt ? spCreatedAt.toDate().toISOString() : new Date().toISOString(),
          expectedCompletionDate: expectedDate ? expectedDate.toDate().toISOString() : undefined,
          actualCompletionDate: actualDate ? actualDate.toDate().toISOString() : undefined,
          latestLog,
          isOverdue,
          isOnHold: subIsOnHold,
          isParentOnHold: parentIsOnHold,
        });
      }

      projects.push({ ...project, subProjects });
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ projects: [], error: (error as Error).message });
  }
}
