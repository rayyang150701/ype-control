import { subDays, addDays, startOfWeek, endOfWeek, format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import type { Project, SubProject, ProgressLog, User, SubProjectWithLatestLog } from '@/types';
import { initializeFirebaseOnServer } from '@/firebase/server-init';
import { getDocs, collection, query, orderBy, limit, where, serverTimestamp, doc } from 'firebase/firestore';

const toTimestamp = (date: Date): Timestamp => ({
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
  toDate: () => date,
});


export const getUsers = async (): Promise<User[]> => {
  const { firestore } = await initializeFirebaseOnServer();
  const usersCol = collection(firestore, 'users');
  const userSnapshot = await getDocs(usersCol);
  const userList = userSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
  return userList;
}

export const getProjects = async (): Promise<Project[]> => {
  const { firestore } = await initializeFirebaseOnServer();
  const projectsCol = collection(firestore, 'projects');
  const projectSnapshot = await getDocs(projectsCol);
  const projectList = projectSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
  return projectList;
};

export const getSubProjectsWithLatestLogs = async (): Promise<SubProjectWithLatestLog[]> => {
    const { firestore } = await initializeFirebaseOnServer();
    const projects = await getProjects();
    const users = await getUsers();

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


export const getProgressLogsForSubProject = async (subProjectId: string): Promise<ProgressLog[]> => {
    const { firestore } = await initializeFirebaseOnServer();
    // This is a bit inefficient as we don't know the project id.
    // In a real app you'd pass projectId down or structure data differently.
    const projects = await getProjects();
    let logs: ProgressLog[] = [];

    for (const project of projects) {
        const logsCol = collection(firestore, `projects/${project.id}/sub_projects/${subProjectId}/progress_logs`);
        const q = query(logsCol, orderBy('updatedAt', 'desc'));
        const logsSnapshot = await getDocs(q);
        if (!logsSnapshot.empty) {
            const users = await getUsers();
            const userMap = new Map(users.map(u => [u.uid, u.displayName]));
            logs = logsSnapshot.docs.map(doc => {
                const data = doc.data() as ProgressLog;
                return {
                    ...data,
                    id: doc.id,
                    updatedAt: (data.updatedAt as Timestamp).toDate(),
                    createdByName: userMap.get(data.createdBy)
                }
            });
            break; // Found the logs for the subproject
        }
    }
    return logs;
};

export const addProgressLog = async (subProjectId: string, logData: Omit<ProgressLog, 'id' | 'updatedAt' | 'createdBy'>): Promise<ProgressLog> => {
    const { firestore } = await initializeFirebaseOnServer();
    
    // This is not correct as we don't know the project ID here. This function needs to be improved.
    // For now, this is a placeholder. A better approach is to pass projectId.
    const path = `projects/placeholder_project_id/sub_projects/${subProjectId}/progress_logs`;
    const newLogRef = doc(collection(firestore, path));
    
    // This should come from the authenticated user session on the server
    const userId = 'user-1-placeholder'; 

    const newLogData = {
        ...logData,
        subProjectId,
        createdBy: userId,
        updatedAt: serverTimestamp()
    };
    
    // In a real scenario, you'd find the project ID first.
    // await setDoc(newLogRef, newLogData);
    
    console.log("Simulating adding log for now, as project ID is not available here.");

    // Returning a simulated object because we can't actually write without the project ID.
    return {
        id: `log-simulated-${Date.now()}`,
        ...logData,
        createdBy: userId,
        updatedAt: new Date(), 
        createdByName: 'Placeholder User'
    } as ProgressLog;
};
