'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ShieldCheck, Info, CheckCircle2, Eye, EyeOff, User } from 'lucide-react';
import { useAdmin, NormalizedRole } from '@/components/admin-context';
import { Badge } from '@/components/ui/badge';

interface PermissionMatrixDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function PermissionMatrixDialog({ isOpen, setIsOpen }: PermissionMatrixDialogProps) {
  const { role, roleInfo, currentUser } = useAdmin();

  // 角色清單定義
  const columns: { key: NormalizedRole; enLabel: string; zhLabel: string }[] = [
    { key: 'guest', enLabel: 'Guest', zhLabel: '訪客' },
    { key: 'monitor', enLabel: 'Monitor', zhLabel: '燁輝/其他' },
    { key: 'execution', enLabel: 'Execution', zhLabel: '億威各部門' },
    { key: 'management', enLabel: 'Management', zhLabel: '億威PM' },
    { key: 'admin', enLabel: 'Admin', zhLabel: '管理者' },
  ];

  // 模組權限矩陣列定義（完全符合權限管制表）
  const matrixRows = [
    {
      category: '燁輝進度管制表',
      permissions: {
        guest: { type: 'view', text: '僅能檢視' },
        monitor: { type: 'manage', text: '完全管理' },
        execution: { type: 'view', text: '僅能檢視' },
        management: { type: 'manage', text: '完全管理' },
        admin: { type: 'manage', text: '完全管理' },
      },
    },
    {
      category: '專案待辦',
      permissions: {
        guest: { type: 'view', text: '僅能檢視' },
        monitor: { type: 'view', text: '僅能檢視' },
        execution: { type: 'view', text: '僅能檢視' },
        management: { type: 'manage', text: '完全管理' },
        admin: { type: 'manage', text: '完全管理' },
      },
    },
    {
      category: '專案行程',
      permissions: {
        guest: { type: 'none', text: '無法檢視、編輯\n(看不到icon)' },
        monitor: { type: 'view', text: '僅能檢視' },
        execution: { type: 'manage', text: '完全管理' },
        management: { type: 'manage', text: '完全管理' },
        admin: { type: 'manage', text: '完全管理' },
      },
    },
    {
      category: '專案 Gap-analysis',
      permissions: {
        guest: { type: 'none', text: '無法檢視、編輯\n(看不到icon)' },
        monitor: { type: 'view', text: '僅能檢視' },
        execution: { type: 'view', text: '僅能檢視' },
        management: { type: 'manage', text: '完全管理' },
        admin: { type: 'manage', text: '完全管理' },
      },
    },
    {
      category: '專案 KM',
      permissions: {
        guest: { type: 'none', text: '無法檢視、編輯\n(看不到icon)' },
        monitor: { type: 'view', text: '僅能檢視' },
        execution: { type: 'view', text: '僅能檢視' },
        management: { type: 'manage', text: '完全管理' },
        admin: { type: 'manage', text: '完全管理' },
      },
    },
    {
      category: '專案MAP',
      permissions: {
        guest: { type: 'none', text: '無法檢視、編輯\n(看不到icon)' },
        monitor: { type: 'none', text: '無法檢視、編輯\n(看不到icon)' },
        execution: { type: 'none', text: '無法檢視、編輯\n(看不到icon)' },
        management: { type: 'none', text: '無法檢視、編輯\n(看不到icon)' },
        admin: { type: 'manage', text: '完全管理' },
      },
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="space-y-1.5 pb-2 border-b">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              系統權限管制表 (Permission Matrix)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            針對 5 大帳號類別於各系統模組之檢視、操作、編輯與圖示呈現規範。
          </DialogDescription>
        </DialogHeader>

        {/* 當前登入身分提示 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" />
            <span className="text-slate-600 font-medium">您目前的登入身分：</span>
            <Badge
              className={`font-semibold text-xs shadow-2xs ${
                role === 'admin'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : role === 'management'
                  ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                  : role === 'execution'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : role === 'monitor'
                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                  : 'bg-slate-200 text-slate-800 border-slate-300'
              }`}
            >
              {roleInfo.badge}
            </Badge>
            {currentUser && (
              <span className="text-slate-500">
                ({currentUser.displayName || currentUser.username})
              </span>
            )}
          </div>
          <div className="text-[11px] text-blue-600 font-medium">
            💡 下表中已為您以天藍色外框標記出您的對應權限欄位
          </div>
        </div>

        {/* 權限管制表本體（完全復刻管制圖表） */}
        <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-xs">
          <table className="w-full text-center border-collapse text-xs sm:text-sm">
            <thead>
              {/* 表頭第 1 列：權限類別與帳號類別大項 */}
              <tr className="bg-[#bce4fa] text-slate-900 font-bold border-b border-slate-300">
                <th
                  rowSpan={2}
                  className="w-28 sm:w-36 py-2.5 px-3 border-r border-slate-300 text-slate-900 font-bold tracking-wider"
                >
                  權限類別
                </th>
                <th
                  colSpan={5}
                  className="py-2 px-3 text-slate-900 font-bold tracking-widest border-b border-slate-300"
                >
                  帳號類別
                </th>
              </tr>
              {/* 表頭第 2 列：英文角色分類 */}
              <tr className="bg-[#d2effd] text-slate-800 font-semibold border-b border-slate-300">
                {columns.map((col) => {
                  const isCurrent = col.key === role;
                  return (
                    <th
                      key={col.key}
                      className={`py-2 px-2.5 border-r last:border-r-0 border-slate-300 min-w-[100px] ${
                        isCurrent ? 'bg-sky-200/90 text-blue-950 font-bold ring-2 ring-blue-500/70 ring-inset' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span>{col.enLabel}</span>
                        {isCurrent && (
                          <span className="text-[10px] text-blue-700 bg-white/80 px-1 py-0.2 rounded font-normal mt-0.5">
                            目前身分
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
              {/* 表頭第 3 列：定義角色（黃色背景標籤） */}
              <tr className="border-b-2 border-slate-400 bg-white">
                <th className="py-2 px-3 border-r border-slate-300 text-slate-900 font-bold bg-[#fff8c5]">
                  定義角色
                </th>
                {columns.map((col) => {
                  const isCurrent = col.key === role;
                  return (
                    <th
                      key={col.key}
                      className={`py-2 px-2 border-r last:border-r-0 border-slate-300 bg-[#fff5a8] text-slate-900 font-bold ${
                        isCurrent ? 'ring-2 ring-blue-500/70 ring-inset' : ''
                      }`}
                    >
                      {col.zhLabel}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 bg-white">
              {matrixRows.map((row) => (
                <tr key={row.category} className="hover:bg-slate-50/80 transition-colors">
                  {/* 模組名稱欄位 */}
                  <td className="py-3 px-3 border-r border-slate-300 font-bold text-slate-800 text-left bg-slate-50/50 whitespace-nowrap">
                    {row.category}
                  </td>
                  {/* 5 大角色權限 */}
                  {columns.map((col) => {
                    const perm = row.permissions[col.key];
                    const isCurrent = col.key === role;

                    let textClass = 'text-slate-700';
                    let bgCol = isCurrent ? 'bg-blue-50/40' : '';

                    if (perm.type === 'manage') {
                      textClass = 'text-blue-600 font-bold';
                    } else if (perm.type === 'none') {
                      textClass = 'text-red-600 font-semibold leading-tight';
                    } else if (perm.type === 'view') {
                      textClass = 'text-slate-800';
                    }

                    return (
                      <td
                        key={col.key}
                        className={`py-3 px-2 border-r last:border-r-0 border-slate-300 align-middle ${bgCol} ${
                          isCurrent ? 'ring-1 ring-blue-400/40 ring-inset' : ''
                        }`}
                      >
                        <div className={`text-xs sm:text-[13px] whitespace-pre-line ${textClass}`}>
                          {perm.text}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 權限定義與備註說明 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-1.5 font-bold text-blue-900 mb-1">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>完全管理 (藍字)</span>
            </div>
            <p className="text-blue-700 text-[11px] leading-relaxed">
              具備該模組的<strong>完整維護權限</strong>，包含新增、編輯、刪除、狀態切換、週報撰寫、時程調整等。
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-100 border border-slate-200">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
              <Eye className="w-4 h-4 text-slate-600" />
              <span>僅能檢視 (黑字)</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              具備<strong>瀏覽與匯出權限</strong>，系統不顯示任何新增、編輯、暫緩、恢復或刪除按鈕，無法修改資料。
            </p>
          </div>

          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center gap-1.5 font-bold text-red-900 mb-1">
              <EyeOff className="w-4 h-4 text-red-600" />
              <span>無法檢視、編輯 (紅字)</span>
            </div>
            <p className="text-red-700 text-[11px] leading-relaxed">
              頂部<strong>導覽列不會出現該模組圖示 (看不到 icon)</strong>，若嘗試透過 URL 直連也會自動阻擋進入。
            </p>
          </div>
        </div>

        {/* 模組存取與角色對照註記 */}
        <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-lg text-[11px] text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-700" />
            <span>帳號歸戶說明：</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800/90 pl-1">
            <li><strong>Admin (管理者)</strong>：admin@emmt.com.tw、jamesyang@emmt.com.tw（唯一具備專案 MAP 與系統後台權限）</li>
            <li><strong>Management (億威 PM)</strong>：Winona、Albee、Bella、Gary（負責專案待辦、行程、Gap、KM 治理）</li>
            <li><strong>Execution (億威各部門)</strong>：潘科南、蔡孟廷、張家豪、阿貴、Billy、Willy（負責專案行程執行）</li>
            <li><strong>Monitor (燁輝/其他)</strong>：燁輝 TPM 窗口群（胡春如、許家豪、賴冠廷等）與外部合作夥伴（朱部長等）</li>
            <li><strong>Guest (訪客)</strong>：未登入之公用訪客或外部訪客（僅能檢視管制表與專案待辦）</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
