import { subDays } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import type { Project, SubProject, ProgressLog, User, SubProjectWithLatestLog } from '@/types';
import { initializeFirebaseOnServer } from '@/firebase/server-init';
import { getDocs, collection, query, orderBy, limit } from 'firebase/firestore';

export const getProjects = async (): Promise<Project[]> => {
  const { firestore } = await initializeFirebaseOnServer();
  const projectsCol = collection(firestore, 'projects');
  const projectSnapshot = await getDocs(projectsCol);
  const projectList = projectSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
  return projectList;
};

export const getSubProjectsWithLatestLogs = async (): Promise<SubProjectWithLatestLog[]> => {
    const { firestore } = await initializeFirebaseOnServer();
    const projectsCol = collection(firestore, 'projects');
    const projectsSnapshot = await getDocs(projectsCol);
    const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));

    const usersCol = collection(firestore, 'users');
    const userSnapshot = await getDocs(usersCol);
    const users = userSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));

    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    const allSubProjects: SubProjectWithLatestLog[] = [];

    for (const project of projects) {
        const subProjectsCol = collection(firestore, `projects/${project.id}/sub_projects`);
        const subProjectSnapshot = await getDocs(subProjectsCol);

        for (const subProjectDoc of subProjectSnapshot.docs) {
            const subProject = { ...subProjectDoc.data(), id: subProjectDoc.id } as SubProject;

            const logsQuery = query(
                collection(firestore, `projects/${project.id}/sub_projects/${subProject.id}/progress_logs`),
                orderBy('updatedAt', 'desc'),
                limit(1)
            );
            const logsSnapshot = await getDocs(logsQuery);
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
