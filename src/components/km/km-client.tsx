'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  FolderGit2,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Archive,
  Download,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Filter,
  Grid,
  List,
  Layers,
  Sparkles,
  BookOpen,
  Calendar,
  Building2,
  Tag,
  ArrowUpDown,
  X,
  FileQuestion,
  Presentation,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/components/admin-context';
import { copyToClipboard } from '@/lib/utils';
import { formatFileSize } from '@/lib/drive-upload';
import {
  KM_CATEGORIES,
  KMDocumentCategory,
  KMDocumentItem,
  extractKMDocumentsFromActionItems,
} from '@/lib/km-helper';
import { UploadKMDialog } from './upload-km-dialog';
import type { FullProject, ProjectActionItem, User, Client } from '@/types';

interface KMClientProps {
  initialProjects: FullProject[];
  initialActionItems: ProjectActionItem[];
  users?: User[];
  clients?: Client[];
}

export function KMClient({
  initialProjects,
  initialActionItems,
  users = [],
  clients = [],
}: KMClientProps) {
  const { toast } = useToast();
  const { isEditor, isAdmin } = useAdmin();

  const [projects, setProjects] = useState<FullProject[]>(initialProjects);
  const [actionItems, setActionItems] = useState<ProjectActionItem[]>(initialActionItems);

  // 搜尋與篩選狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('全部專案');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFileType, setSelectedFileType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'name' | 'project' | 'size'>('latest');
  const [viewMode, setViewMode] = useState<'cards' | 'grouped' | 'list'>('cards');

  // 對話框狀態
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 從所有待辦事項中萃取 KM 文件項目
  const allDocuments = useMemo(() => {
    return extractKMDocumentsFromActionItems(actionItems);
  }, [actionItems]);

  // 專案下拉可搜尋選項
  const projectFilterOptions = useMemo(() => {
    const opts = [{ value: '全部專案', label: '全部專案 (無限制)' }];
    projects.forEach((p) => {
      opts.push({
        value: p.id,
        label: `[${p.caseNumber || '未編號'}] ${p.name}`,
      });
    });
    return opts;
  }, [projects]);

  // 篩選與排序後的文件清單
  const filteredDocuments = useMemo(() => {
    return allDocuments
      .filter((doc) => {
        // 1. 專案篩選 (支援 ID 或名稱匹配)
        if (
          selectedProjectFilter !== '全部專案' &&
          doc.projectId !== selectedProjectFilter &&
          !doc.projectName.includes(selectedProjectFilter)
        ) {
          return false;
        }

        // 2. 文件類別篩選
        if (selectedCategory !== 'all' && doc.category !== selectedCategory) {
          return false;
        }

        // 3. 檔案類型篩選 (pdf, ppt, excel, word, image...)
        if (selectedFileType !== 'all' && doc.fileGroup !== selectedFileType) {
          return false;
        }

        // 4. 關鍵字全文搜尋 (檔名、專案名稱、案號、事項名稱、階段、備註)
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchName = doc.fileName.toLowerCase().includes(q);
          const matchProject = doc.projectName.toLowerCase().includes(q);
          const matchCase = doc.projectCaseNumber.toLowerCase().includes(q);
          const matchTask = doc.actionItemTitle.toLowerCase().includes(q);
          const matchPhase = doc.phase.toLowerCase().includes(q);
          const matchCategory = doc.categoryLabel.toLowerCase().includes(q);
          const matchNotes = (doc.notes || '').toLowerCase().includes(q);

          if (
            !matchName &&
            !matchProject &&
            !matchCase &&
            !matchTask &&
            !matchPhase &&
            !matchCategory &&
            !matchNotes
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'latest') {
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        }
        if (sortBy === 'name') {
          return a.fileName.localeCompare(b.fileName, 'zh-Hant');
        }
        if (sortBy === 'project') {
          return a.projectName.localeCompare(b.projectName, 'zh-Hant');
        }
        if (sortBy === 'size') {
          return b.fileSize - a.fileSize;
        }
        return 0;
      });
  }, [allDocuments, selectedProjectFilter, selectedCategory, selectedFileType, searchQuery, sortBy]);

  // 依專案架構分組資料 (專案樹狀架構)
  const groupedByProject = useMemo(() => {
    const groups: {
      project: { id: string; name: string; caseNumber: string };
      documents: KMDocumentItem[];
    }[] = [];

    const projectMap = new Map<string, KMDocumentItem[]>();
    filteredDocuments.forEach((doc) => {
      const list = projectMap.get(doc.projectId) || [];
      list.push(doc);
      projectMap.set(doc.projectId, list);
    });

    projects.forEach((p) => {
      const docs = projectMap.get(p.id);
      if (docs && docs.length > 0) {
        groups.push({
          project: { id: p.id, name: p.name, caseNumber: p.caseNumber },
          documents: docs,
        });
      }
    });

    return groups;
  }, [filteredDocuments, projects]);

  // 各類別文件計數統計
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allDocuments.length };
    KM_CATEGORIES.forEach((c) => {
      counts[c.key] = allDocuments.filter((d) => d.category === c.key).length;
    });
    return counts;
  }, [allDocuments]);

  // 複製連結
  const handleCopyLink = async (doc: KMDocumentItem) => {
    const link = doc.webViewLink;
    if (!link || link === '#') {
      toast({ title: '無法複製', description: '無有效雲端分享連結', variant: 'destructive' });
      return;
    }
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopiedId(doc.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({
        title: '已複製檔案雲端連結',
        description: `「${doc.fileName}」Google Drive 連結已複製至剪貼簿！`,
      });
    }
  };

  // 取得檔案格式視覺圖示
  const getFileIcon = (fileGroup: string) => {
    switch (fileGroup) {
      case 'pdf':
        return <FileText className="h-6 w-6 text-red-500 shrink-0" />;
      case 'ppt':
        return <Presentation className="h-6 w-6 text-amber-500 shrink-0" />;
      case 'excel':
        return <FileSpreadsheet className="h-6 w-6 text-emerald-600 shrink-0" />;
      case 'word':
        return <FileText className="h-6 w-6 text-blue-600 shrink-0" />;
      case 'image':
        return <ImageIcon className="h-6 w-6 text-purple-500 shrink-0" />;
      case 'archive':
        return <Archive className="h-6 w-6 text-amber-600 shrink-0" />;
      default:
        return <FileQuestion className="h-6 w-6 text-slate-500 shrink-0" />;
    }
  };

  // 新增 KM 文件回調
  const handleUploadSuccess = (newItem: ProjectActionItem) => {
    setActionItems((prev) => [newItem, ...prev]);
  };

  return (
    <div className="w-full space-y-5 pb-16">
      {/* 頂部 Header & 快速上傳 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              專案KM (知識管理與文件檢索)
            </h1>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
              知識資產 {allDocuments.length} 份
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            跨專案整合關鍵技術資料、教育訓練教材、設計圖面規格、報價核決與驗收結案報告，支援全文即時搜尋。
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isEditor && (
            <Button
              onClick={() => setIsUploadDialogOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 font-semibold flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              上傳新專案文件
            </Button>
          )}
        </div>
      </div>

      {/* 搜尋與進階篩選控制列 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3.5">
        {/* 第一列：關鍵字搜尋 + 可打字搜尋專案下拉 + 排序與視圖切換 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* 全文關鍵字搜尋 (占 5 欄) */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="搜尋關鍵字：如「教育訓練」、「雙鏡頭」、「報價」、「SOP」、「驗收」..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* 可搜尋輸入專案下拉選單 (占 4 欄) */}
          <div className="md:col-span-4">
            <SearchableCombobox
              value={selectedProjectFilter}
              onChange={setSelectedProjectFilter}
              options={projectFilterOptions}
              placeholder="輸入專案名稱或案號篩選..."
              className="h-9 text-xs"
            />
          </div>

          {/* 排序 (占 2 欄) */}
          <div className="md:col-span-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest" className="text-xs">🕒 最新上傳優先</SelectItem>
                <SelectItem value="name" className="text-xs">🔤 檔案名稱排序</SelectItem>
                <SelectItem value="project" className="text-xs">🏢 專案名稱排序</SelectItem>
                <SelectItem value="size" className="text-xs">💾 檔案大小排序</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 視圖切換 (占 1 欄) */}
          <div className="md:col-span-1 flex items-center justify-end gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-9 w-9 text-slate-600"
                    onClick={() => setViewMode('cards')}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">卡片檢視</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-9 w-9 text-slate-600"
                    onClick={() => setViewMode('grouped')}
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">依專案架構分組</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-9 w-9 text-slate-600"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">清單表格檢視</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* 第二列：文件分類標籤切換 Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Tag className="h-3.5 w-3.5" />
            文件類別：
          </span>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white font-bold shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🌟 全部文件 ({categoryCounts.all || 0})
          </button>
          {KM_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                selectedCategory === cat.key
                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="text-[11px] opacity-80">({categoryCounts[cat.key] || 0})</span>
            </button>
          ))}
        </div>

        {/* 第三列：檔案格式篩選 Pills */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500">
          <span className="font-semibold text-slate-500 mr-1">檔案格式：</span>
          {[
            { key: 'all', label: '全部格式' },
            { key: 'pdf', label: '📄 PDF' },
            { key: 'ppt', label: '📊 簡報 (PPT)' },
            { key: 'excel', label: '📈 試算表 (Excel)' },
            { key: 'word', label: '📝 文件 (Word)' },
            { key: 'image', label: '🖼️ 圖片' },
            { key: 'archive', label: '📦 壓縮檔' },
          ].map((ft) => (
            <button
              key={ft.key}
              type="button"
              onClick={() => setSelectedFileType(ft.key)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                selectedFileType === ft.key
                  ? 'bg-blue-100 text-blue-800 font-bold'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {ft.label}
            </button>
          ))}

          {(searchQuery || selectedProjectFilter !== '全部專案' || selectedCategory !== 'all' || selectedFileType !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedProjectFilter('全部專案');
                setSelectedCategory('all');
                setSelectedFileType('all');
              }}
              className="text-xs h-6 text-rose-600 hover:bg-rose-50 ml-auto"
            >
              重設所有搜尋條件
            </Button>
          )}
        </div>
      </div>

      {/* 搜尋結果提示條 */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div>
          共找到 <span className="font-bold text-slate-900">{filteredDocuments.length}</span> 份符合的專案文件
          {searchQuery && (
            <span>
              ，符合關鍵字「<span className="font-bold text-indigo-600">{searchQuery}</span>」
            </span>
          )}
        </div>
        <div className="hidden sm:block text-slate-400">
          支援 Google Drive 線上直接預覽與下載
        </div>
      </div>

      {/* 檢視模式 1：現代 KM 卡片檢視 (Cards Grid) */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => (
            <Card
              key={doc.id}
              className="border-slate-200/90 shadow-2xs hover:shadow-xs transition-all hover:border-indigo-300 flex flex-col justify-between group bg-white"
            >
              <CardContent className="p-4 space-y-3">
                {/* 頂部：圖示、檔名、分類徽章 */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 shrink-0 group-hover:scale-105 transition-transform">
                    {getFileIcon(doc.fileGroup)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <a
                      href={doc.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-xs text-slate-900 hover:text-indigo-600 transition-colors line-clamp-2 block tracking-tight"
                      title={doc.fileName}
                    >
                      {doc.fileName}
                    </a>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${doc.categoryBadgeClass}`}>
                        {doc.categoryIcon} {doc.categoryLabel}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 中間：所屬專案與脈絡 */}
                <div className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-100 text-[11px] space-y-1">
                  <div className="flex items-center gap-1 text-slate-700 font-semibold truncate" title={doc.projectName}>
                    <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="truncate">[{doc.projectCaseNumber}] {doc.projectName}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[10px]">
                    <span className="truncate">關聯事項：{doc.actionItemTitle}</span>
                    <span className="shrink-0">{doc.phase}</span>
                  </div>
                  {doc.notes && (
                    <div className="text-[10px] text-slate-400 truncate pt-0.5 border-t border-slate-200/40">
                      備註：{doc.notes.replace(/【KM分類：.*?】/g, '').trim() || '無額外備註'}
                    </div>
                  )}
                </div>

                {/* 底部：上傳時間與快捷按鈕 */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {doc.uploadedAt ? doc.uploadedAt.slice(0, 10) : '未知時間'}
                  </span>

                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={doc.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-indigo-600 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">線上開啟預覽</TooltipContent>
                      </Tooltip>

                      {doc.webContentLink && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={doc.webContentLink}
                              download
                              className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-indigo-600 transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">直接下載檔案</TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(doc)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-indigo-600 transition-colors"
                          >
                            {copiedId === doc.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">複製分享連結</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 檢視模式 2：依專案架構分組檢視 (Group by Project) */}
      {viewMode === 'grouped' && (
        <div className="space-y-4">
          {groupedByProject.map((group) => (
            <div
              key={group.project.id}
              className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden"
            >
              {/* 專案標題列 */}
              <div className="bg-slate-50/90 px-4 py-3 border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderGit2 className="h-4 w-4 text-indigo-600" />
                  <span className="font-bold text-xs text-slate-900">
                    [{group.project.caseNumber || '未編號'}] {group.project.name}
                  </span>
                </div>
                <Badge variant="secondary" className="text-[11px] font-semibold">
                  {group.documents.length} 個檔案
                </Badge>
              </div>

              {/* 專案下檔案列表 */}
              <div className="divide-y divide-slate-100">
                {group.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 px-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors text-xs gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-1.5 bg-slate-50 rounded border border-slate-100 shrink-0">
                        {getFileIcon(doc.fileGroup)}
                      </div>
                      <div className="min-w-0">
                        <a
                          href={doc.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-slate-800 hover:text-indigo-600 transition-colors truncate block"
                          title={doc.fileName}
                        >
                          {doc.fileName}
                        </a>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className={`px-1.5 py-0.2 rounded border ${doc.categoryBadgeClass}`}>
                            {doc.categoryIcon} {doc.categoryLabel}
                          </span>
                          <span>階段：{doc.phase}</span>
                          <span>事項：{doc.actionItemTitle}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right text-[10px] text-slate-400 hidden sm:block">
                        <div>{formatFileSize(doc.fileSize)}</div>
                        <div>{doc.uploadedAt ? doc.uploadedAt.slice(0, 10) : ''}</div>
                      </div>

                      <div className="flex items-center gap-1">
                        <a
                          href={doc.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-indigo-600 transition-colors"
                          title="線上預覽"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        {doc.webContentLink && (
                          <a
                            href={doc.webContentLink}
                            download
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-indigo-600 transition-colors"
                            title="下載檔案"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyLink(doc)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-indigo-600 transition-colors"
                          title="複製連結"
                        >
                          {copiedId === doc.id ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 檢視模式 3：詳細清單表格 (Table List) */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4 w-8">格式</th>
                  <th className="py-2.5 px-4">檔案名稱</th>
                  <th className="py-2.5 px-4">文件類別</th>
                  <th className="py-2.5 px-4">所屬專案</th>
                  <th className="py-2.5 px-4">關聯階段 / 事項</th>
                  <th className="py-2.5 px-4 w-24 text-right">檔案大小</th>
                  <th className="py-2.5 px-4 w-28 text-right">上傳日期</th>
                  <th className="py-2.5 px-4 w-28 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4">
                      {getFileIcon(doc.fileGroup)}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      <a
                        href={doc.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-indigo-600 transition-colors line-clamp-1"
                        title={doc.fileName}
                      >
                        {doc.fileName}
                      </a>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${doc.categoryBadgeClass}`}>
                        {doc.categoryIcon} {doc.categoryLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      [{doc.projectCaseNumber}] {doc.projectName}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                      <div>{doc.phase}</div>
                      <div className="text-[10px] text-slate-400">{doc.actionItemTitle}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500 whitespace-nowrap">
                      {formatFileSize(doc.fileSize)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-400 whitespace-nowrap">
                      {doc.uploadedAt ? doc.uploadedAt.slice(0, 10) : ''}
                    </td>
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <a
                          href={doc.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                          title="預覽"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        {doc.webContentLink && (
                          <a
                            href={doc.webContentLink}
                            download
                            className="p-1 hover:bg-slate-200 rounded text-slate-600"
                            title="下載"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyLink(doc)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                          title="複製連結"
                        >
                          {copiedId === doc.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 無資料空狀態 */}
      {filteredDocuments.length === 0 && (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          <FileQuestion className="h-10 w-10 text-slate-300 mx-auto" />
          <div className="font-bold text-sm text-slate-800">
            查無符合條件的專案 KM 文件
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            沒有找到符合當前關鍵字、專案或分類篩選的文件。您可以嘗試放寬搜尋詞彙，或是點擊上方「上傳新專案文件」進行檔案歸檔。
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedProjectFilter('全部專案');
              setSelectedCategory('all');
              setSelectedFileType('all');
            }}
            className="text-xs"
          >
            重設篩選條件
          </Button>
        </div>
      )}

      {/* 上傳對話框 */}
      <UploadKMDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        projects={projects}
        defaultProjectId={selectedProjectFilter !== '全部專案' ? selectedProjectFilter : undefined}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
