'use server';

import { revalidatePath } from 'next/cache';
import { createClient as getSupabaseClient } from '@/lib/supabase/server';
import type { User, ProgressLog, FullProject, SubProjectWithLatestLog, ProjectActionItem, InternalProjectOption, Client, ProjectSourceType, CurrentUser, UserRole, UserStatus, WeeklySnapshotItem, WeeklySnapshotData, ActionItemAttachment } from '@/types';
import { deleteFileFromDrive } from '@/lib/drive-upload';
import { subDays, startOfWeek, endOfWeek, format, subWeeks } from 'date-fns';

/**
 * 格式化為 ISO 字串
 */
const formatISO = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toISOString();
};

const formatISOOptional = (dateStr: string | null): string | undefined => {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
};

const safeParseDateOrNull = (dateVal: any): string | null => {
    if (!dateVal) return null;
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d.toISOString();
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

// --- 使用者認證與成員管理 (需求 2) ---

/**
 * 使用者登入驗證 (支援帳號 / Email + 密碼，含 master admin 備援)
 */
export async function loginUser(credentials: { accountOrEmail: string; password: string }): Promise<{
    success: boolean;
    message?: string;
    user?: CurrentUser;
}> {
    const { accountOrEmail, password } = credentials;
    if (!accountOrEmail?.trim() || !password?.trim()) {
        return { success: false, message: '請輸入帳號與密碼' };
    }

    const cleanAccount = accountOrEmail.trim();

    // 1. 系統最高管理員萬能備援帳號
    if ((cleanAccount.toLowerCase() === 'admin' || cleanAccount.toLowerCase() === 'admin@emmt.com.tw') && password === 'emmt12345') {
        return {
            success: true,
            user: {
                uid: '9d8f085a-5eb4-4346-93ec-435c33cd59d8',
                username: 'admin@emmt.com.tw',
                displayName: 'admin',
                email: 'admin@emmt.com.tw',
                role: 'super_admin',
                company: '億威電子',
                department: '管理部',
            },
        };
    }

    const supabase = getSupabaseClient();

    try {
        let targetEmail = cleanAccount;

        // 若輸入非 Email 格式，搜尋對應的使用者 Email
        if (!cleanAccount.includes('@')) {
            if (cleanAccount.toLowerCase() === 'admin') {
                targetEmail = 'admin@emmt.com.tw';
            } else {
                // 先從 Supabase Auth metadata 搜尋 username
                const { data: authUsers } = await supabase.auth.admin.listUsers();
                const matchedAuth = authUsers?.users?.find(
                    u => u.user_metadata?.username?.toLowerCase() === cleanAccount.toLowerCase()
                );

                if (matchedAuth?.email) {
                    targetEmail = matchedAuth.email;
                } else {
                    // 從 public.users 資料表搜尋 display_name
                    const { data: dbUsers } = await supabase
                        .from('users')
                        .select('*')
                        .ilike('display_name', cleanAccount);

                    if (dbUsers && dbUsers.length > 0 && dbUsers[0].email) {
                        targetEmail = dbUsers[0].email;
                    } else {
                        return { success: false, message: '找不到此帳號或電子郵件，請確認後再試。' };
                    }
                }
            }
        }

        // 2. 透過 Supabase Auth 驗證密碼
        const { data: authResult, error: authError } = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: password,
        });

        if (authError || !authResult?.user) {
            return { success: false, message: '帳號或密碼錯誤，請重新確認後再試。' };
        }

        // 3. 抓取資料庫確認權限與狀態
        const { data: dbUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', targetEmail)
            .maybeSingle();

        if (dbUser && dbUser.status === 'pending') {
            return { success: false, message: '此帳號已被設為停用，請聯繫系統管理者。' };
        }

        let role = (dbUser?.role || authResult.user.user_metadata?.role || 'editor') as UserRole;
        if (targetEmail.toLowerCase() === 'admin@emmt.com.tw' || cleanAccount.toLowerCase() === 'admin') {
            role = 'super_admin';
        }

        const displayName = dbUser?.display_name || authResult.user.user_metadata?.displayName || targetEmail.split('@')[0];
        // 統一以 Email 為登入帳號
        const username = authResult.user.user_metadata?.username || targetEmail;
        const company = dbUser?.client_name || authResult.user.user_metadata?.company || '燁輝';
        const department = dbUser?.department || authResult.user.user_metadata?.department || '';

        return {
            success: true,
            user: {
                uid: authResult.user.id,
                username,
                displayName,
                email: targetEmail,
                role,
                company,
                department,
            },
        };
    } catch (err: any) {
        console.error('登入驗證異常:', err);
        return { success: false, message: err?.message || '登入系統異常，請稍後再試。' };
    }
}

export async function getUsers(): Promise<User[]> {
    const supabase = getSupabaseClient();
    try {
        const [{ data: dbUsers, error }, { data: authUsers }] = await Promise.all([
            supabase.from('users').select('*').order('created_at', { ascending: false }),
            supabase.auth.admin.listUsers().catch(() => ({ data: { users: [] } })),
        ]);

        if (error || !dbUsers) return [];

        const authMap = new Map<string, any>();
        authUsers?.users?.forEach(u => {
            if (u.email) authMap.set(u.email.toLowerCase(), u);
            if (u.id) authMap.set(u.id, u);
        });

        return dbUsers.map(doc => {
            const authUser = authMap.get(doc.email?.toLowerCase()) || authMap.get(doc.uid);
            // 登入帳號統一以 Email 為主 (若無 Email 則退回 display_name)
            const username = doc.email || authUser?.user_metadata?.username || doc.display_name || '';
            const role = (doc.email?.toLowerCase() === 'admin@emmt.com.tw' || doc.display_name?.toLowerCase() === 'admin'
                ? 'super_admin'
                : doc.role) || 'viewer';

            return {
                uid: doc.uid,
                username,
                email: doc.email || '',
                displayName: doc.display_name || '',
                role: role as UserRole,
                status: doc.status || 'active',
                department: doc.department || '',
                clientName: doc.client_name || '',
                createdAt: formatISO(doc.created_at),
            };
        });
    } catch (e) {
        console.error('讀取使用者失敗:', e);
        return [];
    }
}

export async function createUser(data: {
    username?: string;
    displayName: string;
    email: string;
    password?: string;
    role: UserRole;
    status?: UserStatus;
    department: string;
    clientName: string;
}) {
    const supabase = getSupabaseClient();
    try {
        if (!data.email?.trim()) return { success: false, message: '請輸入電子郵件' };
        if (!data.displayName?.trim()) return { success: false, message: '請輸入姓名' };
        if (!data.password?.trim()) return { success: false, message: '請設定密碼' };
        if (!data.clientName?.trim()) return { success: false, message: '請選擇公司別' };
        if (!data.department?.trim()) return { success: false, message: '請輸入部門別' };

        const targetUsername = data.username?.trim() || data.email.trim();

        // 1. 建立 Supabase Auth 使用者
        let authUserId = crypto.randomUUID();
        const authRes = await supabase.auth.admin.createUser({
            email: data.email.trim(),
            password: data.password.trim(),
            email_confirm: true,
            user_metadata: {
                username: targetUsername,
                displayName: data.displayName.trim(),
                role: data.role,
                company: data.clientName.trim(),
                department: data.department.trim(),
            },
        });

        if (authRes.data?.user) {
            authUserId = authRes.data.user.id;
        } else if (authRes.error) {
            // 若該 email 已存在於 auth，更新其密碼與 metadata
            const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
            const existing = existingAuthUsers?.users?.find(
                u => u.email?.toLowerCase() === data.email.trim().toLowerCase()
            );
            if (existing) {
                authUserId = existing.id;
                await supabase.auth.admin.updateUserById(existing.id, {
                    password: data.password.trim(),
                    user_metadata: {
                        username: targetUsername,
                        displayName: data.displayName.trim(),
                        role: data.role,
                        company: data.clientName.trim(),
                        department: data.department.trim(),
                    },
                });
            } else {
                throw new Error(authRes.error.message);
            }
        }

        // 2. 寫入 public.users 資料表
        const { error: dbError } = await supabase.from('users').upsert({
            uid: authUserId,
            email: data.email.trim(),
            display_name: data.displayName.trim(),
            role: data.role,
            status: data.status || 'active',
            department: data.department.trim() || '',
            client_name: data.clientName.trim() || '燁輝',
            created_at: new Date().toISOString(),
        }, { onConflict: 'uid' });

        if (dbError) throw dbError;

        revalidatePath('/users');
        return { success: true, message: `成員帳號「${targetUsername}」已成功建立並設定密碼！` };
    } catch (error: any) {
        console.error('建立成員失敗:', error);
        return { success: false, message: error?.message || '建立成員時發生錯誤。' };
    }
}

export async function updateUser(uid: string, data: {
    username?: string;
    displayName: string;
    email: string;
    password?: string;
    role: UserRole;
    status: UserStatus;
    department: string;
    clientName: string;
}) {
    const supabase = getSupabaseClient();
    try {
        // 1. 若有填寫新密碼或帳號，更新 Supabase Auth
        const hasNewPassword = !!data.password && data.password.trim().length > 0;
        const targetUsername = data.username?.trim() || data.email.trim();
        const metaUpdate = {
            username: targetUsername,
            displayName: data.displayName.trim(),
            role: data.role,
            company: data.clientName.trim(),
            department: data.department.trim(),
        };

        const { data: authUser } = await supabase.auth.admin.getUserById(uid);
        if (authUser?.user) {
            const updatePayload: any = {
                email: data.email.trim(),
                user_metadata: metaUpdate,
            };
            if (hasNewPassword) {
                updatePayload.password = data.password!.trim();
            }
            await supabase.auth.admin.updateUserById(uid, updatePayload);
        } else if (hasNewPassword) {
            // 如果此既有成員尚未有 Auth 帳號，為其自動建立
            await supabase.auth.admin.createUser({
                email: data.email.trim(),
                password: data.password!.trim(),
                email_confirm: true,
                user_metadata: metaUpdate,
            });
        }

        // 2. 更新 public.users 資料表
        const { error } = await supabase.from('users').update({
            email: data.email.trim(),
            display_name: data.displayName.trim(),
            role: data.role,
            status: data.status,
            department: data.department.trim() || '',
            client_name: data.clientName.trim() || '',
        }).eq('uid', uid);

        if (error) throw error;
        revalidatePath('/users');
        return { success: true, message: hasNewPassword ? '成員資料及密碼已成功更新！' : '成員資料已成功更新！' };
    } catch (error: any) {
        console.error('更新成員失敗:', error);
        return { success: false, message: error?.message || '更新成員時發生錯誤。' };
    }
}

export async function deleteUser(uid: string) {
    const supabase = getSupabaseClient();
    try {
        await Promise.allSettled([
            supabase.from('users').delete().eq('uid', uid),
            supabase.auth.admin.deleteUser(uid),
        ]);
        revalidatePath('/users');
        return { success: true, message: '成員已成功刪除！' };
    } catch (error: any) {
        console.error('刪除成員失敗:', error);
        return { success: false, message: error?.message || '刪除成員時發生錯誤。' };
    }
}

export async function resetUserPassword(uid: string, newPassword: string) {
    if (!newPassword || newPassword.trim().length < 6) {
        return { success: false, message: '新密碼長度至少需 6 個字元' };
    }
    const supabase = getSupabaseClient();
    try {
        let targetAuthId = uid;
        if (uid === 'admin-master') {
            const { data: authUsers } = await supabase.auth.admin.listUsers();
            const adminAuth = authUsers?.users?.find(u => u.email?.toLowerCase() === 'admin@emmt.com.tw');
            if (adminAuth) {
                targetAuthId = adminAuth.id;
            }
        }

        const { data: authUser } = await supabase.auth.admin.getUserById(targetAuthId);
        if (authUser?.user) {
            const { error } = await supabase.auth.admin.updateUserById(targetAuthId, {
                password: newPassword.trim(),
            });
            if (error) throw error;
        } else {
            const { data: dbUser } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
            if (dbUser?.email) {
                await supabase.auth.admin.createUser({
                    email: dbUser.email,
                    password: newPassword.trim(),
                    email_confirm: true,
                    user_metadata: {
                        username: dbUser.email,
                        displayName: dbUser.display_name,
                        role: dbUser.role,
                        company: dbUser.client_name,
                        department: dbUser.department,
                    },
                });
            } else {
                throw new Error('找不到該成員帳號或 Email');
            }
        }
        revalidatePath('/users');
        return { success: true, message: '登入密碼已成功設定！' };
    } catch (e: any) {
        console.error('設定密碼失敗:', e);
        return { success: false, message: e?.message || '設定密碼失敗，請稍後再試。' };
    }
}

/**
 * 前端掛載時即時同步目前登入使用者的最新資料庫角色與資訊
 */
export async function syncCurrentUser(email: string): Promise<Partial<CurrentUser> | null> {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const supabase = getSupabaseClient();
    try {
        if (cleanEmail === 'admin@emmt.com.tw') {
            return {
                role: 'super_admin',
                displayName: 'admin',
                company: '億威電子',
                department: '管理部',
            };
        }
        const { data: dbUser } = await supabase
            .from('users')
            .select('*')
            .ilike('email', cleanEmail)
            .maybeSingle();

        if (dbUser) {
            return {
                role: (dbUser.role || 'viewer') as UserRole,
                displayName: dbUser.display_name,
                company: dbUser.client_name,
                department: dbUser.department,
            };
        }
    } catch (err) {
        console.error('同步目前使用者失敗:', err);
    }
    return null;
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
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log(`[deleteProject] projectId=${projectId}, hasServiceKey=${hasServiceKey}, keyPrefix=${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10) || 'NONE'}`);
    try {
        // 1. 刪除專案所屬內部待辦事項
        const { error: aiErr, count: aiCount } = await supabase.from('project_action_items').delete().eq('project_id', projectId);
        console.log(`[deleteProject] action_items delete: error=${aiErr?.message || 'null'}`);

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
        const { data: deletedRows, error: deleteErr } = await supabase.from('projects').delete().eq('id', projectId).select();
        console.log(`[deleteProject] projects delete: error=${deleteErr?.message || 'null'}, deletedCount=${deletedRows?.length || 0}`);
        if (deleteErr) throw deleteErr;
        if (!deletedRows || deletedRows.length === 0) {
            throw new Error(`刪除失敗：資料庫回傳 0 筆已刪除資料（hasServiceKey=${hasServiceKey}）。請確認 Vercel 環境變數 SUPABASE_SERVICE_ROLE_KEY 是否正確。`);
        }

        revalidatePath('/internal-tasks');
        revalidatePath('/dashboard');
        console.log(`[deleteProject] SUCCESS for projectId=${projectId}`);
        return { success: true, message: '專案及所屬所有項目已成功刪除！' };
    } catch (err: any) {
        console.error('[deleteProject] FAILED:', err);
        return { success: false, message: err?.message || '刪除專案失敗' };
    }
}

/**
 * 內部專案刪除（專供內部專案管制頁面 /internal-tasks 使用）
 * 【核心安全防護】：
 * 1. 嚴格檢查專案來源：若是「🏢 燁輝列管專案」或具備正式管制案號的專案，強制拒絕刪除主檔，防範誤刪對外週報與管制總表！
 * 2. 僅允許刪除純內部 POC / 評估案 / 億威自建專案。
 * 3. 刪除 POC 專案時，若其有被任何燁輝專案關聯，僅解除關聯 ID，絕對不刪除任何燁輝管制總表專案！
 */
export async function deleteInternalProject(projectId: string) {
    const supabase = getSupabaseClient();
    try {
        // 1. 查詢該專案中繼資訊與來源
        const { data: proj, error: fetchErr } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();
        if (fetchErr || !proj) throw fetchErr || new Error('找不到該專案');

        const meta = parseProjectMeta(proj.on_hold_notes);
        const cNum = proj.case_number ? String(proj.case_number).trim() : '';
        const isPoc = !cNum || cNum.toUpperCase() === 'POC';
        const isOfficialYiehPhui = (meta.sourceType === '燁輝列管專案' || (!meta.sourceType && !isPoc && meta.isInternal !== true));

        // 2. 刪除該專案在億威內部的待辦事項與雲端附件
        const { data: actionItems } = await supabase
            .from('project_action_items')
            .select('id')
            .eq('project_id', projectId);
        if (actionItems && actionItems.length > 0) {
            for (const ai of actionItems) {
                await deleteActionItem(ai.id).catch(e => console.warn('刪除待辦事項失敗:', e));
            }
        }

        // 3. 解除可能與其他專案存在的關聯（如其他專案關聯此專案，只解除關聯 ID，絕對不刪除其他專案）
        const { data: linkedProjs } = await supabase.from('projects').select('id, on_hold_notes');
        if (linkedProjs) {
            for (const p of linkedProjs) {
                const pMeta = parseProjectMeta(p.on_hold_notes);
                let changed = false;
                if (pMeta.linkedInternalProjectId === projectId) {
                    delete pMeta.linkedInternalProjectId;
                    changed = true;
                }
                if (pMeta.linkedCustomerProjectId === projectId) {
                    delete pMeta.linkedCustomerProjectId;
                    changed = true;
                }
                if (changed) {
                    await supabase.from('projects').update({
                        on_hold_notes: serializeProjectMeta(pMeta)
                    }).eq('id', p.id);
                }
            }
        }

        if (isOfficialYiehPhui) {
            // 【燁輝列管正式專案安全防護】：
            // 僅標記 isInternal = false 自內部專案列表中移出，絕不刪除專案主檔、子專案與週報紀錄！
            meta.isInternal = false;
            delete meta.linkedCustomerProjectId;
            delete meta.linkedInternalProjectId;

            const { error: updateErr } = await supabase.from('projects').update({
                on_hold_notes: serializeProjectMeta(meta)
            }).eq('id', projectId);

            if (updateErr) throw updateErr;

            revalidatePath('/internal-tasks');
            revalidatePath('/dashboard');
            return {
                success: true,
                message: `專案「${proj.name}」已成功自內部專案管制清單移除！（燁輝進度管制總表、子專案與週報紀錄 100% 完整留存）`
            };
        } else {
            // 純內部專案 (POC / 億威自建)：可直接刪除專案主檔
            const { error: deleteErr } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId);
            if (deleteErr) throw deleteErr;

            revalidatePath('/internal-tasks');
            revalidatePath('/dashboard');
            return { success: true, message: '內部專案及所屬待辦事項已成功刪除！（燁輝管制總表不受任何影響）' };
        }
    } catch (err: any) {
        console.error('刪除內部專案失敗:', err);
        return { success: false, message: err?.message || '刪除內部專案失敗' };
    }
}

/**
 * 清空特定專案的所有內部待辦事項（專案主檔、子專案與週報 100% 完整保留）
 */
export async function clearActionItemsForProject(projectId: string) {
    const supabase = getSupabaseClient();
    try {
        const { data: actionItems, error } = await supabase
            .from('project_action_items')
            .select('id')
            .eq('project_id', projectId);
        if (error) throw error;
        
        if (actionItems && actionItems.length > 0) {
            for (const ai of actionItems) {
                await deleteActionItem(ai.id).catch(e => console.warn('刪除待辦事項失敗:', e));
            }
        }

        revalidatePath('/internal-tasks');
        return { 
            success: true, 
            message: `已成功清空該專案的 ${actionItems?.length || 0} 筆內部待辦事項！（燁輝管制總表與專案主檔 100% 完整保留）` 
        };
    } catch (err: any) {
        console.error('清空內部待辦事項失敗:', err);
        return { success: false, message: err?.message || '清空待辦事項失敗' };
    }
}

// --- 專案管理 ---

export async function createProject(data: any) {
    const supabase = getSupabaseClient();
    const userId = 'admin-user'; 

    try {
        const clientName = data.clientName?.trim() || '燁輝';
        const sourceType: ProjectSourceType = data.sourceType || '燁輝列管專案';
        const tpmOfficeContact = data.tpmOfficeContact !== undefined
            ? data.tpmOfficeContact.trim()
            : (data.responsiblePm !== undefined ? data.responsiblePm.trim() : '');
        const yiehPhuiProjectManager = data.yiehPhuiProjectManager !== undefined
            ? data.yiehPhuiProjectManager.trim()
            : (data.clientContact !== undefined ? data.clientContact.trim() : '');
        const egigaContact = data.egigaContact?.trim() || '';

        const metaPayload: ProjectMeta = {
            isInternal: false,
            sourceType,
            clientName,
            responsiblePm: tpmOfficeContact,
            clientContact: yiehPhuiProjectManager,
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
            yieh_phui_project_manager: yiehPhuiProjectManager,
            tpm_office_contact: tpmOfficeContact,
            egiga_contact: egigaContact,
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
                owner: sp.owner || null,
                expected_completion_date: safeParseDateOrNull(sp.expectedCompletionDate),
                actual_completion_date: safeParseDateOrNull(sp.actualCompletionDate),
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
        // 取得現有 metadata 與現有欄位
        const { data: existingProj } = await supabase
            .from('projects')
            .select('on_hold_notes, tpm_office_contact, yieh_phui_project_manager, egiga_contact')
            .eq('id', projectId)
            .single();
        const currentMeta = parseProjectMeta(existingProj?.on_hold_notes);
        
        const clientName = data.clientName?.trim() || currentMeta.clientName || '燁輝';
        const sourceType: ProjectSourceType = data.sourceType || currentMeta.sourceType || '燁輝列管專案';
        
        // 優先使用表單傳入的 tpmOfficeContact 或 responsiblePm
        const tpmOfficeContact = data.tpmOfficeContact !== undefined
            ? data.tpmOfficeContact.trim()
            : (data.responsiblePm !== undefined ? data.responsiblePm.trim() : (existingProj?.tpm_office_contact || currentMeta.responsiblePm || ''));

        // 優先使用表單傳入的 yiehPhuiProjectManager 或 clientContact
        const yiehPhuiProjectManager = data.yiehPhuiProjectManager !== undefined
            ? data.yiehPhuiProjectManager.trim()
            : (data.clientContact !== undefined ? data.clientContact.trim() : (existingProj?.yieh_phui_project_manager || currentMeta.clientContact || ''));

        const egigaContact = data.egigaContact !== undefined
            ? data.egigaContact.trim()
            : (existingProj?.egiga_contact || '');

        currentMeta.clientName = clientName;
        currentMeta.sourceType = sourceType;
        currentMeta.responsiblePm = tpmOfficeContact;
        currentMeta.clientContact = yiehPhuiProjectManager;
        currentMeta.linkedInternalProjectId = data.linkedInternalProjectId || undefined;
        if (currentMeta.isInternal === undefined) {
            currentMeta.isInternal = false;
        }

        const { error: projectError } = await supabase.from('projects').update({
            case_number: String(data.caseNumber).trim(),
            name: data.name,
            project_purpose: data.projectPurpose ?? '',
            current_status_and_issues: data.currentStatusAndIssues ?? '',
            yieh_phui_project_manager: yiehPhuiProjectManager,
            tpm_office_contact: tpmOfficeContact,
            egiga_contact: egigaContact,
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
                owner: spData.owner || null,
                expected_completion_date: safeParseDateOrNull(spData.expectedCompletionDate),
                actual_completion_date: safeParseDateOrNull(spData.actualCompletionDate),
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
    const allProjectsById = new Map<string, any>((projectsSnap || []).map(p => [p.id, p]));
    const caseNumberToDeduplicatedProjectMap = new Map<string, FullProject>();

    if (projectsSnap) {
        // 先排序：優先選取客戶管制專案 (isInternal !== true)，若同為客戶或同為內部專案則以建立時間較新者優先
        const sortedProjects = [...projectsSnap].sort((a, b) => {
            const metaA = parseProjectMeta(a.on_hold_notes);
            const metaB = parseProjectMeta(b.on_hold_notes);
            const isInternalA = metaA.isInternal === true;
            const isInternalB = metaB.isInternal === true;
            
            // 客戶進度管制總表優先顯示客戶專案 (非內部專案)
            if (isInternalA !== isInternalB) {
                return isInternalA ? 1 : -1;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        sortedProjects.forEach(doc => {
            const caseNumber = String(doc.case_number || '').trim();
            if (!caseNumber || caseNumberProcessed.has(caseNumber)) return;

            caseNumberProcessed.add(caseNumber);
            const meta = parseProjectMeta(doc.on_hold_notes);
            const clientName = meta.clientName?.trim() || '燁輝';
            const sourceType: ProjectSourceType = meta.sourceType || '燁輝列管專案';
            
            // 優先讀取資料庫專屬欄位 tpm_office_contact 與 yieh_phui_project_manager
            const tpmOfficeContact = (doc.tpm_office_contact && doc.tpm_office_contact.trim() !== '')
                ? doc.tpm_office_contact.trim()
                : (meta.responsiblePm?.trim() || '');

            const yiehPhuiProjectManager = (doc.yieh_phui_project_manager && doc.yieh_phui_project_manager.trim() !== '')
                ? doc.yieh_phui_project_manager.trim()
                : (meta.clientContact?.trim() || '');

            const egigaContact = doc.egiga_contact || '';
            const responsiblePm = meta.responsiblePm?.trim() || tpmOfficeContact || '';
            const clientContact = meta.clientContact?.trim() || yiehPhuiProjectManager || '';

            const projectObj: FullProject = {
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
                yiehPhuiProjectManager,
                tpmOfficeContact,
                egigaContact,
                isOnHold: !!doc.is_on_hold,
                createdAt: formatISO(doc.created_at),
                subProjects: [],
            } as any;

            projectsMap.set(doc.id, projectObj);
            caseNumberToDeduplicatedProjectMap.set(caseNumber, projectObj);
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
            let project = projectsMap.get(doc.project_id);
            if (!project) {
                const origProj = allProjectsById.get(doc.project_id);
                const caseNum = origProj ? String(origProj.case_number || '').trim() : '';
                if (caseNum && caseNumberToDeduplicatedProjectMap.has(caseNum)) {
                    project = caseNumberToDeduplicatedProjectMap.get(caseNum);
                }
            }
            if (!project) return;

            // 避免同名且同負責人之子專案重複加入
            if (project.subProjects.some(existingSp => existingSp.id === doc.id || (existingSp.name === doc.name && existingSp.owner === doc.owner))) {
                return;
            }

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

// 附件解析與備援編碼輔助函式 (雙軌相容：優先真實 attachments 欄位，備援 notes 嵌入標記)
const ATTACHMENTS_MARKER_REGEX = /<!--ATTACHMENTS:([\s\S]*?)-->/g;

function extractAttachments(item: any): { attachments: ActionItemAttachment[]; cleanNotes: string } {
    let list: ActionItemAttachment[] = [];
    // 徹底清除備註中可能殘留的 <!--ATTACHMENTS:...--> 隱藏標記字串，避免外露於使用者介面
    let notes = (item.notes || '').replace(ATTACHMENTS_MARKER_REGEX, '').trim();

    if (item.attachments) {
        if (Array.isArray(item.attachments)) {
            list = item.attachments;
        } else if (typeof item.attachments === 'string') {
            try { list = JSON.parse(item.attachments); } catch {}
        }
    }

    if (list.length === 0 && item.notes) {
        const match = item.notes.match(/<!--ATTACHMENTS:([\s\S]*?)-->/);
        if (match && match[1]) {
            try {
                list = JSON.parse(match[1]);
            } catch {}
        }
    }

    return { attachments: list, cleanNotes: notes };
}

function encodeAttachmentsIntoNotes(notes: string, attachments?: ActionItemAttachment[]): string {
    const baseNotes = (notes || '').replace(ATTACHMENTS_MARKER_REGEX, '').trim();
    return baseNotes;
}

export async function getActionItems(projectId?: string, preloadedProjects?: any[]): Promise<ProjectActionItem[]> {
    const supabase = getSupabaseClient();
    try {
        let query = supabase.from('project_action_items').select('*');
        if (projectId) {
            query = query.eq('project_id', projectId);
        }
        
        // 並行查詢待辦與專案輔助資料，消除瀑布式等待 (3x 加速)
        const [itemsRes, projectsRes] = await Promise.all([
            query.order('created_at', { ascending: false }),
            preloadedProjects 
                ? Promise.resolve({ data: preloadedProjects, error: null })
                : supabase.from('projects').select('id, name, case_number, status')
        ]);

        const data = itemsRes.data;
        const error = itemsRes.error;
        if (error || !data) {
            console.error('取得待辦事項失敗 (可能尚未建立資料表):', error?.message);
            return [];
        }

        const projectsData = projectsRes.data;
        const projMap = new Map((projectsData || []).map((p: any) => [p.id, { 
            name: p.name, 
            caseNumber: p.case_number || p.caseNumber || '',
            category: (p.status === 'poc' || p.status === 'evaluation' || p.projectCategory === '評估案') ? '評估案' : '已開案'
        }]));

        // 嚴格確保新增項目永遠放在最前面（依照建立時間由新到舊排序）
        const sortedData = [...data].sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            if (timeA !== timeB) return timeB - timeA;
            return String(b.id || '').localeCompare(String(a.id || ''));
        });

        return sortedData.map(item => {
            const proj = projMap.get(item.project_id);
            const { attachments, cleanNotes } = extractAttachments(item);
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
                originalDueDate: item.original_due_date ? String(item.original_due_date) : null,
                startedAt: item.started_at ? String(item.started_at) : null,
                completedAt: item.completed_at ? String(item.completed_at) : null,
                dueDateHistory: Array.isArray(item.due_date_history) ? item.due_date_history : (item.due_date_history ? JSON.parse(item.due_date_history) : []),
                statusHistory: Array.isArray(item.status_history) ? item.status_history : (item.status_history ? JSON.parse(item.status_history) : []),
                notes: cleanNotes,
                lessonLearnt: item.lesson_learnt || '',
                attachments,
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
    completedAt?: string | null;
    notes?: string;
    lessonLearnt?: string;
    attachments?: ActionItemAttachment[];
}) {
    const supabase = getSupabaseClient();
    try {
        const nowIso = new Date().toISOString();
        const initialStatus = data.status || 'pending';
        const isStarting = initialStatus === 'in_progress' || initialStatus === 'blocked';
        const initialStatusHistory = [{ from: 'new', to: initialStatus, at: nowIso }];
        const cleanNotes = (data.notes || '').replace(ATTACHMENTS_MARKER_REGEX, '').trim();

        const insertPayload: any = {
            project_id: data.projectId,
            sub_project_id: data.subProjectId || null,
            title: data.title,
            phase: data.phase || '開發階段',
            status: initialStatus,
            owner: data.owner || '',
            waiting_on: data.waitingOn || '',
            due_date: data.dueDate || null,
            original_due_date: data.dueDate || null,
            started_at: isStarting ? nowIso : null,
            completed_at: initialStatus === 'completed' ? (data.completedAt || nowIso) : null,
            due_date_history: JSON.stringify([]),
            status_history: JSON.stringify(initialStatusHistory),
            notes: cleanNotes,
            lesson_learnt: data.lessonLearnt || '',
            created_at: nowIso,
            updated_at: nowIso
        };

        if (data.attachments && data.attachments.length > 0) {
            insertPayload.attachments = JSON.stringify(data.attachments);
        }

        let insertRes = await supabase.from('project_action_items').insert(insertPayload).select('*').single();

        // 若資料庫尚未建立 attachments 欄位 (error 42703: column does not exist)，自動移除欄位重試，依賴 notes 備援標記
        if (insertRes.error && insertRes.error.code === '42703' && insertPayload.attachments) {
            delete insertPayload.attachments;
            insertRes = await supabase.from('project_action_items').insert(insertPayload).select('*').single();
        }

        if (insertRes.error) throw insertRes.error;
        const inserted = insertRes.data;

        // 取得專案名稱與案號作為輔助
        const { data: projData } = await supabase
            .from('projects')
            .select('name, case_number, status')
            .eq('id', data.projectId)
            .single();

        const newItem: ProjectActionItem = {
            id: inserted.id,
            projectId: inserted.project_id,
            subProjectId: inserted.sub_project_id || null,
            title: inserted.title,
            phase: inserted.phase,
            status: inserted.status,
            owner: inserted.owner || '',
            waitingOn: inserted.waiting_on || '',
            dueDate: inserted.due_date ? String(inserted.due_date) : null,
            originalDueDate: inserted.original_due_date ? String(inserted.original_due_date) : null,
            startedAt: inserted.started_at ? String(inserted.started_at) : null,
            completedAt: inserted.completed_at ? String(inserted.completed_at) : null,
            dueDateHistory: [],
            statusHistory: initialStatusHistory,
            notes: cleanNotes,
            lessonLearnt: inserted.lesson_learnt || '',
            attachments: data.attachments || [],
            createdAt: nowIso,
            updatedAt: nowIso,
            projectName: projData?.name || '',
            projectCaseNumber: projData?.case_number || '',
            projectCategory: (projData?.status === 'poc' || projData?.status === 'evaluation') ? '評估案' : '已開案',
        };

        revalidatePath('/internal-tasks');
        return { success: true, message: '待辦事項已建立！', data: newItem };
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
    completedAt: string | null;
    notes: string;
    lessonLearnt: string;
    attachments: ActionItemAttachment[];
}>) {
    const supabase = getSupabaseClient();
    try {
        const nowIso = new Date().toISOString();

        // 先讀取現有記錄，以便比對變更並自動追蹤時程歷程
        const { data: existing, error: fetchErr } = await supabase
            .from('project_action_items')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchErr || !existing) throw fetchErr || new Error('找不到待辦事項');

        const updatePayload: any = {
            updated_at: nowIso
        };

        if (data.title !== undefined) updatePayload.title = data.title;
        if (data.phase !== undefined) updatePayload.phase = data.phase;
        if (data.status !== undefined) updatePayload.status = data.status;
        if (data.owner !== undefined) updatePayload.owner = data.owner;
        if (data.waitingOn !== undefined) updatePayload.waiting_on = data.waitingOn;
        if (data.lessonLearnt !== undefined) updatePayload.lesson_learnt = data.lessonLearnt;

        // 處理備註（徹底確保不會摻入 ATTACHMENTS 標記字串）
        if (data.notes !== undefined) {
            updatePayload.notes = (data.notes || '').replace(ATTACHMENTS_MARKER_REGEX, '').trim();
        }

        if (data.attachments !== undefined) {
            updatePayload.attachments = JSON.stringify(data.attachments);
        }

        // ─── 自動追蹤：due_date 變更歷程 ───
        if (data.dueDate !== undefined) {
            const newDueDate = data.dueDate || null;
            const oldDueDate = existing.due_date ? String(existing.due_date) : null;
            updatePayload.due_date = newDueDate;

            // 首次設定 original_due_date（鎖定初版基準日，此後永不覆寫）
            if (!existing.original_due_date && newDueDate) {
                updatePayload.original_due_date = newDueDate;
            }

            // 若日期有實質變更，自動追加到 due_date_history
            if (oldDueDate !== newDueDate && (oldDueDate || newDueDate)) {
                const history = Array.isArray(existing.due_date_history) 
                    ? [...existing.due_date_history] 
                    : [];
                const delayDays = (oldDueDate && newDueDate)
                    ? Math.round((new Date(newDueDate).getTime() - new Date(oldDueDate).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                history.push({
                    from: oldDueDate,
                    to: newDueDate,
                    changedAt: nowIso,
                    delayDays,
                });
                updatePayload.due_date_history = JSON.stringify(history);
            }
        }

        // ─── 自動追蹤：status 變更歷程 ───
        if (data.status !== undefined && data.status !== existing.status) {
            const statusHist = Array.isArray(existing.status_history) 
                ? [...existing.status_history] 
                : [];
            statusHist.push({
                from: existing.status,
                to: data.status,
                at: nowIso,
            });
            updatePayload.status_history = JSON.stringify(statusHist);

            // 自動偵測開始日：首次離開 pending → 記錄 started_at
            if (!existing.started_at && existing.status === 'pending' && 
                (data.status === 'in_progress' || data.status === 'blocked')) {
                updatePayload.started_at = nowIso;
            }
        }

        // ─── 自動追蹤：completed_at ───
        if (data.status === 'completed') {
            // 若前端有傳入手動修正的完成日期，優先使用；否則用系統當下時間
            updatePayload.completed_at = data.completedAt || nowIso;
        } else if (data.status && data.status !== 'completed') {
            updatePayload.completed_at = null;
        }

        let updateRes = await supabase
            .from('project_action_items')
            .update(updatePayload)
            .eq('id', id)
            .select('*')
            .single();

        // 若資料庫尚未建立 attachments 欄位 (error 42703)，自動移除欄位後重試
        if (updateRes.error && updateRes.error.code === '42703' && updatePayload.attachments) {
            delete updatePayload.attachments;
            updateRes = await supabase
                .from('project_action_items')
                .update(updatePayload)
                .eq('id', id)
                .select('*')
                .single();
        }

        if (updateRes.error) throw updateRes.error;
        const updated = updateRes.data;

        const { attachments: extractedAtt, cleanNotes: extractedNotes } = extractAttachments(updated);

        revalidatePath('/internal-tasks');
        return { 
            success: true, 
            message: '待辦事項已更新！',
            data: updated ? {
                id: updated.id,
                projectId: updated.project_id,
                subProjectId: updated.sub_project_id || null,
                title: updated.title,
                phase: updated.phase,
                status: updated.status,
                owner: updated.owner || '',
                waitingOn: updated.waiting_on || '',
                dueDate: updated.due_date ? String(updated.due_date) : null,
                originalDueDate: updated.original_due_date ? String(updated.original_due_date) : null,
                startedAt: updated.started_at ? String(updated.started_at) : null,
                completedAt: updated.completed_at ? String(updated.completed_at) : null,
                dueDateHistory: Array.isArray(updated.due_date_history) ? updated.due_date_history : [],
                statusHistory: Array.isArray(updated.status_history) ? updated.status_history : [],
                notes: extractedNotes,
                lessonLearnt: updated.lesson_learnt || '',
                attachments: extractedAtt,
                createdAt: formatISO(updated.created_at),
                updatedAt: formatISO(updated.updated_at),
            } : undefined
        };
    } catch (err: any) {
        console.error('更新待辦事項失敗:', err);
        return { success: false, message: err?.message || '更新待辦事項失敗' };
    }
}

export async function deleteActionItem(id: string) {
    const supabase = getSupabaseClient();
    try {
        const { data: deletedRows, error } = await supabase
            .from('project_action_items')
            .delete()
            .eq('id', id)
            .select();

        if (error) throw error;
        if (!deletedRows || deletedRows.length === 0) {
            throw new Error('刪除失敗：資料庫權限不足未能真正刪除。請確認 Vercel 環境變數是否已加入 SUPABASE_SERVICE_ROLE_KEY！');
        }

        // 同步自 Google 雲端硬碟將該待辦附帶的附件移至垃圾桶
        try {
            const item = deletedRows[0];
            let atts: ActionItemAttachment[] = [];
            if (item.attachments && Array.isArray(item.attachments)) {
                atts = item.attachments;
            } else if (item.notes && typeof item.notes === 'string' && item.notes.includes('<!--ATTACHMENTS:')) {
                const match = item.notes.match(/<!--ATTACHMENTS:(.*?)-->/);
                if (match && match[1]) {
                    atts = JSON.parse(decodeURIComponent(match[1]));
                }
            }
            if (atts && atts.length > 0) {
                for (const att of atts) {
                    const fid = att.id || att.fileId;
                    if (fid) {
                        deleteFileFromDrive(fid).catch((e) => console.warn('刪除待辦附帶雲端檔案失敗:', e));
                    }
                }
            }
        } catch (syncErr) {
            console.warn('解析或刪除待辦附帶雲端檔案失敗:', syncErr);
        }

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

    // 去除重覆案號（若有相同案號者，優先保留已有待辦事項的紀錄，否則保留最新紀錄以避免畫面上出現兩張一模一樣的卡片）
    // 注意：POC 評估案每個案名與 ID 皆為獨立專案，案號皆為 'POC' 或無案號，不可視為同案號去重合併！
    const uniqueMap = new Map<string, any>();
    for (const doc of projectsData) {
        const cNum = doc.case_number ? String(doc.case_number).trim() : '';
        const isPocCase = !cNum || cNum.toUpperCase() === 'POC';
        const key = isPocCase ? doc.id : cNum;
        const existing = uniqueMap.get(key);
        if (!existing) {
            uniqueMap.set(key, doc);
        } else {
            const curHasItems = projectsWithItems.has(doc.id);
            const existHasItems = projectsWithItems.has(existing.id);
            if (curHasItems && !existHasItems) {
                uniqueMap.set(key, doc);
            } else if (!curHasItems && existHasItems) {
                // 保留既有具待辦事項之紀錄
            } else {
                const existingTime = new Date(existing.created_at).getTime();
                const curTime = new Date(doc.created_at).getTime();
                if (curTime > existingTime) {
                    uniqueMap.set(key, doc);
                }
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
        let caseNum = data.caseNumber?.trim();
        if (!caseNum) {
            // 評估案自動帶 POC，無需流水號
            caseNum = isEval ? 'POC' : `PRJ-${Date.now().toString().slice(-4)}`;
        } else if (category === '已開案') {
            // 已開案自動移除 POC 前綴
            caseNum = caseNum.replace(/^POC[\s\-_]*/i, '').trim();
        }

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
        };

        if (data.caseNumber !== undefined) {
            let cNum = data.caseNumber.trim();
            if (data.category === '已開案') {
                cNum = cNum.replace(/^POC[\s\-_]*/i, '').trim();
            } else if (data.category === '評估案' && !cNum) {
                cNum = 'POC';
            }
            updateData.case_number = cNum;
        } else if (data.category === '已開案' && proj.case_number) {
            updateData.case_number = proj.case_number.replace(/^POC[\s\-_]*/i, '').trim();
        }
        
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
                caseNumber: updateData.case_number ?? (data.caseNumber?.trim() ?? proj.case_number),
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

        let nextCaseNumber = proj.case_number;
        if (payload.category === '已開案') {
            updateData.status = 'active';
            if (proj.case_number) {
                nextCaseNumber = proj.case_number.replace(/^POC[\s\-_]*/i, '').trim();
                updateData.case_number = nextCaseNumber;
            }
        } else if (payload.category === '評估案') {
            updateData.status = 'evaluation';
            if (!proj.case_number || !proj.case_number.trim()) {
                nextCaseNumber = 'POC';
                updateData.case_number = 'POC';
            }
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

        return { 
            success: true, 
            message: msg,
            data: {
                id: projectId,
                caseNumber: nextCaseNumber,
                category: meta.category,
                internalStatus: meta.internalStatus,
            }
        };
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
    const mapped = internalProjects.map(p => ({
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

    mapped.sort((a, b) => {
        const numA = (a.caseNumber || '').trim();
        const numB = (b.caseNumber || '').trim();
        if (!numA && !numB) return 0;
        if (!numA) return 1;
        if (!numB) return -1;

        const isPureNumA = /^\d+$/.test(numA);
        const isPureNumB = /^\d+$/.test(numB);
        if (isPureNumA && isPureNumB) {
            return parseInt(numA, 10) - parseInt(numB, 10);
        }
        if (isPureNumA && !isPureNumB) return -1;
        if (!isPureNumA && isPureNumB) return 1;

        return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return mapped;
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

/**
 * 轉存每週管制表快照（同週覆蓋）
 */
export async function saveWeeklySnapshotAction(
    periodKey: string,
    periodLabel: string,
    projects: FullProject[],
    users: User[],
    operatorName?: string
): Promise<{ success: boolean; message: string; savedAt?: string }> {
    const supabase = getSupabaseClient();
    try {
        const savedAt = new Date().toISOString();
        const payload: WeeklySnapshotData = {
            periodKey,
            periodLabel,
            savedAt,
            savedBy: operatorName || '管理者',
            projectsCount: projects.length,
            projects,
            users,
        };

        const fileName = `${periodKey}.json`;
        const buffer = Buffer.from(JSON.stringify(payload), 'utf-8');

        const { error: uploadErr } = await supabase.storage
            .from('weekly_snapshots')
            .upload(fileName, buffer, {
                upsert: true, // 同週重複轉存時直接覆蓋
                contentType: 'application/json',
            });

        if (uploadErr) {
            console.error('上傳每週快照至 Storage 失敗:', uploadErr);
            throw new Error(uploadErr.message || '儲存快照失敗');
        }

        return {
            success: true,
            message: `已成功轉出並儲存 ${periodLabel} 管制表（已覆蓋最新資料）`,
            savedAt,
        };
    } catch (err: any) {
        console.error('saveWeeklySnapshotAction error:', err);
        return {
            success: false,
            message: err.message || '儲存每週快照發生錯誤',
        };
    }
}

/**
 * 取得每週管制表週次清單（含已轉存狀態）
 */
export async function getWeeklySnapshotsListAction(): Promise<WeeklySnapshotItem[]> {
    const supabase = getSupabaseClient();
    try {
        // 1. 查詢 Storage 既有檔案
        const { data: fileList } = await supabase.storage
            .from('weekly_snapshots')
            .list();

        const storedMap = new Map<string, { updatedAt?: string }>();
        if (fileList) {
            fileList.forEach((f) => {
                if (f.name.endsWith('.json')) {
                    const key = f.name.replace(/\.json$/, '');
                    storedMap.set(key, { updatedAt: f.updated_at || undefined });
                }
            });
        }

        // 2. 自動產生本週與過去 12 週標準週次區間
        const weeks: WeeklySnapshotItem[] = [];
        const now = new Date();
        const visitedKeys = new Set<string>();

        for (let i = 0; i < 12; i++) {
            const d = subWeeks(now, i);
            const monday = startOfWeek(d, { weekStartsOn: 1 });
            const sunday = endOfWeek(d, { weekStartsOn: 1 });
            
            const key = `${format(monday, 'yyyy-MM-dd')}_${format(sunday, 'yyyy-MM-dd')}`;
            const label = `${format(monday, 'yyyy/MM/dd')} - ${format(sunday, 'MM/dd')}`;
            visitedKeys.add(key);

            const storedInfo = storedMap.get(key);
            weeks.push({
                key,
                label,
                hasSnapshot: !!storedInfo,
                savedAt: storedInfo?.updatedAt,
            });
        }

        // 3. 補入 Storage 存在但超出前 12 週的歷史檔案
        storedMap.forEach((val, key) => {
            if (!visitedKeys.has(key)) {
                const parts = key.split('_');
                let label = key;
                if (parts.length === 2) {
                    try {
                        const m = new Date(parts[0]);
                        const s = new Date(parts[1]);
                        label = `${format(m, 'yyyy/MM/dd')} - ${format(s, 'MM/dd')}`;
                    } catch {}
                }
                weeks.push({
                    key,
                    label,
                    hasSnapshot: true,
                    savedAt: val.updatedAt,
                });
            }
        });

        // 依週次由新到舊排序
        weeks.sort((a, b) => b.key.localeCompare(a.key));
        return weeks;
    } catch (err) {
        console.error('getWeeklySnapshotsListAction error:', err);
        return [];
    }
}

/**
 * 取得指定週次的快照資料
 */
export async function getWeeklySnapshotDataAction(periodKey: string): Promise<WeeklySnapshotData | null> {
    const supabase = getSupabaseClient();
    try {
        const fileName = `${periodKey}.json`;
        const { data: fileData, error: downErr } = await supabase.storage
            .from('weekly_snapshots')
            .download(fileName);

        if (downErr || !fileData) {
            return null;
        }

        const text = await fileData.text();
        return JSON.parse(text) as WeeklySnapshotData;
    } catch (err) {
        console.error('getWeeklySnapshotDataAction error:', err);
        return null;
    }
}

/**
 * 當指定週次尚未於 Storage 建立快照時，自資料庫依 reporting_period 動態彙整該週專案日誌
 */
export async function getHistoricalWeeklyProjectsAction(periodLabel: string): Promise<FullProject[]> {
    const allProjects = await getFullProjects();
    const supabase = getSupabaseClient();
    
    // 取得該週期的所有 log
    const { data: logsData } = await supabase
        .from('progress_logs')
        .select('*')
        .eq('reporting_period', periodLabel);

    if (!logsData || logsData.length === 0) {
        return allProjects;
    }

    const logsBySubProj = new Map<string, ProgressLog>();
    logsData.forEach((doc) => {
        logsBySubProj.set(doc.sub_project_id, {
            id: doc.id,
            subProjectId: doc.sub_project_id,
            reportingPeriod: doc.reporting_period || '',
            executionSummary: doc.execution_summary || '',
            nextWeekPlan: doc.next_week_plan || '',
            roadblocks: doc.roadblocks || '',
            completionPercentage: doc.completion_percentage || 0,
            updatedAt: formatISO(doc.updated_at),
            createdBy: doc.created_by || '',
        });
    });

    return allProjects.map((p) => ({
        ...p,
        subProjects: p.subProjects.map((sp) => {
            const historicalLog = logsBySubProj.get(sp.id);
            return {
                ...sp,
                latestLog: historicalLog !== undefined ? historicalLog : sp.latestLog,
            };
        }),
    }));
}

