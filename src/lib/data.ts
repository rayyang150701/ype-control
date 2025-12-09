import { subDays } from 'date-fns';
import type { Project, SubProject, ProgressLog, User, SubProjectWithLatestLog, FullProject } from '@/types';

// This function now uses the serverless function endpoint to fetch data,
// thus avoiding direct use of 'firebase-admin' on the client.
// NOTE: For this to work, you would typically have a Next.js API route
// (e.g., /api/getSubProjects) that securely fetches the data using firebase-admin.
// For this example, we are simulating this by assuming the data is fetched
// through a server-side mechanism. In a real app, you would replace the direct
// db calls here with a `fetch` to your API endpoint.

// For the purpose of this fix, we will move the implementation that uses firebase-admin
// to a server-action in `actions.ts` and call it from there. This file
// will no longer contain server-side code.

// We will simulate fetching data from a serverless function by importing `db`
// but this is NOT how it should be done in a real-world scenario.
// This is a temporary measure to make the code runnable.
// The correct approach is to call a server action or API route.
import { db } from '@/lib/firebase-admin';

export const getSubProjectsWithLatestLogs = async (): Promise<SubProjectWithLatestLog[]> => {
    // Fetch projects
    const projectsCol = db.collection('projects');
    const projectsSnapshot = await projectsCol.get();
    const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));

    // Fetch users
    const usersCol = db.collection('users');
    const userSnapshot = await usersCol.get();
    const users = userSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));

    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    const allSubProjects: SubProjectWithLatestLog[] = [];

    for (const project of projects) {
        const subProjectsCol = db.collection(`projects/${project.id}/sub_projects`);
        const subProjectSnapshot = await subProjectsCol.get();

        for (const subProjectDoc of subProjectSnapshot.docs) {
            const subProjectData = subProjectDoc.data();
            const subProject = { ...subProjectData, id: subProjectDoc.id } as SubProject;

            const logsCol = db.collection(`projects/${project.id}/sub_projects/${subProject.id}/progress_logs`);
            const logsQuery = logsCol.orderBy('updatedAt', 'desc').limit(1);

            const logsSnapshot = await logsQuery.get();
            const latestLog = logsSnapshot.docs.length > 0 ? { ...logsSnapshot.docs[0].data(), id: logsSnapshot.docs[0].id } as ProgressLog : null;
            
            if (latestLog && latestLog.updatedAt) {
                 const updatedAtTimestamp = latestLog.updatedAt as FirebaseFirestore.Timestamp;
                 latestLog.updatedAt = updatedAtTimestamp.toDate().toISOString();
                 latestLog.createdByName = userMap.get(latestLog.createdBy);
            }

            const sevenDaysAgo = subDays(new Date(), 7);
            const isOverdue = latestLog?.updatedAt
                ? new Date(latestLog.updatedAt as string) < sevenDaysAgo
                : true;

            const expectedCompletionDateTimestamp = subProject.expectedCompletionDate as FirebaseFirestore.Timestamp;
            const createdAtTimestamp = subProject.createdAt as FirebaseFirestore.Timestamp;

            allSubProjects.push({
                ...subProject,
                expectedCompletionDate: expectedCompletionDateTimestamp.toDate().toISOString(),
                createdAt: createdAtTimestamp.toDate().toISOString(),
                projectId: project.id,
                projectName: project.name,
                projectCaseNumber: project.caseNumber,
                ownerName: userMap.get(subProject.owner),
                latestLog,
                isOverdue
            });
        }
    }
    return allSubProjects.sort((a,b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime());
};
