'use server';

import { createClient as getSupabaseClient } from '@/lib/supabase/server';
import type { AuditLog, AuditActionType, AuditDiffItem, AuditOperator } from '@/types';

export interface RecordAuditParams {
  operator?: AuditOperator;
  actionType: AuditActionType;
  actionLabel: string;
  projectId?: string;
  projectName?: string;
  targetId?: string;
  targetName?: string;
  summary: string;
  diffs?: AuditDiffItem[];
  metadata?: Record<string, any>;
}

export interface GetAuditLogsParams {
  projectId?: string;
  operatorName?: string;
  actionType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  totalCount: number;
  tableReady: boolean;
  message?: string;
}

/**
 * 記錄一筆異動履歷
 */
export async function recordAuditLog(params: RecordAuditParams): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const op = params.operator || { name: '系統操作員', role: 'admin' };

    const payload = {
      operator_id: op.uid || null,
      operator_name: op.name || '未知人員',
      operator_email: op.email || null,
      operator_role: op.role || null,
      operator_department: op.department || null,
      action_type: params.actionType,
      action_label: params.actionLabel,
      project_id: params.projectId || null,
      project_name: params.projectName || null,
      target_id: params.targetId || null,
      target_name: params.targetName || null,
      summary: params.summary,
      diffs: params.diffs || [],
      metadata: params.metadata || {},
    };

    const { error } = await supabase.from('audit_logs').insert(payload);
    if (error) {
      console.warn('[AuditLog] 記錄異動履歷提示 (資料表可能尚未建立):', error.message);
    }
  } catch (err: any) {
    console.warn('[AuditLog] 記錄異動履歷失敗 (非致命錯誤):', err?.message || err);
  }
}

/**
 * 讀取異動履歷清單
 */
export async function getAuditLogs(params: GetAuditLogsParams = {}): Promise<AuditLogsResponse> {
  const supabase = getSupabaseClient();
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  try {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.projectId && params.projectId !== 'all') {
      query = query.eq('project_id', params.projectId);
    }

    if (params.actionType && params.actionType !== 'all') {
      query = query.eq('action_type', params.actionType);
    }

    if (params.operatorName && params.operatorName !== 'all') {
      query = query.ilike('operator_name', `%${params.operatorName}%`);
    }

    if (params.search && params.search.trim() !== '') {
      const s = params.search.trim();
      query = query.or(`project_name.ilike.%${s}%,operator_name.ilike.%${s}%,summary.ilike.%${s}%,action_label.ilike.%${s}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return {
          logs: [],
          totalCount: 0,
          tableReady: false,
          message: '資料庫尚未建立 audit_logs 表。請在 Supabase SQL Editor 執行 supabase/migrations/create_audit_logs.sql。',
        };
      }
      throw error;
    }

    const mappedLogs: AuditLog[] = (data || []).map((row: any) => ({
      id: row.id,
      createdAt: row.created_at,
      operatorId: row.operator_id,
      operatorName: row.operator_name,
      operatorEmail: row.operator_email,
      operatorRole: row.operator_role,
      operatorDepartment: row.operator_department,
      actionType: row.action_type,
      actionLabel: row.action_label,
      projectId: row.project_id,
      projectName: row.project_name,
      targetId: row.target_id,
      targetName: row.target_name,
      summary: row.summary,
      diffs: Array.isArray(row.diffs) ? row.diffs : [],
      metadata: row.metadata || {},
    }));

    return {
      logs: mappedLogs,
      totalCount: count ?? mappedLogs.length,
      tableReady: true,
    };
  } catch (err: any) {
    console.error('查詢修改履歷失敗:', err);
    return {
      logs: [],
      totalCount: 0,
      tableReady: false,
      message: err.message || '無法讀取修改履歷',
    };
  }
}
