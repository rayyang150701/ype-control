'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  History,
  Search,
  RefreshCw,
  User,
  Filter,
  ArrowRight,
  Calendar,
  Layers,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getAuditLogs, type AuditLogsResponse } from '@/lib/audit';
import type { AuditLog, AuditActionType } from '@/types';
import { format } from 'date-fns';

interface AuditLogDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currentUserName?: string;
  currentUserRole?: string;
}

const ACTION_CATEGORY_MAP: Record<string, { label: string; color: string; types: AuditActionType[] }> = {
  all: {
    label: '全部異動',
    color: 'bg-slate-100 text-slate-800 border-slate-300',
    types: [],
  },
  progress: {
    label: '週報進度',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    types: ['PROGRESS_LOG_CREATE', 'PROGRESS_LOG_UPDATE', 'PROGRESS_LOG_DELETE'],
  },
  project: {
    label: '專案資料與時程',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    types: ['PROJECT_CREATE', 'PROJECT_UPDATE', 'PROJECT_DELETE', 'PHASE_SCHEDULE_UPDATE'],
  },
  status: {
    label: '暫緩與恢復',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    types: ['PROJECT_ON_HOLD', 'PROJECT_RESUME'],
  },
  task: {
    label: '待辦事項',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    types: ['ACTION_ITEM_CREATE', 'ACTION_ITEM_UPDATE', 'ACTION_ITEM_DELETE'],
  },
};

// 格式化相對時間 (繁中)
function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return '剛剛';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} 分鐘前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} 小時前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay} 天前`;
    return format(d, 'yyyy/MM/dd HH:mm');
  } catch {
    return dateStr;
  }
}

// 取得動作標籤的顏色與外觀
function getActionBadgeProps(type: AuditActionType) {
  switch (type) {
    case 'PROGRESS_LOG_CREATE':
      return { label: '新增週報', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 'PROGRESS_LOG_UPDATE':
      return { label: '更新週報', className: 'bg-blue-100 text-blue-800 border-blue-300' };
    case 'PROGRESS_LOG_DELETE':
      return { label: '刪除週報', className: 'bg-rose-100 text-rose-800 border-rose-300' };
    case 'PROJECT_CREATE':
      return { label: '新增專案', className: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
    case 'PROJECT_UPDATE':
      return { label: '編輯專案', className: 'bg-purple-100 text-purple-800 border-purple-300' };
    case 'PROJECT_ON_HOLD':
      return { label: '設定暫緩', className: 'bg-rose-100 text-rose-800 border-rose-300' };
    case 'PROJECT_RESUME':
      return { label: '恢復專案', className: 'bg-teal-100 text-teal-800 border-teal-300' };
    case 'PHASE_SCHEDULE_UPDATE':
      return { label: '更新階段時程', className: 'bg-cyan-100 text-cyan-800 border-cyan-300' };
    case 'ACTION_ITEM_CREATE':
      return { label: '新增待辦', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 'ACTION_ITEM_UPDATE':
      return { label: '更新待辦', className: 'bg-sky-100 text-sky-800 border-sky-300' };
    case 'ACTION_ITEM_DELETE':
      return { label: '刪除待辦', className: 'bg-slate-100 text-slate-800 border-slate-300' };
    default:
      return { label: '系統操作', className: 'bg-slate-100 text-slate-700 border-slate-300' };
  }
}

// 取得部門/角色標籤外觀
function getRoleBadge(role?: string, department?: string) {
  if (role === 'admin' || role === 'super_admin') {
    return { label: '👑 管理者', className: 'bg-amber-100 text-amber-900 border-amber-300' };
  }
  if (role === 'management' || department === 'PM') {
    return { label: '💼 億威 PM', className: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
  }
  if (role === 'execution') {
    return { label: `⚙️ ${department || '億威各部門'}`, className: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
  }
  return { label: department || '成員', className: 'bg-slate-100 text-slate-700 border-slate-200' };
}

// 範例資料（當 Supabase 資料表尚未建立時展示，供同仁先行檢視介面體驗）
const MOCK_DEMO_LOGS: AuditLog[] = [
  {
    id: 'demo-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    operatorName: '陳家煒',
    operatorRole: 'management',
    operatorDepartment: 'PM',
    operatorEmail: 'cwchen@emmt.com.tw',
    actionType: 'PROGRESS_LOG_UPDATE',
    actionLabel: '更新週報',
    projectId: 'demo-p-40',
    projectName: '[40] 屏東廠車輛過磅管理專案',
    summary: '更新 2026/09/22-09/28 週報進度 (進度調整至 90%)',
    diffs: [
      { field: 'completionPercentage', label: '總體完成度', oldValue: '75%', newValue: '90%' },
      { field: 'executionSummary', label: '本週執行摘要', oldValue: '1.7.3 9/16 完成字幕機控制板安裝及測試中...', newValue: '1.7.3 9/16 完成字幕機控制板安裝及測試(顯示之字串內容須再討論)，目前進入驗收階段，預計為期 60天。' },
      { field: 'nextWeekPlan', label: '下週工作計畫', oldValue: '2.1持續與客戶追蹤', newValue: '2.1燁輝-討論字幕顯示之字串內容及進入驗收階段' },
    ],
  },
  {
    id: 'demo-2',
    createdAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    operatorName: 'Willy',
    operatorRole: 'execution',
    operatorDepartment: '生管',
    operatorEmail: 'willy@emmt.com.tw',
    actionType: 'PROJECT_UPDATE',
    actionLabel: '編輯專案',
    projectId: 'demo-p-38',
    projectName: '[38] 燕巢廠B1502智能天車',
    summary: '更新專案時程 (燕巢廠B1502智能天車 預計完成日延後)',
    diffs: [
      { field: 'expectedCompletionDate', label: '預計完成日', oldValue: '2026/10/01', newValue: '2026/10/12 (延後 11 天)' },
      { field: 'nextWeekPlan', label: '備註更新', oldValue: '待進場佈線', newValue: '億威追蹤燁輝燕巢廠B1502工程安裝進度' },
    ],
  },
  {
    id: 'demo-3',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    operatorName: 'admin',
    operatorRole: 'admin',
    operatorDepartment: '管理部',
    operatorEmail: 'admin@emmt.com.tw',
    actionType: 'PROGRESS_LOG_CREATE',
    actionLabel: '新增週報',
    projectId: 'demo-p-42',
    projectName: '[42] 核一廠天車貯存管理及控制系統',
    summary: '新增 2026/09/22-09/28 週報進度 (進度 15%)',
    diffs: [
      { field: 'completionPercentage', label: '完成度', oldValue: '-', newValue: '15%' },
      { field: 'executionSummary', label: '本週摘要', oldValue: '-', newValue: '1.7 9/21 億威10/2與工程部、業務部、採購部討論相關規格釐清後無誤後，預計下周可以提供合約版本報價。' },
      { field: 'nextWeekPlan', label: '下週計畫', oldValue: '-', newValue: '2.1億威:持續追蹤合約時程討論&釐清設備規格。' },
    ],
  },
];

export function AuditLogDialog({
  isOpen,
  setIsOpen,
  currentUserName,
  currentUserRole,
}: AuditLogDialogProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [tableReady, setTableReady] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [copiedSql, setCopiedSql] = useState(false);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});

  const fetchLogs = () => {
    startTransition(async () => {
      try {
        const res: AuditLogsResponse = await getAuditLogs({ limit: 100 });
        if (res.tableReady) {
          setTableReady(true);
          setLogs(res.logs);
          setTotalCount(res.totalCount);
        } else {
          setTableReady(false);
          // 若資料表尚未建立，以 MOCK 範例供使用者檢視預覽，並引導執行 migration
          setLogs(MOCK_DEMO_LOGS);
          setTotalCount(MOCK_DEMO_LOGS.length);
        }
      } catch (e) {
        console.error('載入修改履歷失敗:', e);
        setTableReady(false);
        setLogs(MOCK_DEMO_LOGS);
        setTotalCount(MOCK_DEMO_LOGS.length);
      }
    });
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  // 取得不重複專案列表與操作人列表供下拉篩選
  const { projectList, operatorList } = useMemo(() => {
    const projects = new Set<string>();
    const operators = new Set<string>();
    logs.forEach((log) => {
      if (log.projectName) projects.add(log.projectName);
      if (log.operatorName) operators.add(log.operatorName);
    });
    return {
      projectList: Array.from(projects),
      operatorList: Array.from(operators),
    };
  }, [logs]);

  // 過濾邏輯
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 分類過濾
      if (selectedCategory !== 'all') {
        const allowedTypes = ACTION_CATEGORY_MAP[selectedCategory]?.types || [];
        if (!allowedTypes.includes(log.actionType)) return false;
      }

      // 專案過濾
      if (selectedProject !== 'all' && log.projectName !== selectedProject) {
        return false;
      }

      // 操作人過濾
      if (selectedOperator !== 'all' && log.operatorName !== selectedOperator) {
        return false;
      }

      // 關鍵字搜尋 (專案名稱、操作人、摘要、細項)
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchProject = log.projectName?.toLowerCase().includes(q);
        const matchOperator = log.operatorName?.toLowerCase().includes(q) || log.operatorEmail?.toLowerCase().includes(q);
        const matchSummary = log.summary?.toLowerCase().includes(q);
        const matchLabel = log.actionLabel?.toLowerCase().includes(q);
        const matchDiff = log.diffs?.some(
          (d) =>
            d.label.toLowerCase().includes(q) ||
            String(d.oldValue).toLowerCase().includes(q) ||
            String(d.newValue).toLowerCase().includes(q)
        );
        if (!matchProject && !matchOperator && !matchSummary && !matchLabel && !matchDiff) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedCategory, selectedProject, selectedOperator, searchQuery]);

  const toggleExpand = (logId: string) => {
    setExpandedDiffs((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  const handleCopySql = () => {
    const sql = `-- 在 Supabase SQL Editor 執行以下語法以建立修改履歷資料表:
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  operator_id TEXT,
  operator_name TEXT NOT NULL,
  operator_email TEXT,
  operator_role TEXT,
  operator_department TEXT,
  action_type TEXT NOT NULL,
  action_label TEXT NOT NULL,
  project_id UUID,
  project_name TEXT,
  target_id TEXT,
  target_name TEXT,
  summary TEXT NOT NULL,
  diffs JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON public.audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operator_name ON public.audit_logs(operator_name);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read audit_logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow service role all audit_logs" ON public.audit_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);
`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-50/70 border-slate-200">
        {/* 對話框頂部 Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shadow-2xs">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                  專案修改履歷紀錄
                </DialogTitle>
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-xs px-2 py-0.5">
                  🔐 內部專用管制
                </Badge>
                {tableReady && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                    連線即時持久化
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                完整追蹤誰在何時修改了專案、週報與待辦資訊，提供「修改前 ➔ 修改後」一目了然的對照紀錄。
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={isPending}
              className="gap-1.5 text-xs text-slate-700 hover:text-slate-900 bg-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin text-amber-600' : ''}`} />
              <span>重新整理</span>
            </Button>
          </div>
        </div>

        {/* 提示橫幅：若未在 Supabase 執行 SQL Migration */}
        {!tableReady && (
          <div className="mx-6 mt-3 p-3.5 bg-amber-50/90 border border-amber-200 rounded-lg flex items-start justify-between gap-3 text-amber-900 text-xs shadow-2xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">資料庫資料表準備中：</span>
                尚未在 Supabase 建立 <code className="px-1 py-0.5 bg-amber-100 rounded text-amber-950 font-mono">audit_logs</code> 資料表。
                目前展示預覽範例。請在 Supabase Dashboard → SQL Editor 執行專屬 Migration 以永久記錄每一筆修改。
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopySql}
              className="shrink-0 h-7 text-xs gap-1 bg-white border-amber-300 text-amber-800 hover:bg-amber-100"
            >
              {copiedSql ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedSql ? '已複製 SQL' : '複製 Migration SQL'}</span>
            </Button>
          </div>
        )}

        {/* 篩選與搜尋列 */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 space-y-2.5">
          {/* 上排：分類標籤快速切換 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> 分類:
            </span>
            {Object.entries(ACTION_CATEGORY_MAP).map(([key, item]) => {
              const active = selectedCategory === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                    active
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* 下排：關鍵字搜尋與下拉選單 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="搜尋姓名、專案案號、摘要內容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-50 focus:bg-white"
              />
            </div>

            {/* 專案下拉篩選 */}
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="h-8 text-xs rounded-md border border-slate-200 bg-slate-50 px-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">所有專案 ({projectList.length} 個專案)</option>
              {projectList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* 人員下拉篩選 */}
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="h-8 text-xs rounded-md border border-slate-200 bg-slate-50 px-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">所有同仁/操作人 ({operatorList.length} 位)</option>
              {operatorList.map((op) => (
                <option key={op} value={op}>
                  👤 {op}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 履歷清單區塊 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              顯示 <strong>{filteredLogs.length}</strong> / 共 {totalCount} 筆異動紀錄
            </span>
            <span className="text-[11px] text-slate-400">
              * 系統依照異動時間由新至舊排序
            </span>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <History className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">查無符合條件的異動紀錄</p>
              <p className="text-xs text-slate-400 mt-1">請嘗試調整搜尋條件或切換分類標籤</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const actionBadge = getActionBadgeProps(log.actionType);
              const roleBadge = getRoleBadge(log.operatorRole, log.operatorDepartment);
              const isExpanded = expandedDiffs[log.id] ?? true;
              const hasDiffs = log.diffs && log.diffs.length > 0;

              return (
                <div
                  key={log.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all p-4 space-y-2.5"
                >
                  {/* 第一行：時間、專案標籤、動作標籤、操作人標籤 */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 時間標籤 */}
                      <span className="text-xs font-mono font-medium text-slate-500 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {log.createdAt ? format(new Date(log.createdAt), 'yyyy/MM/dd HH:mm') : '-'}
                        <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded ml-0.5">
                          {formatRelativeTime(log.createdAt)}
                        </span>
                      </span>

                      {/* 動作標籤 */}
                      <Badge variant="outline" className={`text-xs px-2 py-0.5 font-semibold ${actionBadge.className}`}>
                        {actionBadge.label}
                      </Badge>

                      {/* 專案名稱 */}
                      {log.projectName && (
                        <span className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Layers className="h-3 w-3 text-slate-500" />
                          {log.projectName}
                        </span>
                      )}

                      {/* 子專案或標的 */}
                      {log.targetName && log.targetName !== log.projectName && (
                        <span className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                          {log.targetName}
                        </span>
                      )}
                    </div>

                    {/* 操作人員資訊 */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        {log.operatorName}
                      </span>
                      {log.operatorEmail && (
                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                          ({log.operatorEmail})
                        </span>
                      )}
                      <Badge variant="outline" className={`text-[11px] px-1.5 py-0 ${roleBadge.className}`}>
                        {roleBadge.label}
                      </Badge>
                    </div>
                  </div>

                  {/* 第二行：主要摘要說明 */}
                  <div className="text-xs md:text-sm font-semibold text-slate-800">
                    {log.summary}
                  </div>

                  {/* 第三行：修改前後比對 Diff (一目了然) */}
                  {hasDiffs && (
                    <div className="pt-1">
                      <div className="rounded-lg border border-slate-200/90 overflow-hidden bg-slate-50/60">
                        <div className="px-3 py-1.5 bg-slate-100/80 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-600 font-semibold">
                          <span>異動項目對照 ({log.diffs!.length} 項變更)</span>
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="text-slate-500 hover:text-slate-800 flex items-center gap-0.5 text-[11px] font-normal"
                          >
                            {isExpanded ? (
                              <>
                                <span>收合細節</span> <ChevronUp className="h-3 w-3" />
                              </>
                            ) : (
                              <>
                                <span>展開細節</span> <ChevronDown className="h-3 w-3" />
                              </>
                            )}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="divide-y divide-slate-200/70 p-1">
                            {log.diffs!.map((diff, idx) => (
                              <div key={idx} className="p-2.5 text-xs grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                                {/* 欄位名稱 */}
                                <div className="md:col-span-3 font-semibold text-slate-700 flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                  <span>{diff.label || diff.field}</span>
                                </div>

                                {/* 變更前 ➔ 變更後 對照 */}
                                <div className="md:col-span-9 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                  {/* 修改前 */}
                                  <div className="flex-1 w-full bg-rose-50/80 border border-rose-200 rounded p-1.5 text-slate-700">
                                    <span className="text-[10px] font-bold text-rose-600 uppercase block mb-0.5">
                                      修改前
                                    </span>
                                    <div className="text-rose-900 line-through decoration-rose-400 break-words whitespace-pre-wrap">
                                      {diff.oldValue || '(空白)'}
                                    </div>
                                  </div>

                                  <ArrowRight className="h-4 w-4 text-slate-400 shrink-0 hidden sm:block" />

                                  {/* 修改後 */}
                                  <div className="flex-1 w-full bg-emerald-50/80 border border-emerald-300 rounded p-1.5 text-slate-800">
                                    <span className="text-[10px] font-bold text-emerald-700 uppercase block mb-0.5">
                                      修改後
                                    </span>
                                    <div className="text-emerald-950 font-semibold break-words whitespace-pre-wrap">
                                      {diff.newValue || '(空白)'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 對話框底部 Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>受保護檢視：僅 億威各部門、億威 PM 與 管理者 具備檢視權限</span>
          </div>
          <Button variant="default" size="sm" onClick={() => setIsOpen(false)} className="px-4">
            關閉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
