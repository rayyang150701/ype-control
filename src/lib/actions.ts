'use server';

import { revalidatePath } from 'next/cache';
import { createClient as getSupabaseClient } from '@/lib/supabase/server';
import type { User, ProgressLog, FullProject, SubProjectWithLatestLog, ProjectActionItem, InternalProjectOption, Client, ProjectSourceType } from '@/types';
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

export interface ProjectMeta {
    isInternal?: boolean;
    category?: '評估案' | '已開案';
    internalStatus?: 'in_progress' | 'completed' | 'terminated';
    sourceType?: ProjectSourceType;
    clientName?: string;
    responsiblePm?: string;
    clientContact?: string;
    expectedCompletionDate?: string | null;
    autoCompletedByClient?: boolean;
    linkedInternalProjectId?: string;
    linkedCustomerProjectId?: string;
    onHoldNotes?: string;
}

function parseProjectMeta(onHoldNotesRaw: string | null | undefined): ProjectMeta {
    if (!onHoldNotesRaw) return {};
    try {
        const trimmed = onHoldNotesRaw.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            return JSON.parse(trimmed);
        }
    } catch (e) {
        // Plain text notes
    }
    return { onHoldNotes: onHoldNotesRaw };
}

function serializeProjectMeta(meta: ProjectMeta): string {
    return JSON.stringify(meta);
}

// --- 成員管理 ---

export async function getUsers(): Promise<User[]> {
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
    try {
        const { error } = await supabase.from('users').delete().eq('uid', uid);
        if (error) throw error;
        revalidatePath('/users');
        return { success: true, message: '成員已成功刪除！' };
    } catch (error) {
        return { success: false, message: '刪除成員時發生錯誤。' };
    }
}

// --- 客戶維護管理 ---

export async function getClients(): Promise<Client[]> {
    const supabase = getSupabaseClient();
    const defaultClient: Client = {
        id: 'default-yieh-phui',
        name: '燁輝',
        code: 'YP',
        contactPerson: '黃裕峰',
        contactPhone: '',
        contactEmail: '',
        notes: '系統核心預設客戶',
        createdAt: new Date().toISOString(),
    };

    try {
        const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: true });
        if (error || !data || data.length === 0) {
            return [defaultClient];
        }

        const clientList: Client[] = data.map((doc: any) => ({
            id: doc.id,
            name: doc.name,
            code: doc.code || '',
            contactPerson: doc.contact_person || '',
            contactPhone: doc.contact_phone || '',
            contactEmail: doc.contact_email || '',
            notes: doc.notes || '',
            createdAt: formatISO(doc.created_at),
            updatedAt: formatISOOptional(doc.updated_at),
        }));

        // 確保「燁輝」必然在清單首位
        if (!clientList.some(c => c.name === '燁輝')) {
            clientList.unshift(defaultClient);
        }

        return clientList;
    } catch (e) {
        return [defaultClient];
    }
}

export async function createClient(data: {
    name: string;
    code?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    notes?: string;
}) {
    const supabase = getSupabaseClient();
    try {
        if (!data.name || !data.name.trim()) {
            return { success: false, message: '客戶名稱為必填' };
        }
        const { error } = await supabase.from('clients').insert({
            name: data.name.trim(),
            code: data.code?.trim() || '',
            contact_person: data.contactPerson?.trim() || '',
            contact_phone: data.contactPhone?.trim() || '',
            contact_email: data.contactEmail?.trim() || '',
            notes: data.notes?.trim() || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        revalidatePath('/clients');
        revalidatePath('/internal-tasks');
        revalidatePath('/dashboard');
        return { success: true, message: `客戶「${data.name}」已成功新增！` };
    } catch (err: any) {
        console.error('新增客戶失敗:', err);
        return { success: false, message: err?.message || '新增客戶失敗，請確認資料庫是否已建立 clients 表' };
    }
}

export async function updateClient(id: string, data: {
    name: string;
    code?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    notes?: string;
}) {
    const supabase = getSupabaseClient();
    try {
        if (!data.name || !data.name.trim()) {
            return { success: false, message: '客戶名稱為必填' };
        }
        const { error } = await supabase.from('clients').update({
            name: data.name.trim(),
            code: data.code?.trim() || '',
            contact_person: data.contactPerson?.trim() || '',
            contact_phone: data.contactPhone?.trim() || '',
            contact_email: data.contactEmail?.trim() || '',
            notes: data.notes?.trim() || '',
            updated_at: new Date().toISOString(),
        }).eq('id', id);
        if (error) throw error;
        revalidatePath('/clients');
        revalidatePath('/internal-tasks');
        revalidatePath('/dashboard');
        return { success: true, message: `客戶「${data.name}」已成功更新！` };
    } catch (err: any) {
        console.error('更新客戶失敗:', err);
        return { success: false, message: err?.message || '更新客戶失敗' };
    }
}

export async function deleteClient(id: string, name: string) {
    if (name === '燁輝') {
        return { success: false, message: '「燁輝」為系統預設核心客戶，不可刪除！' };
    }
    const supabase = getSupabaseClient();
    try {
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;
        revalidatePath('/clients');
        revalidatePath('/internal-tasks');
        revalidatePath('/dashboard');
        return { success: true, message: `客戶「${name}」已成功刪除！` };
    } catch (err: any) {
        console.error('刪除客戶失敗:', err);
        return { success: false, message: err?.message || '刪除客戶失敗' };
    }
}

// --- 專案刪除 (完整級聯刪除) ---

export async function deleteProject(projectId: string) {
    const supabase = getSupabaseClient();
    try {
        // 1. 刪除專案所屬內部待辦事項
        await supabase.from('project_action_items').delete().eq('project_id', projectId);

        // 2. 刪除專案所屬子專案及週報紀錄
        const { data: subProjects } = await supabase.from('sub_projects').select('id').eq('project_id', projectId);
        if (subProjects && subProjects.length > 0) {
            const subProjectIds = subProjects.map(sp => sp.id);
            await supabase.from('progress_logs').delete().in('sub_project_id', subProjectIds);
            await supabase.from('sub_projects').delete().eq('project_id', projectId);
        }

        // 3. 解除可能與其他專案存在的關聯
        const { data: linkedProjs } = await supabase.from('projects').select('id, on_hold_notes');
        if (linkedProjs) {
            for (const p of linkedProjs) {
                const meta = parseProjectMeta(p.on_hold_notes);
                let changed = false;
                if (meta.linkedInternalProjectId === projectId) {
                    delete meta.linkedInternalProjectId;
                    changed = true;
                }
                if (meta.linkedCustomerProjectId === projectId) {
                    delete meta.linkedCustomerProjectId;
                    changed = true;
                }
                if (changed) {
                    await supabase.from('projects').update({
                        on_hold_notes: serializeProjectMeta(meta)
                    }).eq('id', p.id);
                }
            }
        }

        // 4. 刪除主專案
        const { error: deleteErr } = await supabase.from('projects').delete().eq('id', projectId);
        if (deleteErr) throw deleteErr;

        revalidatePath('/internal-tasks');
        revalidatePath('/dashboard');
        return { success: true, message: '專案及所屬所有項目已成功刪除！' };
    } catch (err: any) {
        console.error('刪除專案失敗:', err);
        return { success: false, message: err?.message || '刪除專案失敗' };
    }
}

// --- 專案管理 ---

export async function createProject(data: any) {
    const supabase = getSupabaseClient();
    const userId = 'admin-user'; 

    try {
        const clientName = data.clientName?.trim() || '燁輝';
        const sourceType: ProjectSourceType = data.sourceType || '燁輝列管專案';
        const responsiblePm = data.responsiblePm?.trim() || data.tpmOfficeContact?.trim() || data.egigaContact?.trim() || '';
        const clientContact = data.clientContact?.trim() || data.yiehPhuiProjectManager?.trim() || '';

        const metaPayload: ProjectMeta = {
            isInternal: false,
            sourceType,
            clientName,
            responsiblePm,
            clientContact,
            linkedInternalProjectId: data.linkedInternalProjectId || undefined,
        };

        const { data: newProject, error: projectError } = await supabase.from('projects').insert({
            firebase_id: crypto.randomUUID(),
            name: data.name,
            case_number: String(data.caseNumber).trim(),
            status: 'active',
            created_by: userId,
            project_purpose: data.projectPurpose ?? '',
            current_status_and_issues: data.currentStatusAndIssues ?? '',
            yieh_phui_project_manager: clientContact,
            tpm_office_contact: responsiblePm,
            egiga_contact: data.egigaContact ?? '',
            is_on_hold: false,
            on_hold_notes: serializeProjectMeta(metaPayload),
        }).select('id').single();

        if (projectError) throw projectError;

        // 若有連結內部專案，將內部專案綁定此客戶專案 ID
        if (data.linkedInternalProjectId) {
            try {
                const { data: internalProj } = await supabase
                    .from('projects')
                    .select('on_hold_notes')
                    .eq('id', data.linkedInternalProjectId)
                    .single();
                const internalMeta = parseProjectMeta(internalProj?.on_hold_notes);
                internalMeta.linkedCustomerProjectId = newProject.id;
                await supabase.from('projects').update({
                    on_hold_notes: serializeProjectMeta(internalMeta)
                }).eq('id', data.linkedInternalProjectId);
            } catch (e) {
                console.error('綁定內部專案失敗:', e);
            }
        }

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
        revalidatePath('/internal-tasks');
        return { success: true, message: '專案已成功建立！' };
    } catch (error) {
        console.error(error);
        return { success: false, message: '建立專案失敗' };
    }
}

export async function updateProject(projectId: string, data: any, originalSubProjectIds: string[]) {
    const supabase = getSupabaseClient();
    try {
        // 取得現有 metadata
        const { data: existingProj } = await supabase
            .from('projects')
            .select('on_hold_notes')
            .eq('id', projectId)
            .single();
        const currentMeta = parseProjectMeta(existingProj?.on_hold_notes);
        
        const clientName = data.clientName?.trim() || currentMeta.clientName || '燁輝';
        const sourceType: ProjectSourceType = data.sourceType || currentMeta.sourceType || '燁輝列管專案';
        const responsiblePm = data.responsiblePm !== undefined ? data.responsiblePm.trim() : (currentMeta.responsiblePm || data.tpmOfficeContact || '');
        const clientContact = data.clientContact !== undefined ? data.clientContact.trim() : (currentMeta.clientContact || data.yiehPhuiProjectManager || '');

        currentMeta.clientName = clientName;
        currentMeta.sourceType = sourceType;
        currentMeta.responsiblePm = responsiblePm;
        currentMeta.clientContact = clientContact;
        currentMeta.linkedInternalProjectId = data.linkedInternalProjectId || undefined;
        currentMeta.isInternal = false;

        const { error: projectError } = await supabase.from('projects').update({
            case_number: String(data.caseNumber).trim(),
            name: data.name,
            project_purpose: data.projectPurpose ?? '',
            current_status_and_issues: data.currentStatusAndIssues ?? '',
            yieh_phui_project_manager: clientContact,
            tpm_office_contact: responsiblePm,
            egiga_contact: data.egigaContact ?? '',
            on_hold_notes: serializeProjectMeta(currentMeta),
        }).eq('id', projectId);

        if (projectError) throw projectError;

        // 若有綁定內部專案，將該內部專案設定關聯
        if (data.linkedInternalProjectId) {
            try {
                const { data: internalProj } = await supabase
                    .from('projects')
                    .select('on_hold_notes')
                    .eq('id', data.linkedInternalProjectId)
                    .single();
                const internalMeta = parseProjectMeta(internalProj?.on_hold_notes);
                internalMeta.linkedCustomerProjectId = projectId;
                await supabase.from('projects').update({
                    on_hold_notes: serializeProjectMeta(internalMeta)
                }).eq('id', data.linkedInternalProjectId);
            } catch (e) {
                console.error('更新內部專案關聯失敗:', e);
            }
        }

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
        revalidatePath('/internal-tasks');
        return { success: true, message: '專案已成功更新！' };
    } catch (error) {
        console.error(error);
        return { success: false, message: '更新失敗' };
    }
}

// --- 週報管理 ---

export async function addProgressLog(projectId: string, subProjectId: string, logData: any): Promise<ProgressLog> {
    const supabase = getSupabaseClient();
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

    if (Number(logData.completionPercentage) === 100) {
        try {
            const { data: proj } = await supabase.from('projects').select('on_hold_notes').eq('id', projectId).single();
            const meta = parseProjectMeta(proj?.on_hold_notes);
            if (meta.linkedInternalProjectId) {
                await syncInternalProjectCompletion(meta.linkedInternalProjectId, true);
            }
        } catch (e) {
            console.error('週報同步內部專案結案異常:', e);
        }
    }

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
    const supabase = getSupabaseClient();
    const { data: updatedLog, error } = await supabase.from('progress_logs').update({
        reporting_period: logData.reportingPeriod,
        execution_summary: logData.executionSummary,
        next_week_plan: logData.nextWeekPlan,
        roadblocks: logData.roadblocks,
        completion_percentage: logData.completionPercentage,
        updated_at: new Date().toISOString(),
    }).eq('id', logId).select().single();

    if (error) throw error;

    if (Number(logData.completionPercentage) === 100) {
        try {
            const { data: proj } = await supabase.from('projects').select('on_hold_notes').eq('id', projectId).single();
            const meta = parseProjectMeta(proj?.on_hold_notes);
            if (meta.linkedInternalProjectId) {
                await syncInternalProjectCompletion(meta.linkedInternalProjectId, true);
            }
        } catch (e) {
            console.error('週報同步內部專案結案異常:', e);
        }
    }

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
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('progress_logs').delete().eq('id', logId);
    if (error) throw error;
    revalidatePath('/dashboard');
    return { success: true, message: '週報已成功刪除！' };
}

export async function deleteSubProjects(projectId: string, subProjectIds: string[]) {
    const supabase = getSupabaseClient();
    
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
    if (subProjectId) {
        await supabase.from('sub_projects').update({ is_on_hold: false }).eq('id', subProjectId);
    } else {
        await supabase.from('projects').update({ status: 'active', is_on_hold: false }).eq('id', projectId);
    }
    revalidatePath('/dashboard');
    return { success: true, message: '專案已恢復！' };
}

export async function resumeProjects(projectIds: string[], subProjectsByProject: any) {
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
    
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
            const meta = parseProjectMeta(doc.on_hold_notes);
            const clientName = meta.clientName?.trim() || '燁輝';
            const sourceType: ProjectSourceType = meta.sourceType || '燁輝列管專案';
            const responsiblePm = meta.responsiblePm?.trim() || doc.tpm_office_contact || doc.egiga_contact || '';
            const clientContact = meta.clientContact?.trim() || doc.yieh_phui_project_manager || '';

            projectsMap.set(doc.id, {
                id: doc.id,
                caseNumber,
                name: doc.name || '',
                status: doc.status || 'active',
                sourceType,
                clientName,
                responsiblePm,
                clientContact,
                linkedInternalProjectId: meta.linkedInternalProjectId,
                projectPurpose: doc.project_purpose || '',
                currentStatusAndIssues: doc.current_status_and_issues || '',
                yiehPhuiProjectManager: clientContact,
                tpmOfficeContact: responsiblePm,
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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

        // 取得專案名稱與案號及類別作為輔助
        const { data: projectsData } = await supabase.from('projects').select('id, name, case_number, status');
        const projMap = new Map((projectsData || []).map(p => [p.id, { 
            name: p.name, 
            caseNumber: p.case_number,
            category: (p.status === 'poc' || p.status === 'evaluation') ? '評估案' : '已開案'
        }]));

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
                projectCategory: (proj?.category || '已開案') as ('評估案' | '已開案'),
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
    const [
        { data: projectsData, error: projErr },
        { data: actionItemsData }
    ] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('project_action_items').select('project_id')
    ]);
        
    if (projErr || !projectsData) return [];

    const projectsWithItems = new Set((actionItemsData || []).map(i => i.project_id));

    // 去除重覆案號（若有相同案號者，保留最新紀錄以避免畫面上出現兩張一模一樣的卡片）
    const uniqueMap = new Map<string, any>();
    for (const doc of projectsData) {
        const key = doc.case_number ? String(doc.case_number).trim() : doc.id;
        const existing = uniqueMap.get(key);
        if (!existing) {
            uniqueMap.set(key, doc);
        } else {
            const existingTime = new Date(existing.created_at).getTime();
            const curTime = new Date(doc.created_at).getTime();
            if (curTime > existingTime) {
                uniqueMap.set(key, doc);
            }
        }
    }

    const projectsList = Array.from(uniqueMap.values()).filter(doc => {
        const meta = parseProjectMeta(doc.on_hold_notes);
        // 如果明確標記為非內部專案 (來自客戶管制表開案)，則排除
        if (meta.isInternal === false) return false;

        // 如果明確標記為內部專案、或是評估案/POC、或已有建立待辦事項
        if (meta.isInternal === true) return true;
        if (doc.status === 'evaluation' || doc.status === 'poc') return true;
        if (projectsWithItems.has(doc.id)) return true;

        // 原有既存專案保留
        return true;
    });

    return projectsList.map(doc => {
        const meta = parseProjectMeta(doc.on_hold_notes);
        const isEval = meta.category ? meta.category === '評估案' : (doc.status === 'poc' || doc.status === 'evaluation');
        
        let internalStatus: 'in_progress' | 'completed' | 'terminated' = 'in_progress';
        if (meta.internalStatus) {
            internalStatus = meta.internalStatus;
        } else if (doc.status === 'completed') {
            internalStatus = 'completed';
        } else if (doc.status === 'terminated' || doc.status === 'cancelled') {
            internalStatus = 'terminated';
        }

        const clientName = meta.clientName?.trim() || '燁輝';
        const sourceType: ProjectSourceType = meta.sourceType || (isEval ? '億威內部自建專案' : '燁輝列管專案');
        const responsiblePm = meta.responsiblePm?.trim() || doc.tpm_office_contact || doc.egiga_contact || '';
        const clientContact = meta.clientContact?.trim() || doc.yieh_phui_project_manager || '';

        return {
            id: doc.id,
            caseNumber: doc.case_number,
            name: doc.name,
            status: (doc.status || 'active') as any,
            isInternal: true,
            projectCategory: isEval ? '評估案' : '已開案',
            internalStatus,
            sourceType,
            clientName,
            responsiblePm,
            clientContact,
            expectedCompletionDate: meta.expectedCompletionDate || null,
            autoCompletedByClient: !!meta.autoCompletedByClient,
            linkedCustomerProjectId: meta.linkedCustomerProjectId,
            projectPurpose: doc.project_purpose || '',
            currentStatusAndIssues: doc.current_status_and_issues || '',
            yiehPhuiProjectManager: clientContact,
            tpmOfficeContact: responsiblePm,
            egigaContact: doc.egiga_contact || '',
            isOnHold: !!doc.is_on_hold,
            createdAt: formatISO(doc.created_at),
            createdBy: doc.created_by || '',
            subProjects: [],
        };
    });
};

export async function createInternalProject(data: {
    name: string;
    caseNumber?: string;
    category?: '評估案' | '已開案';
    sourceType?: ProjectSourceType;
    clientName?: string;
    responsiblePm?: string;
    clientContact?: string;
    projectPurpose?: string;
    tpmOfficeContact?: string;
    expectedCompletionDate?: string | null;
}) {
    const supabase = getSupabaseClient();
    try {
        const category = data.category || '評估案';
        const isEval = category === '評估案';
        const defaultPrefix = isEval ? 'POC' : 'PRJ';
        const caseNum = data.caseNumber?.trim() || `${defaultPrefix}-${Date.now().toString().slice(-4)}`;

        const sourceType: ProjectSourceType = data.sourceType || (isEval ? '億威內部自建專案' : '燁輝列管專案');
        const clientName = data.clientName?.trim() || '燁輝';
        const responsiblePm = data.responsiblePm?.trim() || data.tpmOfficeContact?.trim() || '';
        const clientContact = data.clientContact?.trim() || '';

        const meta: ProjectMeta = {
            isInternal: true,
            category,
            internalStatus: 'in_progress',
            sourceType,
            clientName,
            responsiblePm,
            clientContact,
            expectedCompletionDate: data.expectedCompletionDate || null,
        };

        const { data: newProject, error } = await supabase.from('projects').insert({
            firebase_id: crypto.randomUUID(),
            name: data.name.trim(),
            case_number: caseNum,
            status: isEval ? 'evaluation' : 'active',
            project_purpose: data.projectPurpose || (isEval ? '內部評估案 / POC 項目' : '內部自主開案項目'),
            tpm_office_contact: responsiblePm,
            yieh_phui_project_manager: clientContact,
            is_on_hold: false,
            on_hold_notes: serializeProjectMeta(meta),
            created_at: new Date().toISOString()
        }).select('id, name, case_number, status, tpm_office_contact, yieh_phui_project_manager, project_purpose, created_at, on_hold_notes').single();

        if (error) throw error;
        revalidatePath('/internal-tasks');
        revalidatePath('/dashboard');
        return { 
            success: true, 
            message: `內部「${category}」已建立！`, 
            data: {
                ...newProject,
                caseNumber: newProject.case_number,
                isInternal: true,
                projectCategory: category,
                internalStatus: 'in_progress' as const,
                sourceType,
                clientName,
                responsiblePm,
                clientContact,
                expectedCompletionDate: meta.expectedCompletionDate || null,
                subProjects: []
            } 
        };
    } catch (err: any) {
        console.error('建立內部專案失敗:', err);
        return { success: false, message: err?.message || '建立內部專案失敗' };
    }
}

export async function updateInternalProject(projectId: string, data: {
    name: string;
    caseNumber?: string;
    category?: '評估案' | '已開案';
    internalStatus?: 'in_progress' | 'completed' | 'terminated';
    sourceType?: ProjectSourceType;
    clientName?: string;
    responsiblePm?: string;
    clientContact?: string;
    tpmOfficeContact?: string;
    projectPurpose?: string;
    expectedCompletionDate?: string | null;
}) {
    const supabase = getSupabaseClient();
    try {
        const { data: proj, error: fetchErr } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (fetchErr || !proj) throw new Error('找不到專案');

        const meta = parseProjectMeta(proj.on_hold_notes);
        meta.isInternal = true;
        if (data.category) meta.category = data.category;
        if (data.internalStatus) meta.internalStatus = data.internalStatus;
        if (data.expectedCompletionDate !== undefined) meta.expectedCompletionDate = data.expectedCompletionDate;
        if (data.sourceType) meta.sourceType = data.sourceType;
        if (data.clientName) meta.clientName = data.clientName.trim();
        if (data.responsiblePm !== undefined) meta.responsiblePm = data.responsiblePm.trim();
        if (data.clientContact !== undefined) meta.clientContact = data.clientContact.trim();

        const updateData: any = {
            name: data.name.trim(),
            on_hold_notes: serializeProjectMeta(meta),
            updated_at: new Date().toISOString(),
        };

        if (data.caseNumber !== undefined) updateData.case_number = data.caseNumber.trim();
        
        const effectivePm = data.responsiblePm !== undefined ? data.responsiblePm.trim() : (data.tpmOfficeContact !== undefined ? data.tpmOfficeContact.trim() : undefined);
        if (effectivePm !== undefined) updateData.tpm_office_contact = effectivePm;

        if (data.clientContact !== undefined) updateData.yieh_phui_project_manager = data.clientContact.trim();
        if (data.projectPurpose !== undefined) updateData.project_purpose = data.projectPurpose;

        if (data.category === '已開案') {
            updateData.status = 'active';
        } else if (data.category === '評估案') {
            updateData.status = 'evaluation';
        }

        if (data.internalStatus === 'completed') {
            updateData.status = 'completed';
        } else if (data.internalStatus === 'terminated') {
            updateData.status = 'cancelled';
        } else if (data.internalStatus === 'in_progress') {
            updateData.status = meta.category === '評估案' ? 'evaluation' : 'active';
            meta.autoCompletedByClient = false;
            updateData.on_hold_notes = serializeProjectMeta(meta);
        }

        const { error: updateErr } = await supabase
            .from('projects')
            .update(updateData)
            .eq('id', projectId);

        if (updateErr) throw updateErr;

        revalidatePath('/internal-tasks');
        revalidatePath('/dashboard');

        return { 
            success: true, 
            message: '內部專案資料已成功更新！',
            data: {
                id: projectId,
                name: data.name.trim(),
                caseNumber: data.caseNumber?.trim() ?? proj.case_number,
                projectCategory: meta.category,
                internalStatus: meta.internalStatus,
                sourceType: meta.sourceType,
                clientName: meta.clientName,
                responsiblePm: meta.responsiblePm,
                clientContact: meta.clientContact,
                expectedCompletionDate: meta.expectedCompletionDate || null,
                tpmOfficeContact: effectivePm ?? proj.tpm_office_contact,
                projectPurpose: data.projectPurpose ?? proj.project_purpose,
            }
        };
    } catch (err: any) {
        console.error('更新內部專案失敗:', err);
        return { success: false, message: err?.message || '更新內部專案失敗' };
    }
}

// 舊函式相容別名
export const createPocProject = createInternalProject;

export async function updateInternalProjectStatus(projectId: string, payload: {
    category?: '評估案' | '已開案';
    internalStatus?: 'in_progress' | 'completed' | 'terminated';
}) {
    const supabase = getSupabaseClient();
    try {
        const { data: proj, error: fetchErr } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (fetchErr || !proj) throw new Error('找不到專案');

        const meta = parseProjectMeta(proj.on_hold_notes);
        meta.isInternal = true;
        if (payload.category) {
            meta.category = payload.category;
        }
        if (payload.internalStatus) {
            meta.internalStatus = payload.internalStatus;
        }

        const updateData: any = {
            on_hold_notes: serializeProjectMeta(meta),
        };

        if (payload.category === '已開案') {
            updateData.status = 'active';
        } else if (payload.category === '評估案') {
            updateData.status = 'evaluation';
        }

        if (payload.internalStatus === 'completed') {
            updateData.status = 'completed';
        } else if (payload.internalStatus === 'terminated') {
            updateData.status = 'cancelled';
        } else if (payload.internalStatus === 'in_progress') {
            updateData.status = meta.category === '評估案' ? 'evaluation' : 'active';
            meta.autoCompletedByClient = false;
            updateData.on_hold_notes = serializeProjectMeta(meta);
        }

        const { error: updateErr } = await supabase
            .from('projects')
            .update(updateData)
            .eq('id', projectId);

        if (updateErr) throw updateErr;

        revalidatePath('/internal-tasks');
        revalidatePath('/dashboard');

        let msg = '內部專案狀態已更新！';
        if (payload.category === '已開案') msg = '已成功轉為「已開案」！';
        else if (payload.internalStatus === 'completed') msg = '專案已標記為「已結案」！';
        else if (payload.internalStatus === 'terminated') msg = '專案已標記為「專案終止」！';
        else if (payload.internalStatus === 'in_progress') msg = '專案已重新開啟為「進行中」！';

        return { success: true, message: msg };
    } catch (err: any) {
        console.error('更新內部專案狀態失敗:', err);
        return { success: false, message: err?.message || '更新內部專案狀態失敗' };
    }
}

export async function syncInternalProjectCompletion(internalProjectId: string, isCompleted: boolean) {
    if (!internalProjectId) return;
    const supabase = getSupabaseClient();
    try {
        const { data: proj } = await supabase
            .from('projects')
            .select('on_hold_notes')
            .eq('id', internalProjectId)
            .single();
        if (!proj) return;

        const meta = parseProjectMeta(proj.on_hold_notes);
        if (isCompleted) {
            meta.internalStatus = 'completed';
            meta.autoCompletedByClient = true;
            await supabase.from('projects').update({
                status: 'completed',
                on_hold_notes: serializeProjectMeta(meta)
            }).eq('id', internalProjectId);
        } else if (meta.autoCompletedByClient) {
            meta.internalStatus = 'in_progress';
            meta.autoCompletedByClient = false;
            await supabase.from('projects').update({
                status: meta.category === '評估案' ? 'evaluation' : 'active',
                on_hold_notes: serializeProjectMeta(meta)
            }).eq('id', internalProjectId);
        }
        revalidatePath('/internal-tasks');
    } catch (e) {
        console.error('同步內部專案結案失敗:', e);
    }
}

export async function getInternalProjectsForDropdown(): Promise<InternalProjectOption[]> {
    const internalProjects = await getAllProjectsForInternal();
    return internalProjects.map(p => ({
        id: p.id,
        caseNumber: p.caseNumber,
        name: p.name,
        category: p.projectCategory || '已開案',
        internalStatus: p.internalStatus || 'in_progress',
        sourceType: p.sourceType,
        clientName: p.clientName,
        responsiblePm: p.responsiblePm,
        clientContact: p.clientContact,
        expectedCompletionDate: p.expectedCompletionDate || null,
        tpmOfficeContact: p.tpmOfficeContact,
    }));
}

export async function getLinkedInternalProjectDetails(internalProjectId: string): Promise<{
    project: FullProject;
    actionItems: ProjectActionItem[];
} | null> {
    const supabase = getSupabaseClient();
    try {
        const [
            { data: proj, error: projErr },
            items
        ] = await Promise.all([
            supabase.from('projects').select('*').eq('id', internalProjectId).single(),
            getActionItems(internalProjectId)
        ]);

        if (projErr || !proj) return null;

        const meta = parseProjectMeta(proj.on_hold_notes);
        const isEval = meta.category ? meta.category === '評估案' : (proj.status === 'poc' || proj.status === 'evaluation');

        const clientName = meta.clientName?.trim() || '燁輝';
        const sourceType: ProjectSourceType = meta.sourceType || (isEval ? '億威內部自建專案' : '燁輝列管專案');
        const responsiblePm = meta.responsiblePm?.trim() || proj.tpm_office_contact || proj.egiga_contact || '';
        const clientContact = meta.clientContact?.trim() || proj.yieh_phui_project_manager || '';

        const fullProj: FullProject = {
            id: proj.id,
            caseNumber: proj.case_number,
            name: proj.name,
            status: (proj.status || 'active') as any,
            isInternal: true,
            projectCategory: isEval ? '評估案' : '已開案',
            internalStatus: meta.internalStatus || (proj.status === 'completed' ? 'completed' : proj.status === 'terminated' || proj.status === 'cancelled' ? 'terminated' : 'in_progress'),
            sourceType,
            clientName,
            responsiblePm,
            clientContact,
            expectedCompletionDate: meta.expectedCompletionDate || null,
            autoCompletedByClient: !!meta.autoCompletedByClient,
            linkedCustomerProjectId: meta.linkedCustomerProjectId,
            projectPurpose: proj.project_purpose || '',
            currentStatusAndIssues: proj.current_status_and_issues || '',
            yiehPhuiProjectManager: clientContact,
            tpmOfficeContact: responsiblePm,
            egigaContact: proj.egiga_contact || '',
            isOnHold: !!proj.is_on_hold,
            createdAt: formatISO(proj.created_at),
            createdBy: proj.created_by || '',
            subProjects: [],
        };

        return {
            project: fullProj,
            actionItems: items
        };
    } catch (err) {
        console.error('取得關聯內部專案詳情失敗:', err);
        return null;
    }
}
