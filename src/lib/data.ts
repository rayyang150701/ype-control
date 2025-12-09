import { subDays } from 'date-fns';
import type { Project, SubProject, ProgressLog, User, SubProjectWithLatestLog } from '@/types';
import { initializeFirebaseOnServer } from '@/firebase/server-init';
import type { Timestamp } from 'firebase-admin/firestore';


export const getSubProjectsWithLatestLogs = async (): Promise<SubProjectWithLatestLog[]> => {
    const { firestore } = await initializeFirebaseOnServer();
    
    // Fetch projects
    const projectsCol = firestore.collection('projects');
    const projectsSnapshot = await projectsCol.get();
    const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));

    // Fetch users
    const usersCol = firestore.collection('users');
    const userSnapshot = await usersCol.get();
    const users = userSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));

    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    const allSubProjects: SubProjectWithLatestLog[] = [];

    for (const project of projects) {
        const subProjectsCol = firestore.collection(`projects/${project.id}/sub_projects`);
        const subProjectSnapshot = await subProjectsCol.get();

        for (const subProjectDoc of subProjectSnapshot.docs) {
            const subProject = { ...subProjectDoc.data(), id: subProjectDoc.id } as SubProject;

            const logsQuery = firestore
                .collection(`projects/${project.id}/sub_projects/${subProject.id}/progress_logs`)
                .orderBy('updatedAt', 'desc')
                .limit(1);

            const logsSnapshot = await logsQuery.get();
            const latestLog = logsSnapshot.docs.length > 0 ? { ...logsSnapshot.docs[0].data(), id: logsSnapshot.docs[0].id } as ProgressLog : null;
            
            if (latestLog && latestLog.updatedAt) {
                 latestLog.updatedAt = (latestLog.updatedAt as Timestamp).toDate();
                 latestLog.createdByName = userMap.get(latestLog.createdBy);
            }

            const sevenDaysAgo = subDays(new Date(), 7);
            const isOverdue = latestLog?.updatedAt
                ? (latestLog.updatedAt as Date) < sevenDaysAgo
                : true;

            allSubProjects.push({
                ...subProject,
                expectedCompletionDate: (subProject.expectedCompletionDate as Timestamp).toDate(),
                createdAt: (subProject.createdAt as Timestamp).toDate(),
                projectName: project.name,
                projectCaseNumber: project.caseNumber,
                ownerName: userMap.get(subProject.owner),
                latestLog,
                isOverdue
            });
        }
    }
    return allSubProjects.sort((a,b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
};
