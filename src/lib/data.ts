import { subDays } from 'date-fns';
import type { Project, SubProject, ProgressLog, User, SubProjectWithLatestLog } from '@/types';
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
                 latestLog.updatedAt = updatedAtTimestamp.toDate();
                 latestLog.createdByName = userMap.get(latestLog.createdBy);
            }

            const sevenDaysAgo = subDays(new Date(), 7);
            const isOverdue = latestLog?.updatedAt
                ? (latestLog.updatedAt as Date) < sevenDaysAgo
                : true;

            const expectedCompletionDateTimestamp = subProject.expectedCompletionDate as FirebaseFirestore.Timestamp;
            const createdAtTimestamp = subProject.createdAt as FirebaseFirestore.Timestamp;

            allSubProjects.push({
                ...subProject,
                expectedCompletionDate: expectedCompletionDateTimestamp.toDate(),
                createdAt: createdAtTimestamp.toDate(),
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
