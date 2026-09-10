'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { User, ProgressLog, FullProject, SubProjectWithLatestLog, ProjectActionItem } from '@/types';
import { subDays, startOfWeek, endOfWeek, format } from 'date-fns';

/**
 * 格式化為 ISO 字串
 */
const formatISO = (dateStr: string | null): string => {
    if (!dateStr) return new Date().toISOString();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

const formatISOOptional = (dateStr: string | null): string | undefined => {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
};

/**
 * 從週報區間字串解析出日期數值 (YYYY/MM/DD)
 */
const getSafeTimeFromPeriod = (period: string): number => {
    if (!period || period === 'Excel 匯入') return 0;
    const match = period.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (match) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])).getTime();
    }
    return 0;
};

/**
 * 計算當前的週報區間字串 (格式: YYYY/MM/DD - MM/DD)
 */
const getCurrentReportingPeriod = () => {
    const now = new Date();
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    const sunday = endOfWeek(now, { weekStartsOn: 1 });
    return `${format(monday, 'yyyy/MM/dd')} - ${format(sunday, 'MM/dd')}`;
};

// --- 成員管理 ---

export async function getUsers(): Promise<User[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from('users').select('*');
    if (error || !data) return [];

    return data.map(doc => ({
        uid: doc.uid,
        email: doc.email || '',
        displayName: doc.display_name || '',
        role: doc.role || 'viewer',
        status: doc.status || 'active',
        createdAt: formatISO(doc.created_at),
    }));
}

export async function createUser(data: any) {
    const supabase = createClient();
    try {
        const { error } = await supabase.from('users').insert({
            firebase_uid: crypto.randomUUID(), // placeholder since no longer using firebase auth
            email: data.email,
            display_name: data.displayName,
            role: data.role,
            status: data.status,
            created_at: new Date().toISOString()
        });
        if (error) throw error;
        revalidatePath('/users');
        return { success: true, message: '成員已成功建立！' };
    } catch (error) {
        return { success: false, message: '建立成員時發生錯誤。' };
    }
}

export async function updateUser(uid: string, data: any) {
    const supabase = createClient();
    try {
        const { error } = await supabase.from('users').update({
            email: data.email,
            display_name: data.displayName,
            role: data.role,
            status: data.status
        }).eq('uid', uid);
        if (error) throw error;
        revalidatePath('/users');
        return { success: true, message: '成員已成功更新！' };
    } catch (error) {
        return { success: false, message: '更新成員時發生錯誤。' };
    }
}

export async function deleteUser(uid: string) {
    const supabase = createClient();
    try {
        const { error } = await supabase.from('users').delete().eq('uid', uid);
        if (error) throw error;
        revalidatePath('/users');
        return { success: true, message: '成員已成功刪除！' };
    } catch (error) {
        return { success: false, message: '刪除成員時發生錯誤。' };
    }
}

// --- 專案管理 ---

export async function createProject(data: any) {
    const supabase = createClient();
    const userId = 'admin-user'; 

    try {
        const { data: newProject, error: projectError } = await supabase.from('projects').insert({
            firebase_id: crypto.randomUUID(), // Mocking firebase_id for now
            name: data.name,
            case_number: String(data.caseNumber).trim(),
            status: 'active',
            created_by: userId,
            project_purpose: data.projectPurpose ?? '',
            current_status_and_issues: data.currentStatusAndIssues ?? '',
            yieh_phui_project_manager: data.yiehPhuiProjectManager ?? '',
            tpm_office_contact: data.tpmOfficeContact ?? '',
            egiga_contact: data.egigaContact ?? '',
            is_on_hold: false,
        }).select('id').single();

        if (projectError) throw projectError;

        if (data.subProjects && data.subProjects.length > 0) {
            const subProjectsToInsert = data.subProjects.map((sp: any) => ({
                firebase_id: crypto.randomUUID(),
                project_id: newProject.id,
                name: sp.name,
                owner: sp.owner,
                expected_completion_date: sp.expectedCompletionDate ?? null,
                actual_completion_date: sp.actualCompletionDate ?? null,
                is_on_hold: false,
            }));
            const { error: spError } = await supabase.from('sub_projects').insert(subProjectsToInsert);
            if (spError) throw spError;
        }

        revalidatePath('/dashboard');
        return { success: true, message: '專案已成功建立！' };
    } catch (error) {
        console.error(error);
        return { success: false, message: '建立專案失敗' };
    }
}

export async function updateProject(projectId: string, data: any, originalSubProjectIds: string[]) {
    const supabase = createClient();
    try {
        const { error: projectError } = await supabase.from('projects').update({
            case_number: String(data.caseNumber).trim(),
            name: data.name,
            project_purpose: data.projectPurpose ?? '',
            current_status_and_issues: data.currentStatusAndIssues ?? '',
            yieh_phui_project_manager: data.yiehPhuiProjectManager ?? '',
            tpm_office_contact: data.tpmOfficeContact ?? '',
            egiga_contact: data.egigaContact ?? '',
        }).eq('id', projectId);

        if (projectError) throw projectError;

        const currentSubProjectIds = data.subProjects.map((sp: any) => sp.id).filter(Boolean) as string[];
        const subProjectsToDelete = originalSubProjectIds.filter(id => !currentSubProjectIds.includes(id));
        
        if (subProjectsToDelete.length > 0) {
            const { error: deleteError } = await supabase.from('sub_projects').delete().in('id', subProjectsToDelete);
            if (deleteError) throw deleteError;
        }

        const subProjectsToInsert = [];
        const subProjectsToUpdate = [];

        for (const spData of data.subProjects) {
            const payload = {
                name: spData.name,
                owner: spData.owner,
                expected_completion_date: spData.expectedCompletionDate ?? null,
                actual_completion_date: spData.actualCompletionDate ?? null,
                project_id: projectId,
            };

            if (spData.id) {
                subProjectsToUpdate.push({ id: spData.id, ...payload });
            } else {
                subProjectsToInsert.push({ firebase_id: crypto.randomUUID(), is_on_hold: false, ...payload });
            }
        }

        if (subProjectsToInsert.length > 0) {
            const { error } = await supabase.from('sub_projects').insert(subProjectsToInsert);
            if (error) throw error;
        }

        for (const spUpdate of subProjectsToUpdate) {
            const { error } = await supabase.from('sub_projects').update({
                name: spUpdate.name,
                owner: spUpdate.owner,
                expected_completion_date: spUpdate.expected_completion_date,
                actual_completion_date: spUpdate.actual_completion_date
            }).eq('id', spUpdate.id);
            if (error) throw error;
        }
        
        revalidatePath('/dashboard');
        return { success: true, message: '專案已成功更新！' };
    } catch (error) {
        console.error(error);
        return { success: false, message: '更新失敗' };
    }
}

// --- 週報管理 ---

export async function addProgressLog(projectId: string, subProjectId: string, logData: any): Promise<ProgressLog> {
    const supabase = createClient();
    const userId = 'admin-user'; 
    
    const payload = {
        firebase_id: crypto.randomUUID(),
        sub_project_id: subProjectId,
        reporting_period: logData.reportingPeriod,
        execution_summary: logData.executionSummary,
        next_week_plan: logData.nextWeekPlan,
        roadblocks: logData.roadblocks,
        completion_percentage: logData.completionPercentage,
        created_by: userId,
        updated_at: new Date().toISOString(),
    };

    const { data: newLog, error } = await supabase.from('progress_logs').insert(payload).select().single();
    if (error) throw error;

    revalidatePath('/dashboard');
    
    return {
        id: newLog.id,
        subProjectId,
        reportingPeriod: newLog.reporting_period,
        executionSummary: newLog.execution_summary,
        nextWeekPlan: newLog.next_week_plan,
        roadblocks: newLog.roadblocks,
        completionPercentage: newLog.completion_percentage,
        createdBy: newLog.created_by,
        updatedAt: newLog.updated_at,
    } as ProgressLog;
}

export async function updateProgressLog(logId: string, projectId: string, subProjectId: string, logData: any): Promise<ProgressLog> {
    const supabase = createClient();
    const { data: updatedLog, error } = await supabase.from('progress_logs').update({
        reporting_period: logData.reportingPeriod,
        execution_summary: logData.executionSummary,
        next_week_plan: logData.nextWeekPlan,
        roadblocks: logData.roadblocks,
        completion_percentage: logData.completionPercentage,
        updated_at: new Date().toISOString(),
    }).eq('id', logId).select().single();

    if (error) throw error;

    revalidatePath('/dashboard');
    
    return {
        id: updatedLog.id,
        subProjectId: updatedLog.sub_project_id,
        reportingPeriod: updatedLog.reporting_period,
        executionSummary: updatedLog.execution_summary,
        nextWeekPlan: updatedLog.next_week_plan,
        roadblocks: updatedLog.roadblocks,
        completionPercentage: updatedLog.completion_percentage,
        createdBy: updatedLog.created_by,
        updatedAt: updatedLog.updated_at,
    } as ProgressLog;
}

export async function deleteProgressLog(logId: string) {
    const supabase = createClient();
    const { error } = await supabase.from('progress_logs').delete().eq('id', logId);
    if (error) throw error;
    revalidatePath('/dashboard');
    return { success: true, message: '週報已成功刪除！' };
}

export async function deleteSubProjects(projectId: string, subProjectIds: string[]) {
    const supabase = createClient();
    
    // First, delete related progress logs to avoid foreign key constraints
    const { error: logsError } = await supabase.from('progress_logs').delete().in('sub_project_id', subProjectIds);
    if (logsError) throw logsError;

    // Then, delete the sub projects
    const { error } = await supabase.from('sub_projects').delete().in('id', subProjectIds);
    if (error) throw error;
    
    // Check if the main project has any remaining sub_projects
    const { count, error: countError } = await supabase.from('sub_projects')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
        
    // If no sub_projects remain, safely delete the main project
    if (!countError && count === 0) {
        await supabase.from('projects').delete().eq('id', projectId);
    }

    revalidatePath('/dashboard');
}

export async function setProjectOnHold(projectId: string, subProjectIds: string[], onHoldData: any) {
    const supabase = createClient();
    try {
        const onHoldPayload = {
            is_on_hold: true,
            on_hold_reason: onHoldData.reason,
            on_hold_start_date: onHoldData.startDate,
            on_hold_end_date: onHoldData.endDate ?? null,
            on_hold_notes: onHoldData.notes ?? '',
        };

        const { data: subProjectsSnap } = await supabase.from('sub_projects').select('id').eq('project_id', projectId);
        
        if (subProjectsSnap && subProjectIds.length === subProjectsSnap.length) {
            await supabase.from('projects').update({ ...onHoldPayload, status: 'on-hold' }).eq('id', projectId);
        }

        if (subProjectIds.length > 0) {
            await supabase.from('sub_projects').update({ is_on_hold: true }).in('id', subProjectIds);
        }

        revalidatePath('/dashboard');
        return { success: true, message: '已成功設定暫緩！' };
    } catch (e) {
        return { success: false, message: '設定失敗' };
    }
}

export async function resumeProject(projectId: string, subProjectId?: string) {
    const supabase = createClient();
    if (subProjectId) {
        await supabase.from('sub_projects').update({ is_on_hold: false }).eq('id', subProjectId);
    } else {
        await supabase.from('projects').update({ status: 'active', is_on_hold: false }).eq('id', projectId);
    }
    revalidatePath('/dashboard');
    return { success: true, message: '專案已恢復！' };
}

export async function resumeProjects(projectIds: string[], subProjectsByProject: any) {
    const supabase = createClient();
    if (projectIds.length > 0) {
        await supabase.from('projects').update({ is_on_hold: false, status: 'active' }).in('id', projectIds);
    }
    
    const allSubProjectIdsToResume: string[] = [];
    for (const pid in subProjectsByProject) {
        allSubProjectIdsToResume.push(...subProjectsByProject[pid]);
    }
    
    if (allSubProjectIdsToResume.length > 0) {
        await supabase.from('sub_projects').update({ is_on_hold: false }).in('id', allSubProjectIdsToResume);
    }

    revalidatePath('/dashboard');
    return { success: true, message: '專案已成功恢復！' };
}

/**
 * 核心資料處理引擎：案號去重、最新週報判定(本週優先)、專案大到小排序、子項目 1,2,3 排序
 */
async function getOptimizedProjectData() {
    const supabase = createClient();
    
    const [
        { data: projectsSnap }, 
        { data: subProjectsSnap }, 
        { data: logsSnap }, 
        users
    ] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('sub_projects').select('*'),
        supabase.from('progress_logs').select('*'),
        getUsers()
    ]);

    const userMap = new Map(users.map(u => [u.uid, u.displayName]));
    const currentPeriod = getCurrentReportingPeriod();

    const projectsMap = new Map<string, FullProject>();
    const caseNumberProcessed = new Set<string>();

    if (projectsSnap) {
        projectsSnap.forEach(doc => {
            const caseNumber = String(doc.case_number || '').trim();
            if (!caseNumber || caseNumberProcessed.has(caseNumber)) return;

            caseNumberProcessed.add(caseNumber);
            projectsMap.set(doc.id, {
                id: doc.id,
                caseNumber,
                name: doc.name || '',
                status: doc.status || 'active',
                projectPurpose: doc.project_purpose || '',
                currentStatusAndIssues: doc.current_status_and_issues || '',
                yiehPhuiProjectManager: doc.yieh_phui_project_manager || '',
                tpmOfficeContact: doc.tpm_office_contact || '',
                egigaContact: doc.egiga_contact || '',
                isOnHold: !!doc.is_on_hold,
                createdAt: formatISO(doc.created_at),
                subProjects: [],
            } as any);
        });
    }

    const latestLogsMap = new Map<string, ProgressLog>();
    if (logsSnap) {
        logsSnap.forEach(doc => {
            if (doc.reporting_period === 'Excel 匯入') return;

            const spId = doc.sub_project_id;
            if (!spId) return;

            const curUpdatedTime = new Date(doc.updated_at).getTime();
            const isCurrentWeek = doc.reporting_period === currentPeriod;

            const existing = latestLogsMap.get(spId);
            if (!existing) {
                latestLogsMap.set(spId, {
                    id: doc.id,
                    subProjectId: spId,
                    reportingPeriod: doc.reporting_period || '',
                    executionSummary: doc.execution_summary || '',
                    nextWeekPlan: doc.next_week_plan || '',
                    roadblocks: doc.roadblocks || '',
                    completionPercentage: doc.completion_percentage || 0,
                    updatedAt: formatISO(doc.updated_at),
                    createdBy: doc.created_by || '',
                    createdByName: userMap.get(doc.created_by) || '未知',
                } as any);
                return;
            }

            const existingUpdatedTime = new Date(existing.updatedAt).getTime();
            const existingIsCurrent = existing.reportingPeriod === currentPeriod;

            let shouldReplace = false;
            if (isCurrentWeek && !existingIsCurrent) {
                shouldReplace = true;
            } else if (isCurrentWeek === existingIsCurrent) {
                if (curUpdatedTime > existingUpdatedTime) {
                    shouldReplace = true;
                }
            }

            if (shouldReplace) {
                latestLogsMap.set(spId, {
                    id: doc.id,
                    subProjectId: spId,
                    reportingPeriod: doc.reporting_period || '',
                    executionSummary: doc.execution_summary || '',
                    nextWeekPlan: doc.next_week_plan || '',
                    roadblocks: doc.roadblocks || '',
                    completionPercentage: doc.completion_percentage || 0,
                    updatedAt: formatISO(doc.updated_at),
                    createdBy: doc.created_by || '',
                    createdByName: userMap.get(doc.created_by) || '未知',
                } as any);
            }
        });
    }

    if (subProjectsSnap) {
        subProjectsSnap.forEach(doc => {
            const project = projectsMap.get(doc.project_id);
            if (!project) return;

            const rawLatestLog = latestLogsMap.get(doc.id) || null;
            const isCompleted = (rawLatestLog?.completionPercentage ?? 0) === 100;
            const isCurrentWeek = rawLatestLog?.reportingPeriod === currentPeriod;
            
            // 依手冊規範：100% 結案之項目永久自動帶入最後一筆週報；進行中項目若非本週更新則清空本週摘要
            const latestLog = rawLatestLog ? {
                ...rawLatestLog,
                executionSummary: (isCurrentWeek || isCompleted) ? rawLatestLog.executionSummary : '',
                nextWeekPlan: (isCurrentWeek || isCompleted) ? rawLatestLog.nextWeekPlan : '',
                roadblocks: (isCurrentWeek || isCompleted) ? rawLatestLog.roadblocks : '',
            } : null;

            const sp: SubProjectWithLatestLog = {
                id: doc.id,
                projectId: project.id,
                name: doc.name || '',
                owner: doc.owner || '',
                ownerName: userMap.get(doc.owner) || '未知',
                expectedCompletionDate: formatISO(doc.expected_completion_date),
                actualCompletionDate: formatISOOptional(doc.actual_completion_date),
                isOnHold: !!doc.is_on_hold,
                isParentOnHold: project.isOnHold,
                latestLog,
                projectName: project.name,
                projectCaseNumber: project.caseNumber,
                tpmOfficeContact: project.tpmOfficeContact,
                isOverdue: false,
            } as any;

            // 依手冊規範：進行中且未滿 100% 之專案，若當前自然週尚未發布週報，自動標記為紅色「本週未更新」
            if (!sp.isOnHold && !sp.isParentOnHold && !isCompleted) {
                sp.isOverdue = !isCurrentWeek;
            }

            project.subProjects.push(sp);
        });
    }

    const sortByKey = (a: string, b: string) => b.localeCompare(a, undefined, { numeric: true });

    const sortedFullProjects = Array.from(projectsMap.values())
        .filter(p => p.subProjects.length > 0)
        .sort((a, b) => sortByKey(a.caseNumber, b.caseNumber))
        .map(project => {
            project.subProjects.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true }));
            return project;
        });

    const sortedAllSubProjects: SubProjectWithLatestLog[] = [];
    sortedFullProjects.forEach(p => {
        sortedAllSubProjects.push(...p.subProjects);
    });

    return { 
        allSubProjects: sortedAllSubProjects, 
        fullProjects: sortedFullProjects 
    };
}

export const getSubProjectsWithLatestLogs = async () => (await getOptimizedProjectData()).allSubProjects;
export const getFullProjects = async () => (await getOptimizedProjectData()).fullProjects;

export const getFullProjectById = async (id: string) => {
    const projects = await getFullProjects();
    return projects.find(p => p.id === id) || null;
};

/**
 * 取得單一子專案的所有歷史週報
 */
export const getProgressLogsForSubProject = async (projectId: string, subProjectId: string): Promise<ProgressLog[]> => {
    const supabase = createClient();
    const { data: snap } = await supabase.from('progress_logs').select('*').eq('sub_project_id', subProjectId);
    
    if (!snap) return [];

    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    return snap
        .map(doc => {
            return {
                id: doc.id,
                subProjectId: doc.sub_project_id,
                reportingPeriod: doc.reporting_period,
                executionSummary: doc.execution_summary,
                nextWeekPlan: doc.next_week_plan,
                roadblocks: doc.roadblocks,
                completionPercentage: doc.completion_percentage,
                createdBy: doc.created_by,
                updatedAt: formatISO(doc.updated_at),
                createdByName: userMap.get(doc.created_by) || '未知',
            } as any;
        })
        .filter(l => l.reportingPeriod !== 'Excel 匯入')
        .sort((a, b) => {
            const timeA = getSafeTimeFromPeriod(a.reportingPeriod);
            const timeB = getSafeTimeFromPeriod(b.reportingPeriod);
            if (timeA !== timeB) return timeB - timeA;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
};

// --- 內部細部待辦事項與專案歷程追蹤 (Action Items) ---

export async function getActionItems(projectId?: string): Promise<ProjectActionItem[]> {
    const supabase = createClient();
    try {
        let query = supabase.from('project_action_items').select('*');
        if (projectId) {
            query = query.eq('project_id', projectId);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error || !data) {
            console.error('取得待辦事項失敗 (可能尚未建立資料表):', error?.message);
            return [];
        }

        // 取得專案名稱與案號作為輔助
        const { data: projectsData } = await supabase.from('projects').select('id, name, case_number');
        const projMap = new Map((projectsData || []).map(p => [p.id, { name: p.name, caseNumber: p.case_number }]));

        return data.map(item => {
            const proj = projMap.get(item.project_id);
            return {
                id: item.id,
                projectId: item.project_id,
                subProjectId: item.sub_project_id || null,
                title: item.title,
                phase: item.phase,
                status: item.status,
                owner: item.owner || '',
                waitingOn: item.waiting_on || '',
                dueDate: item.due_date ? String(item.due_date) : null,
                completedAt: item.completed_at ? String(item.completed_at) : null,
                notes: item.notes || '',
                lessonLearnt: item.lesson_learnt || '',
                createdAt: formatISO(item.created_at),
                updatedAt: formatISO(item.updated_at),
                projectName: proj?.name || '',
                projectCaseNumber: proj?.caseNumber || '',
            };
        });
    } catch (err) {
        console.error('查詢待辦事項異常:', err);
        return [];
    }
}

export async function createActionItem(data: {
    projectId: string;
    subProjectId?: string | null;
    title: string;
    phase: string;
    status: string;
    owner: string;
    waitingOn?: string;
    dueDate?: string | null;
    notes?: string;
    lessonLearnt?: string;
}) {
    const supabase = createClient();
    try {
        const { error } = await supabase.from('project_action_items').insert({
            project_id: data.projectId,
            sub_project_id: data.subProjectId || null,
            title: data.title,
            phase: data.phase || '開發階段',
            status: data.status || 'pending',
            owner: data.owner || '',
            waiting_on: data.waitingOn || '',
            due_date: data.dueDate || null,
            completed_at: data.status === 'completed' ? new Date().toISOString() : null,
            notes: data.notes || '',
            lesson_learnt: data.lessonLearnt || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        if (error) throw error;
        revalidatePath('/internal-tasks');
        return { success: true, message: '待辦事項已建立！' };
    } catch (err: any) {
        console.error('建立待辦事項失敗:', err);
        return { success: false, message: err?.message || '建立待辦事項失敗' };
    }
}

export async function updateActionItem(id: string, data: Partial<{
    title: string;
    phase: string;
    status: string;
    owner: string;
    waitingOn: string;
    dueDate: string | null;
    notes: string;
    lessonLearnt: string;
}>) {
    const supabase = createClient();
    try {
        const updatePayload: any = {
            ...data,
            updated_at: new Date().toISOString()
        };

        if (data.status === 'completed') {
            updatePayload.completed_at = new Date().toISOString();
        } else if (data.status && data.status !== 'completed') {
            updatePayload.completed_at = null;
        }

        const { error } = await supabase
            .from('project_action_items')
            .update(updatePayload)
            .eq('id', id);

        if (error) throw error;
        revalidatePath('/internal-tasks');
        return { success: true, message: '待辦事項已更新！' };
    } catch (err: any) {
        console.error('更新待辦事項失敗:', err);
        return { success: false, message: err?.message || '更新待辦事項失敗' };
    }
}

export async function deleteActionItem(id: string) {
    const supabase = createClient();
    try {
        const { error } = await supabase
            .from('project_action_items')
            .delete()
            .eq('id', id);

        if (error) throw error;
        revalidatePath('/internal-tasks');
        return { success: true, message: '待辦事項已刪除！' };
    } catch (err: any) {
        console.error('刪除待辦事項失敗:', err);
        return { success: false, message: err?.message || '刪除待辦事項失敗' };
    }
}

export const getAllProjectsForInternal = async (): Promise<FullProject[]> => {
    const supabase = createClient();
    const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*')
        .order('case_number', { ascending: true });
        
    if (error || !projectsData) return [];

    return projectsData.map(doc => ({
        id: doc.id,
        caseNumber: doc.case_number,
        name: doc.name,
        status: (doc.status || 'active') as any,
        projectPurpose: doc.project_purpose || '',
        currentStatusAndIssues: doc.current_status_and_issues || '',
        yiehPhuiProjectManager: doc.yieh_phui_project_manager || '',
        tpmOfficeContact: doc.tpm_office_contact || '',
        egigaContact: doc.egiga_contact || '',
        isOnHold: !!doc.is_on_hold,
        createdAt: formatISO(doc.created_at),
        createdBy: doc.created_by || '',
        subProjects: [],
    }));
};

export async function createPocProject(data: {
    name: string;
    caseNumber?: string;
    projectPurpose?: string;
    tpmOfficeContact?: string;
}) {
    const supabase = createClient();
    try {
        const caseNum = data.caseNumber?.trim() || `POC-${Date.now().toString().slice(-4)}`;
        const { data: newProject, error } = await supabase.from('projects').insert({
            firebase_id: crypto.randomUUID(),
            name: data.name.trim(),
            case_number: caseNum,
            status: 'poc',
            project_purpose: data.projectPurpose || '內部評估 / POC 追蹤項目',
            tpm_office_contact: data.tpmOfficeContact || '',
            is_on_hold: false,
            created_at: new Date().toISOString()
        }).select('id, name, case_number, status').single();

        if (error) throw error;
        revalidatePath('/internal-tasks');
        return { success: true, message: '內部專案/POC項目已建立！', data: newProject };
    } catch (err: any) {
        console.error('建立內部專案失敗:', err);
        return { success: false, message: err?.message || '建立內部專案失敗' };
    }
}
