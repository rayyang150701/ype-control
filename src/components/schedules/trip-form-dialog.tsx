'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Users,
  Building,
  Building2,
  FileText,
  Check,
  UtensilsCrossed,
  Sparkles,
  Filter,
  Video,
  FolderPlus,
  ChevronDown,
  X,
  Lock,
} from 'lucide-react';
import { BusinessTrip, TRIP_CATEGORIES, TIME_OPTIONS, TripCategory, TripStatus } from '@/types/businessTrip';
import type { Client, Project, User } from '@/types';
import { formatDate } from '@/lib/calendar-helper';
import { useAdmin } from '@/components/admin-context';
import { useToast } from '@/hooks/use-toast';
import { NewPocProjectDialog } from '@/components/internal/new-poc-project-dialog';

// --- 關鍵字搜尋專案下拉選單 (含查無專案時手動建立專案) ---
interface ProjectComboboxProps {
  value: string;
  projectName: string;
  projects: Project[];
  onChange: (projectId: string, project?: Project) => void;
  canCreateProject: boolean;
  onOpenCreateProject: (typedName: string) => void;
}

function ProjectCombobox({
  value,
  projectName,
  projects,
  onChange,
  canCreateProject,
  onOpenCreateProject,
}: ProjectComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedProject = useMemo(() => {
    if (!value) return null;
    return projects.find((p) => p.id === value) || (projectName ? ({ id: value, name: projectName } as Project) : null);
  }, [value, projectName, projects]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const caseNum = (p.caseNumber || '').toLowerCase();
      const client = (p.clientName || '').toLowerCase();
      const category = (p.projectCategory || '').toLowerCase();
      return name.includes(q) || caseNum.includes(q) || client.includes(q) || category.includes(q);
    });
  }, [projects, query]);

  const hasExactMatch = useMemo(() => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return projects.some((p) => (p.name || '').trim().toLowerCase() === q);
  }, [projects, query]);

  const handleSelect = (proj: Project) => {
    onChange(proj.id, proj);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', undefined);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const displayInputValue = isOpen ? query : (selectedProject ? selectedProject.name : '');

  return (
    <div ref={containerRef} className="relative w-full mt-1">
      <div className="relative flex items-center">
        <Input
          ref={inputRef}
          type="text"
          value={displayInputValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedProject ? selectedProject.name : '輸入關鍵字搜尋專案 (名稱/案號/客戶)...'}
          className="pr-16 text-sm bg-white border-slate-300 focus:ring-blue-500 rounded-lg"
        />

        <div className="absolute right-1.5 flex items-center gap-0.5">
          {Boolean(selectedProject || query) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              title="清除選取專案"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
            title={isOpen ? '收合專案清單' : '展開專案清單'}
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* 已關聯專案提示 */}
      {!isOpen && selectedProject && (
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 flex-wrap">
          <span className="font-semibold text-slate-700">已關聯：</span>
          <span className="font-medium text-slate-900">{selectedProject.name}</span>
          {selectedProject.caseNumber && (
            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">
              {selectedProject.caseNumber}
            </span>
          )}
          {selectedProject.clientName && (
            <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">
              {selectedProject.clientName}
            </span>
          )}
        </div>
      )}

      {/* 下拉清單 */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in-50 zoom-in-95">
          {filtered.length === 0 ? (
            <div className="p-3 text-center space-y-2.5">
              <p className="text-xs text-slate-500">
                未找到與「<span className="font-semibold text-slate-800">{query.trim()}</span>」相符的專案
              </p>
              {canCreateProject ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenCreateProject(query.trim());
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold border border-blue-200 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderPlus className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="font-bold text-blue-900">＋ 建立新專案「{query.trim()}」</div>
                      <div className="text-[10px] text-blue-600 font-normal">該專案尚未建立？點此手動新增並自動關聯</div>
                    </div>
                  </div>
                  <span className="text-[11px] bg-blue-600 text-white px-2.5 py-1 rounded shadow-xs shrink-0 ml-2">
                    立即建立
                  </span>
                </button>
              ) : (
                <div className="p-2.5 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>該專案未建立（建立新專案需管理員或編輯者權限）</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span>選擇專案 ({filtered.length})</span>
                {query && <span className="font-normal text-slate-400">關鍵字: {query}</span>}
              </div>

              {filtered.map((proj) => {
                const isSelected = proj.id === value;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => handleSelect(proj)}
                    className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="truncate max-w-[260px] font-medium text-slate-900">{proj.name}</span>
                      {proj.caseNumber && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          {proj.caseNumber}
                        </span>
                      )}
                      {proj.clientName && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                          {proj.clientName}
                        </span>
                      )}
                      {proj.projectCategory && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded shrink-0 ${
                          proj.projectCategory === '評估案' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {proj.projectCategory}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-1" />}
                  </button>
                );
              })}

              {/* 當有搜尋內容但未完全吻合，且具備權限時提供建立捷徑 */}
              {query.trim() && !hasExactMatch && canCreateProject && (
                <div className="pt-1.5 mt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenCreateProject(query.trim());
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-blue-600 hover:bg-blue-50 font-medium transition cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <FolderPlus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">非既有專案？建立新專案「{query.trim()}」</span>
                    </div>
                    <span className="text-[10px] text-blue-600 border border-blue-200 bg-white px-1.5 py-0.5 rounded shrink-0 ml-1 font-semibold">
                      + 建立
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- 關鍵字搜尋客戶下拉選單 ---
interface ClientComboboxProps {
  value: string;
  customerName: string;
  clients: Client[];
  onChange: (customerId: string, client?: Client) => void;
}

function ClientCombobox({
  value,
  customerName,
  clients,
  onChange,
}: ClientComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedClient = useMemo(() => {
    if (!value && !customerName) return null;
    return clients.find((c) => c.id === value || (customerName && c.name === customerName)) || null;
  }, [value, customerName, clients]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const code = (c.code || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [clients, query]);

  const handleSelect = (client: Client) => {
    onChange(client.id, client);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', undefined);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const displayText = selectedClient ? `${selectedClient.name}${selectedClient.code ? ` (${selectedClient.code})` : ''}` : customerName || '';
  const displayInputValue = isOpen ? query : displayText;

  return (
    <div ref={containerRef} className="relative w-full mt-1">
      <div className="relative flex items-center">
        <Input
          ref={inputRef}
          type="text"
          value={displayInputValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={displayText || '輸入關鍵字搜尋客戶 (如: 燁輝, YP)...'}
          className="pr-16 text-sm bg-white border-slate-300 focus:ring-blue-500 rounded-lg"
        />

        <div className="absolute right-1.5 flex items-center gap-0.5">
          {Boolean(selectedClient || customerName || query) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              title="清除選取客戶"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
            title={isOpen ? '收合客戶清單' : '展開客戶清單'}
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in-50 zoom-in-95">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500">
              未找到與「<span className="font-semibold text-slate-800">{query.trim()}</span>」相符的客戶
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400">
                選擇客戶 ({filtered.length})
              </div>
              {filtered.map((client) => {
                const isSelected = selectedClient?.id === client.id || customerName === client.name;
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelect(client)}
                    className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{client.name}</span>
                      {client.code && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {client.code}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TripFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: BusinessTrip | null;
  selectedDate?: Date | null;
  clients: Client[];
  projects: Project[];
  users: User[];
  defaultCustomerId?: string;
  onSave: (tripData: Omit<BusinessTrip, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onProjectCreated?: (newProject: Project) => void;
}

export function TripFormDialog({
  open,
  onOpenChange,
  trip,
  selectedDate,
  clients,
  projects,
  users,
  defaultCustomerId,
  onSave,
  onProjectCreated,
}: TripFormDialogProps) {
  const { toast } = useToast();
  const { isAdmin, isEditor, isGuest, setIsLoginDialogOpen } = useAdmin();
  const canCreateProject = (isAdmin || isEditor) && !isGuest;

  const [projectList, setProjectList] = useState<Project[]>(projects);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [createProjectDefaultName, setCreateProjectDefaultName] = useState('');

  useEffect(() => {
    setProjectList(projects);
  }, [projects]);

  const handleOpenCreateProject = (initialName: string) => {
    if (!canCreateProject) {
      toast({
        title: '權限不足',
        description: '建立新專案僅限管理員或編輯者執行，請先登入帳號。',
        variant: 'destructive',
      });
      if (isGuest) {
        setIsLoginDialogOpen(true);
      }
      return;
    }
    setCreateProjectDefaultName(initialName);
    setIsCreateProjectOpen(true);
  };

  const [formData, setFormData] = useState({
    subject: '',
    projectId: '',
    projectName: '',
    travelers: [''],
    location: '',
    meetingUrl: '',
    customerId: '',
    customerName: '',
    startDate: formatDate(new Date()),
    endDate: formatDate(new Date()),
    startTime: '09:00',
    endTime: '17:00',
    category: 'business' as TripCategory,
    pm: '',
    tpm: '',
    status: 'pending' as TripStatus,
    lunchBoxes: 0,
    notes: '',
  });

  // 人員選擇之客戶/單位篩選條件 (預設全部或隨關聯客戶連動)
  const [travelerClientFilter, setTravelerClientFilter] = useState<string>('all');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 判斷關聯客戶是否為燁輝相關
  const isYiehPhui = useMemo(() => {
    return Boolean(
      (formData.customerName && formData.customerName.includes('燁輝')) ||
      (formData.customerId && clients.find((c) => c.id === formData.customerId)?.name.includes('燁輝'))
    );
  }, [formData.customerName, formData.customerId, clients]);

  // 提取所有可供篩選的公司列表 (僅提取公司名稱，不混入部門)
  const companyFilterOptions = useMemo(() => {
    const list = new Set<string>();
    list.add('燁輝');
    list.add('億威電子');
    clients.forEach((c) => {
      if (c.name?.trim()) list.add(c.name.trim());
    });
    users.forEach((u) => {
      if (u.clientName?.trim()) list.add(u.clientName.trim());
    });
    return Array.from(list).sort();
  }, [clients, users]);

  // 所有同仁與人員名冊：僅嚴格取自成員管理名單 (users)，不混入未經整理的長字串專案聯絡人
  const allPersonnelList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; department?: string; clientName?: string }>();
    users.forEach((u) => {
      const name = (u.displayName || u.username || u.email || '').trim();
      if (name && !map.has(name)) {
        map.set(name, {
          id: u.uid,
          name,
          department: u.department?.trim(),
          clientName: u.clientName?.trim(),
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      (a.clientName || '').localeCompare(b.clientName || '') || a.name.localeCompare(b.name)
    );
  }, [users]);

  // 輔助函式：公司別精確比對（確保「燁輝」與「燁輝燕巢」完全區隔，彼此互不包含）
  const isExactCompanyMatch = (userCompany?: string, filterCompany?: string) => {
    if (!userCompany || !filterCompany) return false;
    const u = userCompany.trim();
    const f = filterCompany.trim();
    if (u === f) return true;

    // 支援「億威」與「億威電子」別名相容
    if ((u === '億威' || u === '億威電子') && (f === '億威' || f === '億威電子')) return true;

    // 嚴格隔離「燁輝」與「燁輝燕巢」
    // 若篩選為「燁輝」，只要所屬公司包含「燕巢」就絕對不匹配
    if ((f === '燁輝' || f === '燁輝企業') && (u.includes('燕巢') || u !== '燁輝')) {
      return false;
    }
    // 若篩選包含「燕巢」（如「燁輝燕巢」），只要所屬公司不含「燕巢」就絕對不匹配
    if (f.includes('燕巢') && !u.includes('燕巢')) {
      return false;
    }

    // 去除公司型態尾綴（如股份有限公司、有限公司）後比對
    const cleanCompany = (str: string) => str.replace(/股份有限公司|有限公司/g, '').trim();
    if (cleanCompany(u) === cleanCompany(f)) return true;

    return false;
  };

  // 依據 travelerClientFilter (公司別) 篩選對應人名（精確比對，選擇「燁輝」時絕對不會帶出「燁輝燕巢」人員）
  const filteredPersonnelOptions = useMemo(() => {
    if (!travelerClientFilter || travelerClientFilter === 'all') {
      return allPersonnelList;
    }
    return allPersonnelList.filter((p) => isExactCompanyMatch(p.clientName, travelerClientFilter));
  }, [allPersonnelList, travelerClientFilter]);

  // TPM 負責人名單：僅嚴格取自「燁輝」且部門為「TPM」之同仁（絕不含億威 PM/成員、非 TPM 課室或燕巢同仁）
  const tpmOptions = useMemo(() => {
    const list = new Set<string>();
    allPersonnelList.forEach((p) => {
      const pCompany = (p.clientName || '').trim();
      const pDept = (p.department || '').trim().toUpperCase();

      // 嚴格判定：公司為「燁輝」（排除燁輝燕巢等其他單位），且部門包含「TPM」
      const isYiehPhuiExact = (pCompany === '燁輝' || pCompany === '燁輝企業') && !pCompany.includes('燕巢');
      const isTpmDept = pDept.includes('TPM');

      if (isYiehPhuiExact && isTpmDept) {
        list.add(p.name);
      }
    });

    // 備援：若無精確標註部門，但部門名稱明確含有 TPM 且不屬於億威或燕巢
    if (list.size === 0) {
      allPersonnelList.forEach((p) => {
        const pCompany = (p.clientName || '').trim();
        const pDept = (p.department || '').trim().toUpperCase();
        if (pDept.includes('TPM') && pCompany !== '億威' && pCompany !== '億威電子' && !pCompany.includes('燕巢')) {
          list.add(p.name);
        }
      });
    }

    return Array.from(list).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [allPersonnelList]);

  // 負責 PM 選項名單 (從專案負責 PM 與 成員名單提取，僅限 PM 部門/人員，不混入 TPM 窗口)
  const pmOptions = useMemo(() => {
    const list = new Set<string>();
    allPersonnelList.forEach((p) => {
      const pDept = (p.department || '').trim().toUpperCase();
      // 部門為 PM 且不是 TPM
      if (pDept === 'PM' || (pDept.includes('PM') && !pDept.includes('TPM'))) {
        list.add(p.name);
      }
    });
    projectList.forEach((p) => {
      if (p.responsiblePm?.trim()) {
        const name = p.responsiblePm.trim();
        if (!tpmOptions.includes(name)) {
          list.add(name);
        }
      }
    });
    if (list.size === 0) {
      allPersonnelList.forEach((p) => list.add(p.name));
    }
    return Array.from(list).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [allPersonnelList, projectList, tpmOptions]);

  // 依據傳入的 trip 或 selectedDate 初始化
  useEffect(() => {
    if (open) {
      if (trip) {
        const trvs = trip.travelers && trip.travelers.length > 0 ? trip.travelers : [''];
        setFormData({
          subject: trip.subject || '',
          projectId: trip.projectId || '',
          projectName: trip.projectName || '',
          travelers: trvs,
          location: trip.location || '',
          meetingUrl: trip.meetingUrl || '',
          customerId: trip.customerId || '',
          customerName: trip.customerName || '',
          startDate: trip.startDate || formatDate(new Date()),
          endDate: trip.endDate || formatDate(new Date()),
          startTime: trip.startTime || '09:00',
          endTime: trip.endTime || '17:00',
          category: trip.category || 'business',
          pm: trip.pm || '',
          tpm: trip.tpm || '',
          status: trip.status || 'pending',
          lunchBoxes: trip.lunchBoxes || 0,
          notes: trip.notes || '',
        });

        if (trip.customerName) {
          setTravelerClientFilter(trip.customerName);
        } else {
          setTravelerClientFilter('all');
        }
      } else {
        const initDate = selectedDate ? formatDate(selectedDate) : formatDate(new Date());
        let initCustomerName = '';
        if (defaultCustomerId) {
          const matchedClient = clients.find((c) => c.id === defaultCustomerId);
          if (matchedClient) initCustomerName = matchedClient.name;
        }

        setFormData({
          subject: '',
          projectId: '',
          projectName: '',
          travelers: [''],
          location: '',
          meetingUrl: '',
          customerId: defaultCustomerId || '',
          customerName: initCustomerName,
          startDate: initDate,
          endDate: initDate,
          startTime: '09:00',
          endTime: '17:00',
          category: 'business',
          pm: '',
          tpm: '',
          status: 'pending',
          lunchBoxes: 0,
          notes: '',
        });

        if (initCustomerName) {
          setTravelerClientFilter(initCustomerName);
        } else {
          setTravelerClientFilter('all');
        }
      }
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open, trip, selectedDate, defaultCustomerId, clients]);

  const handleAddTraveler = () => {
    setFormData((prev) => ({
      ...prev,
      travelers: [...prev.travelers, ''],
    }));
  };

  const handleRemoveTraveler = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      travelers: prev.travelers.filter((_, i) => i !== index),
    }));
  };

  const handleTravelerChange = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      travelers: prev.travelers.map((t, i) => (i === index ? value : t)),
    }));
  };

  // 當專案改變時，自動關聯專案名稱與對應客戶（若客戶未指定）
  const handleProjectChange = (projectId: string, projectObj?: Project) => {
    const proj = projectObj || projectList.find((p) => p.id === projectId);
    if (proj) {
      let matchedClientId = formData.customerId;
      let matchedClientName = formData.customerName;

      if (!matchedClientName && proj.clientName) {
        matchedClientName = proj.clientName;
        const matched = clients.find((c) => c.name === proj.clientName);
        if (matched) matchedClientId = matched.id;
      }

      setFormData((prev) => ({
        ...prev,
        projectId: proj.id,
        projectName: proj.name,
        customerId: matchedClientId,
        customerName: matchedClientName,
        pm: proj.responsiblePm || prev.pm || '',
        tpm: proj.tpmOfficeContact || prev.tpm || '',
      }));

      if (matchedClientName) {
        setTravelerClientFilter(matchedClientName);
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        projectId: '',
        projectName: '',
      }));
    }
  };

  const handleCustomerChange = (customerId: string, clientObj?: Client) => {
    const client = clientObj || clients.find((c) => c.id === customerId);
    const newCustomerName = client ? client.name : '';
    setFormData((prev) => ({
      ...prev,
      customerId: client ? client.id : '',
      customerName: newCustomerName,
      lunchBoxes: newCustomerName.includes('燁輝') ? prev.lunchBoxes : 0,
    }));

    if (newCustomerName) {
      setTravelerClientFilter(newCustomerName);
    } else {
      setTravelerClientFilter('all');
    }
  };

  const handleProjectCreatedSuccess = (newProj: any) => {
    if (!newProj) return;
    setProjectList((prev) => [newProj, ...prev.filter((p) => p.id !== newProj.id)]);
    handleProjectChange(newProj.id, newProj);
    if (onProjectCreated) {
      onProjectCreated(newProj);
    }
    toast({
      title: '新專案建立成功',
      description: `已成功建立「${newProj.name}」並自動關聯至此行程！`,
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.subject.trim()) {
      newErrors.subject = '請填寫出差行程主題';
    }
    const validTravelers = formData.travelers.filter((t) => t && t.trim().length > 0);
    if (validTravelers.length === 0) {
      newErrors.travelers = '請至少填寫或選擇一位出差人員';
    }
    if (formData.category !== 'online_meeting' && !formData.location.trim()) {
      newErrors.location = '請輸入出差地點或廠區';
    }
    if (formData.endDate < formData.startDate) {
      newErrors.endDate = '結束日期不能早於開始日期';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      await onSave({
        subject: formData.subject.trim(),
        projectId: formData.projectId || undefined,
        projectName: formData.projectName || undefined,
        customerId: formData.customerId || undefined,
        customerName: formData.customerName || undefined,
        travelers: formData.travelers.map((t) => t.trim()).filter(Boolean),
        location: formData.location.trim() || (formData.category === 'online_meeting' ? '線上會議' : ''),
        meetingUrl: formData.meetingUrl?.trim() || undefined,
        startDate: formData.startDate,
        endDate: formData.endDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        category: formData.category,
        pm: formData.pm ? formData.pm.trim() : undefined,
        tpm: formData.tpm ? formData.tpm.trim() : undefined,
        status: formData.status,
        lunchBoxes: isYiehPhui && formData.category !== 'online_meeting' ? Number(formData.lunchBoxes) || 0 : 0,
        notes: formData.notes ? formData.notes.trim() : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('儲存行程失敗:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl">
        <DialogHeader className="px-6 py-4 border-b bg-gray-50/80 sticky top-0 z-10">
          <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            {trip ? '編輯出差行程' : '新增出差行程'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 主題 */}
          <div>
            <Label className="text-sm font-semibold text-gray-700">
              行程主題 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="例：燁輝岡山廠產線感測器現場調校與會議"
              className="mt-1"
            />
            {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
          </div>

          {/* 1. 行程類別 (置於主題正下方) */}
          <div>
            <Label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
              <span>行程類別</span>
              <span className="text-xs text-slate-400 font-normal">點選切換行程性質</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-1.5">
              {TRIP_CATEGORIES.map((cat) => (
                <label
                  key={cat.value}
                  className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer transition ${
                    formData.category === cat.value
                      ? 'border-blue-500 bg-blue-50/60 shadow-xs ring-1 ring-blue-500'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat.value}
                    checked={formData.category === cat.value}
                    onChange={() => {
                      const nextCat = cat.value;
                      setFormData((prev) => ({
                        ...prev,
                        category: nextCat,
                        location: nextCat === 'online_meeting' && !prev.location.trim() ? '線上會議' : prev.location,
                      }));
                      if (nextCat === 'online_meeting') {
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.location;
                          return copy;
                        });
                      }
                    }}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs sm:text-sm font-medium text-gray-800 truncate">
                      {cat.label}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 2. 線上會議連結 (當類別為線上會議時顯示，不強制) */}
          {formData.category === 'online_meeting' && (
            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2 animate-in fade-in-50 duration-200">
              <Label className="text-sm font-semibold text-purple-900 flex items-center gap-1.5">
                <Video className="w-4 h-4 text-purple-600" />
                <span>線上會議連結 <span className="text-xs text-purple-600 font-normal">(選填)</span></span>
              </Label>
              <Input
                type="url"
                value={formData.meetingUrl}
                onChange={(e) => setFormData({ ...formData, meetingUrl: e.target.value })}
                placeholder="例：https://meet.google.com/xxx-xxxx-xxx 或 Teams / Zoom 視訊會議網址"
                className="bg-white border-purple-200 focus:ring-purple-400 text-sm"
              />
              <p className="text-[11px] text-purple-600">
                💡 可填寫 Google Meet、MS Teams 或 Zoom 連結，系統將同步加入通知與行事曆。
              </p>
            </div>
          )}

          {/* 3. 出差 / 會議地點 */}
          <div>
            <Label className="text-sm font-semibold text-gray-700">
              {formData.category === 'online_meeting' ? (
                <>
                  會議地點 / 廠區 <span className="text-xs text-slate-500 font-normal">(選填，留空預設為線上會議)</span>
                </>
              ) : (
                <>
                  出差地點 / 廠區 <span className="text-red-500">*</span>
                </>
              )}
            </Label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder={
                formData.category === 'online_meeting'
                  ? '留空預設為「線上會議」，亦可填寫各廠會議室或遠端'
                  : '例：高雄市橋頭區燁輝三廠 塗裝研發中心'
              }
              className="mt-1"
            />
            {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
          </div>

          {/* 專案與客戶 (2 欄) - 支援關鍵字搜尋帶出、查無專案時手動建立、客戶關鍵字搜尋 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700">關聯專案 (可選)</Label>
                {canCreateProject && (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateProject('')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>+ 手動建立專案</span>
                  </button>
                )}
              </div>
              <ProjectCombobox
                value={formData.projectId}
                projectName={formData.projectName}
                projects={projectList}
                onChange={handleProjectChange}
                canCreateProject={canCreateProject}
                onOpenCreateProject={handleOpenCreateProject}
              />
            </div>

            <div>
              <Label className="text-sm font-semibold text-gray-700">關聯客戶 (可選)</Label>
              <ClientCombobox
                value={formData.customerId}
                customerName={formData.customerName}
                clients={clients}
                onChange={handleCustomerChange}
              />
            </div>
          </div>

          {/* 出差人員 (支援手動輸入 + 下拉選擇，以及依客戶別篩選人名) */}
          <div className="space-y-2 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <Label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                <span>出差參與人員 <span className="text-red-500">*</span></span>
              </Label>

              {/* 依客戶別過濾人名 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                  <Filter className="w-3 h-3 text-slate-400" />
                  依公司別篩選：
                </span>
                <select
                  value={travelerClientFilter}
                  onChange={(e) => setTravelerClientFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="all">🏢 全部公司 / 所有成員</option>
                  {companyFilterOptions.map((cName) => (
                    <option key={cName} value={cName}>
                      {cName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between">
              <span>
                💡 支援直接手動輸入任意姓名，或點選右側下拉選單快速帶入同仁名單
              </span>
              <button
                type="button"
                onClick={handleAddTraveler}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer ml-auto shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ 增加人員</span>
              </button>
            </div>

            <div className="space-y-2 mt-2">
              {formData.travelers.map((traveler, index) => (
                <div key={index} className="flex items-center gap-2">
                  {/* 手動輸入 + datalist 智慧補齊 */}
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      list={`traveler-datalist-${index}`}
                      value={traveler}
                      onChange={(e) => handleTravelerChange(index, e.target.value)}
                      placeholder="手動輸入姓名或點右側快速選取"
                      className="text-sm bg-white"
                    />
                    <datalist id={`traveler-datalist-${index}`}>
                      {filteredPersonnelOptions.map((p) => (
                        <option
                          key={`${p.name}-${p.id}`}
                          value={p.name}
                        >
                          {p.name} {p.clientName || p.department ? `(${[p.clientName, p.department].filter(Boolean).join(' · ')})` : ''}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {/* 下拉式快速選取 */}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleTravelerChange(index, e.target.value);
                      }
                    }}
                    className="w-36 sm:w-44 px-2 py-2 border rounded-md text-xs bg-white hover:bg-slate-50 text-slate-700 cursor-pointer focus:ring-1 focus:ring-blue-500 shrink-0"
                    title="從已篩選名單中快速選取帶入"
                  >
                    <option value="">▼ 快速選擇人員...</option>
                    {filteredPersonnelOptions.map((p) => (
                      <option key={`${p.name}-${p.id}`} value={p.name}>
                        {p.name} {p.clientName || p.department ? `(${[p.clientName, p.department].filter(Boolean).join(' · ')})` : ''}
                      </option>
                    ))}
                  </select>

                  {formData.travelers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTraveler(index)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded transition shrink-0 cursor-pointer"
                      title="移除此人員"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {errors.travelers && <p className="text-xs text-red-500 mt-1">{errors.travelers}</p>}
          </div>

          {/* 日期與時間 (4 欄) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50/60 p-3.5 rounded-xl border border-gray-100">
            <div>
              <Label className="text-xs font-semibold text-gray-600">開始日期 *</Label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    startDate: newStart,
                    endDate: prev.endDate < newStart ? newStart : prev.endDate,
                  }));
                }}
                className="w-full mt-1 px-3 py-1.5 border rounded-md text-sm bg-white"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600">開始時間 *</Label>
              <select
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 border rounded-md text-sm bg-white"
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600">結束日期 *</Label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 border rounded-md text-sm bg-white"
              />
              {errors.endDate && <p className="text-[11px] text-red-500 mt-0.5">{errors.endDate}</p>}
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600">結束時間 *</Label>
              <select
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 border rounded-md text-sm bg-white"
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 負責 PM、TPM 與 確認狀態 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 負責 PM */}
            <div>
              <Label className="text-sm font-semibold text-gray-700">
                負責 PM (可選)
              </Label>
              <div className="flex items-center gap-1.5 mt-1">
                {/* 手動輸入 + datalist 提示 */}
                <div className="relative flex-1">
                  <Input
                    list="pm-options-list"
                    value={formData.pm}
                    onChange={(e) => setFormData({ ...formData, pm: e.target.value })}
                    placeholder="輸入或選 PM"
                    className="text-sm bg-white"
                  />
                  <datalist id="pm-options-list">
                    {pmOptions.map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>

                {/* 下拉式快速選單 */}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setFormData((prev) => ({ ...prev, pm: e.target.value }));
                    }
                  }}
                  className="w-24 px-1.5 py-2 border rounded-md text-xs bg-white text-slate-700 cursor-pointer shrink-0"
                  title="從名單快速點選帶入 PM"
                >
                  <option value="">▼ 挑選...</option>
                  {pmOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* TPM 負責人 */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700">
                  TPM 負責人 (可選)
                </Label>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-0.5 font-medium">
                  <Sparkles className="w-2.5 h-2.5" />
                  燁輝 TPM
                </span>
              </div>

              <div className="flex items-center gap-1.5 mt-1">
                {/* 手動輸入 + datalist 提示 */}
                <div className="relative flex-1">
                  <Input
                    list="tpm-options-list"
                    value={formData.tpm}
                    onChange={(e) => setFormData({ ...formData, tpm: e.target.value })}
                    placeholder="輸入或選 TPM 窗口"
                    className="text-sm bg-white"
                  />
                  <datalist id="tpm-options-list">
                    {tpmOptions.map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>

                {/* 下拉式快速選單 */}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setFormData((prev) => ({ ...prev, tpm: e.target.value }));
                    }
                  }}
                  className="w-24 px-1.5 py-2 border rounded-md text-xs bg-white text-slate-700 cursor-pointer shrink-0"
                  title="從名單快速點選帶入 TPM"
                >
                  <option value="">▼ 挑選...</option>
                  {tpmOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[10px] text-slate-500 mt-1">
                💡 TPM 負責人僅列出燁輝 TPM 窗口同仁。
              </p>
            </div>

            {/* 行程確認狀態 */}
            <div>
              <Label className="text-sm font-semibold text-gray-700">行程確認狀態</Label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TripStatus })}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">⏳ 待確認 (Pending)</option>
                <option value="confirmed">✅ 已確認 (Confirmed)</option>
              </select>
            </div>
          </div>

          {/* 燁輝廠區專屬：便當代訂數量 (僅當關聯客戶包含燁輝且非線上會議時顯示) */}
          {isYiehPhui && formData.category !== 'online_meeting' && (
            <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-3 transition-all animate-fadeIn">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                  <span className="text-base">🍱</span>
                  <span>燁輝廠區便當代訂數量</span>
                  <span className="text-xs font-normal text-amber-700 hidden sm:inline">
                    (至廠調校/會議代訂登記)
                  </span>
                </Label>
                <span className="text-xs font-bold text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full border border-amber-300">
                  目前便當數: {formData.lunchBoxes || 0} 個
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 快速常用數量按鈕 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, lunchBoxes: num }))}
                      className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer border ${
                        formData.lunchBoxes === num
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-amber-100 hover:border-amber-300'
                      }`}
                    >
                      {num === 0 ? '無 (0)' : `${num} 個`}
                    </button>
                  ))}
                </div>

                {/* 步進輸入調整器 */}
                <div className="flex items-center border border-amber-300 rounded-lg overflow-hidden bg-white shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        lunchBoxes: Math.max(0, (prev.lunchBoxes || 0) - 1),
                      }))
                    }
                    className="px-2.5 py-1 text-gray-600 hover:bg-amber-100 text-sm font-bold cursor-pointer"
                    title="減少 1 個"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.lunchBoxes || 0}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        lunchBoxes: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    className="w-12 text-center text-sm py-1 border-0 focus:outline-hidden font-bold text-amber-950"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        lunchBoxes: (prev.lunchBoxes || 0) + 1,
                      }))
                    }
                    className="px-2.5 py-1 text-gray-600 hover:bg-amber-100 text-sm font-bold cursor-pointer"
                    title="增加 1 個"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-amber-800/80">
                ※ 此欄位將同步呈現於月曆卡片、週檢視總表與出差明細，方便總務及廠區同仁提前代訂餐點。
              </p>
            </div>
          )}

          {/* 出差重點彙整 (Key Takeaways) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm font-semibold text-gray-700">
                出差重點彙整 (Key Takeaways)
              </Label>
              <span className="text-xs text-gray-400">出差結束後3天內需補填</span>
            </div>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              placeholder="1. 本次出差核心結論與決議...&#10;2. 後續待辦事項與指派負責人...&#10;3. 現場異常或需列管風險..."
              className="font-mono text-sm leading-relaxed"
            />
          </div>

          <DialogFooter className="sticky bottom-0 bg-white pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? '儲存中...' : trip ? '更新行程' : '建立行程'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* 建立新專案彈窗 (僅具管理員或編輯者權限開放) */}
    <NewPocProjectDialog
      open={isCreateProjectOpen}
      onOpenChange={setIsCreateProjectOpen}
      users={users}
      clients={clients}
      defaultName={createProjectDefaultName}
      defaultClientName={formData.customerName || '燁輝'}
      onSuccess={handleProjectCreatedSuccess}
    />
  </>
  );
}
