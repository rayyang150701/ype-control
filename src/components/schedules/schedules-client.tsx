'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Download,
  Plus,
  RefreshCw,
  AlertTriangle,
  CalendarDays,
  FileSpreadsheet,
  BarChart3,
  ArrowDownToLine,
  Lock,
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  ChevronLeft,
  List,
  ClipboardList,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdmin } from '@/components/admin-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  BusinessTrip,
  CalendarViewType,
  TripFilter,
  WeekInfo,
  Holiday,
  TRIP_CATEGORIES,
  TripCategory,
} from '@/types/businessTrip';
import type { Client, Project, User } from '@/types';
import {
  getCurrentWeek,
  getYearWeeks,
  formatDate,
  isTripReportOverdue,
  isTripEndedWithoutReport,
} from '@/lib/calendar-helper';
import { getYiehPhuiTpmNames, isTpmPerson } from '@/lib/tpm-helper';
import {
  getBusinessTrips,
  createBusinessTrip,
  updateBusinessTrip,
  deleteBusinessTrip,
  updateBusinessTripStatus,
  getHolidays,
  getAllProjectsForInternal,
} from '@/lib/actions';

import { MonthView } from './month-view';
import { WeekView } from './week-view';
import { ScheduleListView } from './schedule-list-view';
import { OverdueView } from './overdue-view';
import { UnreportedView } from './unreported-view';
import { TravelAnalyticsView } from './travel-analytics-view';
import { TripFormDialog } from './trip-form-dialog';
import { TripDetailDialog } from './trip-detail-dialog';
import { HolidayManagementDialog } from './holiday-management-dialog';

interface SchedulesClientProps {
  initialTrips: BusinessTrip[];
  initialClients: Client[];
  initialProjects: Project[];
  initialUsers: User[];
  initialHolidays: Holiday[];
}

export function SchedulesClient({
  initialTrips,
  initialClients,
  initialProjects,
  initialUsers,
  initialHolidays,
}: SchedulesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { permissions, isLoaded, setIsLoginDialogOpen, currentUser } = useAdmin();

  // 視圖切換狀態
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentWeek, setCurrentWeek] = useState<WeekInfo>(getCurrentWeek());

  // 資料狀態
  const [trips, setTrips] = useState<BusinessTrip[]>(initialTrips);
  const [clients] = useState<Client[]>(() => initialClients.filter((c) => !c.name?.startsWith('__')));
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [users] = useState<User[]>(initialUsers);
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);

  // UI 狀態
  const [filter, setFilter] = useState<TripFilter>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTripForm, setShowTripForm] = useState(false);
  const [showTripDetail, setShowTripDetail] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<BusinessTrip | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [isSyncingNotion, setIsSyncingNotion] = useState(false);
  const [lastNotionSync, setLastNotionSync] = useState<string | null>(null);

  // 監聽 URL 參數：支援從待辦事項一鍵跳轉至「新增行程 / 會議」
  useEffect(() => {
    if (!searchParams) return;
    const isNew = searchParams.get('newTrip') === 'true' || searchParams.get('createTrip') === 'true';
    if (!isNew) return;

    const subject = searchParams.get('subject') || searchParams.get('title') || '';
    const projectId = searchParams.get('projectId') || '';
    const projectName = searchParams.get('projectName') || '';
    const customerId = searchParams.get('customerId') || '';
    const customerName = searchParams.get('customerName') || '';
    const dueDate = searchParams.get('dueDate') || searchParams.get('date') || '';
    const notes = searchParams.get('notes') || '';
    const waitingOn = searchParams.get('waitingOn') || '';
    const rawCategory = searchParams.get('category');
    const location = searchParams.get('location') || '';
    const meetingUrl = searchParams.get('meetingUrl') || '';

    let category: TripCategory = 'business';
    if (rawCategory && ['business', 'meeting', 'online_meeting', 'other'].includes(rawCategory)) {
      category = rawCategory as TripCategory;
    } else if (meetingUrl) {
      category = 'online_meeting';
    } else {
      const lower = (subject + ' ' + notes).toLowerCase();
      if (lower.includes('線上') || lower.includes('視訊') || lower.includes('teams') || lower.includes('meet') || lower.includes('zoom')) {
        category = 'online_meeting';
      } else if (lower.includes('會議') || lower.includes('開會') || lower.includes('訪談') || lower.includes('討論') || lower.includes('審查')) {
        category = 'meeting';
      }
    }

    const matchedProject = projects.find((p) => p.id === projectId || (p.name && projectName && p.name === projectName));
    const matchedClient = clients.find((c) => c.id === customerId || (c.name && customerName && c.name === customerName));

    const travelers = waitingOn ? [waitingOn] : [''];
    const tripDate = dueDate ? dueDate.slice(0, 10) : formatDate(new Date());

    const prefilledTrip: BusinessTrip = {
      id: '',
      subject: subject || '待辦事項會議',
      projectId: matchedProject?.id || projectId,
      projectName: matchedProject?.name || projectName,
      customerId: matchedClient?.id || customerId,
      customerName: matchedClient?.name || customerName || matchedProject?.clientName || '',
      travelers,
      location: location || (category === 'online_meeting' ? '線上會議' : ''),
      meetingUrl: meetingUrl || undefined,
      startDate: tripDate,
      endDate: tripDate,
      startTime: '09:00',
      endTime: '10:00',
      category,
      status: 'pending',
      lunchBoxes: 0,
      notes: notes ? `來源待辦事項：\n${notes}` : (subject ? `由待辦事項「${subject}」轉入` : ''),
    };

    setSelectedTrip(prefilledTrip);
    setSelectedDate(new Date(tripDate + 'T00:00:00'));
    setShowTripForm(true);

    // 清理 URL 參數避免後續重整時重複開啟
    router.replace('/schedules', { scroll: false });
  }, [searchParams, projects, clients, router]);

  // 重新載入行程與假日資料
  const reloadData = async () => {
    try {
      setIsRefreshing(true);
      const [tripsData, holidaysData, projectsData] = await Promise.all([
        getBusinessTrips(),
        getHolidays(),
        getAllProjectsForInternal(),
      ]);
      setTrips(tripsData);
      setHolidays(holidaysData);
      if (projectsData) {
        setProjects(projectsData as any);
      }
      toast({ title: '更新完成', description: '出差行程資料已同步最新狀態' });
    } catch (err: any) {
      console.error('重新載入行程失敗:', err);
      toast({
        variant: 'destructive',
        title: '更新失敗',
        description: err?.message || '載入行程資料發生錯誤',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Notion 手動同步（觸發 /api/sync/from-notion）
  const handleNotionSync = async () => {
    try {
      setIsSyncingNotion(true);
      toast({ title: '同步中…', description: '正在從 Notion 拉取最新行程資料' });

      const res = await fetch('/api/sync/from-notion', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        const { created, updated, errors: errCount } = data.stats;
        setLastNotionSync(new Date().toLocaleTimeString('zh-TW'));
        toast({
          title: '✅ Notion 同步完成',
          description: `新增 ${created} 筆，更新 ${updated} 筆${errCount > 0 ? `，${errCount} 筆錯誤` : ''}`,
        });
        await reloadData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Notion 同步失敗',
          description: data.error || '同步時發生錯誤，請確認 Notion 設定',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Notion 同步失敗',
        description: err?.message || '網路錯誤，請稍後再試',
      });
    } finally {
      setIsSyncingNotion(false);
    }
  };

  // ⚡ 智慧背景自動同步：進入頁面或每 10 分鐘自動在背景比對 Notion，完全不需手動點擊
  useEffect(() => {
    let isMounted = true;

    const checkAndAutoSync = async () => {
      try {
        const lastSyncTimeStr = localStorage.getItem('last_notion_auto_sync_time');
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;

        // 若距上次同步已超過 10 分鐘（或首次載入）
        if (!lastSyncTimeStr || now - parseInt(lastSyncTimeStr, 10) > tenMinutes) {
          localStorage.setItem('last_notion_auto_sync_time', now.toString());

          const res = await fetch('/api/sync/from-notion', { method: 'POST' });
          const data = await res.json();

          if (isMounted && data.success) {
            setLastNotionSync(new Date().toLocaleTimeString('zh-TW'));
            // 若 Notion 有任何更新或新增，靜默更新行程清單
            if (data.stats && (data.stats.created > 0 || data.stats.updated > 0)) {
              const tripsData = await getBusinessTrips();
              if (isMounted) {
                setTrips(tripsData);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Notion AutoSync] 背景同步略過:', err);
      }
    };

    // 1. 進入頁面時立即檢查
    checkAndAutoSync();

    // 2. 頁面開啟時每 10 分鐘自動比對一次
    const timer = setInterval(checkAndAutoSync, 10 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // 前端過濾行程（支援統一關鍵字、客戶、專案、類別、狀態、TPM、週別）
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      // 關鍵字搜尋 (主題、人員、專案、地點、客戶、PM、TPM)
      if (filter.searchKeyword) {
        const kw = filter.searchKeyword.toLowerCase();
        const matchSubject = trip.subject?.toLowerCase().includes(kw);
        const matchProject = trip.projectName?.toLowerCase().includes(kw);
        const matchCustomer = trip.customerName?.toLowerCase().includes(kw);
        const matchLocation = trip.location?.toLowerCase().includes(kw);
        const matchTravelers = trip.travelers?.some((t) => t.toLowerCase().includes(kw));
        const matchPm = trip.pm?.toLowerCase().includes(kw);
        const matchTpm = trip.tpm?.toLowerCase().includes(kw);
        if (!matchSubject && !matchProject && !matchCustomer && !matchLocation && !matchTravelers && !matchPm && !matchTpm) {
          return false;
        }
      }

      // 客戶篩選
      if (filter.customerId) {
        if (trip.customerId !== filter.customerId) {
          // 若無 customerId，比對客戶名稱
          const matchedClient = clients.find((c) => c.id === filter.customerId);
          if (!matchedClient || trip.customerName !== matchedClient.name) {
            return false;
          }
        }
      }

      // 專案篩選
      if (filter.projectId && trip.projectId !== filter.projectId) {
        return false;
      }

      // 負責 PM 篩選 (支援行程本身填寫之 PM 或專案負責 PM，絕不混入 TPM 窗口)
      if (filter.pm) {
        const project = trip.projectId ? projects.find((p) => p.id === trip.projectId) : undefined;
        const tripPm = trip.pm || project?.responsiblePm;
        if (tripPm !== filter.pm) {
          return false;
        }
      }

      // 類別篩選
      if (filter.category && trip.category !== filter.category) {
        return false;
      }

      // 狀態篩選
      if (filter.status && trip.status !== filter.status) {
        return false;
      }

      // TPM 篩選 (支援全名或純姓名比對，排除外層多餘引號與分機號差異)
      if (filter.tpm) {
        const tripTpm = (trip.tpm || '').replace(/["'“”]/g, '').trim();
        const selectedTpm = filter.tpm.replace(/["'“”]/g, '').trim();
        const isMatch =
          tripTpm === selectedTpm ||
          tripTpm.includes(selectedTpm) ||
          selectedTpm.includes(tripTpm) ||
          ((selectedTpm.includes('陳家姷') || selectedTpm.includes('陳家炳')) && (tripTpm.includes('陳家姷') || tripTpm.includes('陳家炳')));
        if (!isMatch) {
          return false;
        }
      }

      return true;
    });
  }, [trips, filter, clients, projects]);

  // 週切換
  const handlePrevWeek = () => {
    const allWeeks = getYearWeeks(currentWeek.year);
    const currentIndex = allWeeks.findIndex((w) => w.weekNumber === currentWeek.weekNumber);

    if (currentIndex > 0) {
      setCurrentWeek(allWeeks[currentIndex - 1]);
    } else {
      const prevYearWeeks = getYearWeeks(currentWeek.year - 1);
      setCurrentWeek(prevYearWeeks[prevYearWeeks.length - 1]);
    }
  };

  const handleNextWeek = () => {
    const allWeeks = getYearWeeks(currentWeek.year);
    const currentIndex = allWeeks.findIndex((w) => w.weekNumber === currentWeek.weekNumber);

    if (currentIndex < allWeeks.length - 1) {
      setCurrentWeek(allWeeks[currentIndex + 1]);
    } else {
      const nextYearWeeks = getYearWeeks(currentWeek.year + 1);
      setCurrentWeek(nextYearWeeks[0]);
    }
  };

  // 點擊新增行程
  const handleOpenCreateForm = (date?: Date) => {
    if (!permissions.schedules.canManage) {
      toast({
        title: '權限不足',
        description: '您的角色權限為「僅能檢視」，無法新增行程。',
        variant: 'destructive',
      });
      return;
    }
    setSelectedTrip(null);
    setSelectedDate(date || null);
    setShowTripForm(true);
  };

  // 點擊查看詳情
  const handleTripClick = (trip: BusinessTrip) => {
    setSelectedTrip(trip);
    setShowTripDetail(true);
  };

  // 點擊編輯行程
  const handleEditTrip = (trip: BusinessTrip) => {
    if (!permissions.schedules.canManage) {
      toast({
        title: '權限不足',
        description: '您的角色權限為「僅能檢視」，無法編輯行程。',
        variant: 'destructive',
      });
      return;
    }
    setSelectedTrip(trip);
    setShowTripDetail(false);
    setShowTripForm(true);
  };

  // 儲存行程（新增或更新）
  const handleSaveTrip = async (
    tripData: Omit<BusinessTrip, 'id' | 'createdAt' | 'updatedAt'>,
    batchDates?: string[]
  ) => {
    const operator = currentUser ? {
      uid: currentUser.uid,
      name: currentUser.displayName || currentUser.username || currentUser.email,
      email: currentUser.email,
      role: currentUser.role,
      department: currentUser.department,
    } : undefined;

    if (selectedTrip && selectedTrip.id) {
      const res = await updateBusinessTrip(selectedTrip.id, tripData, operator);
      if (res.success) {
        toast({ title: '更新成功', description: '行程資料已成功更新' });
        setShowTripForm(false);
        setSelectedTrip(null);
        await reloadData();
      } else {
        toast({ variant: 'destructive', title: '更新失敗', description: res.message });
      }
    } else if (batchDates && batchDates.length > 0) {
      // 批次多日新增模式：逐筆建立相同內容的行程
      let successCount = 0;
      let failCount = 0;
      for (const dateStr of batchDates) {
        const res = await createBusinessTrip({
          ...tripData,
          startDate: dateStr,
          endDate: dateStr,
        }, operator);
        if (res.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      if (failCount === 0) {
        toast({
          title: `批次建立成功 🎉`,
          description: `已成功建立 ${successCount} 筆行程（${batchDates.map((d) => {
            const dt = new Date(d + 'T00:00:00');
            return `${dt.getMonth() + 1}/${dt.getDate()}`;
          }).join('、')}）`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: `部分建立失敗`,
          description: `成功 ${successCount} 筆，失敗 ${failCount} 筆，請確認後重試`,
        });
      }
      setShowTripForm(false);
      setSelectedDate(null);
      await reloadData();
    } else {
      const res = await createBusinessTrip(tripData, operator);
      if (res.success) {
        toast({ title: '建立成功', description: '新出差行程已成功建立' });
        setShowTripForm(false);
        setSelectedDate(null);
        await reloadData();
      } else {
        toast({ variant: 'destructive', title: '建立失敗', description: res.message });
      }
    }
  };

  // 刪除行程
  const handleDeleteTrip = async (trip?: BusinessTrip) => {
    if (!permissions.schedules.canManage) {
      toast({
        title: '權限不足',
        description: '您的角色權限為「僅能檢視」，無法刪除行程。',
        variant: 'destructive',
      });
      return;
    }
    const target = trip || selectedTrip;
    if (!target) return;

    if (!confirm(`確定要刪除「${target.subject}」這筆出差行程嗎？`)) return;

    try {
      const operator = currentUser ? {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.username || currentUser.email,
        email: currentUser.email,
        role: currentUser.role,
        department: currentUser.department,
      } : undefined;

      const res = await deleteBusinessTrip(target.id, operator);
      if (res.success) {
        toast({ title: '刪除成功', description: res.message });
        setShowTripDetail(false);
        setSelectedTrip(null);
        await reloadData();
      } else {
        toast({ variant: 'destructive', title: '刪除失敗', description: res.message });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '刪除失敗', description: err.message });
    }
  };

  // 切換確認狀態
  const handleStatusChange = async (newStatus: 'confirmed' | 'pending') => {
    if (!permissions.schedules.canManage) {
      toast({
        title: '權限不足',
        description: '您的角色權限為「僅能檢視」，無法修改行程確認狀態。',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedTrip) return;

    try {
      const operator = currentUser ? {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.username || currentUser.email,
        email: currentUser.email,
        role: currentUser.role,
        department: currentUser.department,
      } : undefined;

      const res = await updateBusinessTripStatus(selectedTrip.id, newStatus, operator);
      if (res.success) {
        toast({
          title: '狀態已變更',
          description: newStatus === 'confirmed' ? '行程已標記為已確認' : '行程已改為待確認',
        });
        setSelectedTrip({ ...selectedTrip, status: newStatus });
        await reloadData();
      } else {
        toast({ variant: 'destructive', title: '更新狀態失敗', description: res.message });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '操作失敗', description: err.message });
    }
  };


  // 匯出 CSV (以 UTF-8 BOM 格式)
  const handleExportCSV = () => {
    try {
      const headers = [
        '主題',
        '客戶',
        '專案',
        '地點',
        '開始日期',
        '開始時間',
        '結束日期',
        '結束時間',
        '出差人員',
        '類別',
        '負責PM',
        'TPM',
        '確認狀態',
        '出差重點彙整',
      ];

      const rows = filteredTrips.map((trip) => [
        trip.subject || '',
        trip.customerName || '',
        trip.projectName || '',
        trip.location || '',
        trip.startDate || '',
        trip.startTime || '',
        trip.endDate || '',
        trip.endTime || '',
        trip.travelers?.join('; ') || '',
        TRIP_CATEGORIES.find((c) => c.value === trip.category)?.label || trip.category || '',
        trip.pm || '',
        trip.tpm || '',
        trip.status === 'confirmed' ? '已確認' : '待確認',
        trip.notes ? trip.notes.replace(/\r?\n/g, ' ') : '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `出差行程報表_${formatDate(new Date())}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: '匯出成功', description: '出差行程 CSV 檔案已成功下載' });
    } catch (err) {
      console.error('匯出 CSV 失敗:', err);
      toast({ variant: 'destructive', title: '匯出失敗', description: '匯出 CSV 檔案時發生錯誤' });
    }
  };

  // 側邊欄展開/收合狀態与頂部進階篩選展開狀態
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [showTopAdvancedFilter, setShowTopAdvancedFilter] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('schedules_sidebar_collapsed');
      if (saved === 'true') setIsSidebarCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('schedules_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // 篩選所需下拉清單：負責 PM、燁輝 TPM、當前年份週別
  const allPMs = useMemo(
    () =>
      Array.from(
        new Set([
          ...trips.map((t) => t.pm).filter(Boolean),
          ...projects.map((p) => p.responsiblePm).filter(Boolean),
        ] as string[])
      )
        .filter((pm) => !isTpmPerson(pm))
        .sort(),
    [trips, projects]
  );

  const allTPMs = useMemo(() => getYiehPhuiTpmNames(users || []), [users]);
  const weeks = useMemo(() => getYearWeeks(currentYear), [currentYear]);

  const activeAdvancedCount = [
    filter.customerId,
    filter.projectId,
    filter.pm,
    filter.category,
    filter.status,
    filter.week,
    filter.tpm,
  ].filter(Boolean).length;

  const hasAnyFilter = Boolean(filter.searchKeyword?.trim()) || activeAdvancedCount > 0;

  const handleSearchChange = (val: string) => {
    setFilter((prev) => ({
      ...prev,
      searchKeyword: val || undefined,
    }));
  };

  const handleResetFilter = () => {
    setFilter({});
  };

  // 計算統計數字
  const pendingCount = useMemo(
    () => filteredTrips.filter((t) => t.status === 'pending').length,
    [filteredTrips]
  );

  const overdueCount = useMemo(
    () =>
      trips.filter((t) =>
        isTripReportOverdue(t.endDate, t.endTime, t.notes, t.location, t.travelers)
      ).length,
    [trips]
  );

  const unreportedCount = useMemo(
    () =>
      trips.filter((t) =>
        isTripEndedWithoutReport(t.endDate, t.endTime, t.notes, t.location, t.travelers)
      ).length,
    [trips]
  );

  if (isLoaded && !permissions.schedules.canView) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-slate-200 shadow-md flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1.5">無權限檢視專案行程</h2>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            訪客帳號無法存取「專案行程」，請先登入具備檢視權限的帳號。
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setIsLoginDialogOpen(true)}>登入系統</Button>
            <Button size="sm" variant="outline" onClick={() => router.push('/dashboard')}>返回總表</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full print:space-y-0 print:m-0 print:p-0">
      <div className="flex flex-col lg:flex-row gap-3.5 items-start w-full">
        {/* ============================================================== */}
        {/* 左側可收合側面欄位 (Collapsible Left Sidebar - 選項與操作面板)    */}
        {/* ============================================================== */}
        <aside
          className={`bg-white rounded-2xl border border-slate-200/90 shadow-2xs transition-all duration-300 shrink-0 ${
            isSidebarCollapsed ? 'w-full lg:w-14' : 'w-full lg:w-64 xl:w-68'
          } lg:sticky lg:top-[116px] self-start lg:max-h-[calc(100vh-7.8rem)] flex flex-col overflow-hidden z-20 print:hidden`}
        >
          {isSidebarCollapsed ? (
            <>
              {/* 行動裝置 (< lg) 收合時橫列 */}
              <div className="flex lg:hidden items-center justify-between p-2.5 bg-white w-full">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 shadow-2xs"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
                  <span>展開專案行程選項面板</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {filteredTrips.length} 筆
                  </Badge>
                </button>
                <div className="flex items-center gap-1.5">
                  {permissions.schedules.canManage && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenCreateForm()}
                      className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新增行程</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* 桌面版 (lg+) 直立極簡圖示列 (寬度 56px) */}
              <div className="hidden lg:flex flex-col items-center w-full py-2.5 space-y-2">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200/80 transition-all shadow-2xs"
                  title="展開左側專案行程選項欄"
                >
                  <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                </button>

                {permissions.schedules.canManage && (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateForm()}
                    className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all"
                    title="新增行程"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}

                <div className="w-8 border-t border-slate-200/80 my-1" />

                {/* 視圖切換快捷圖示 */}
                <button
                  type="button"
                  onClick={() => setViewType('month')}
                  className={`w-10 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold transition-all ${
                    viewType === 'month'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="月檢視"
                >
                  <span>月</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewType('week')}
                  className={`w-10 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold transition-all ${
                    viewType === 'week'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="週檢視"
                >
                  <span>週</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewType('list')}
                  className={`w-10 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold transition-all ${
                    viewType === 'list'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="列表檢視"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewType('overdue')}
                  className={`w-10 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold transition-all relative ${
                    viewType === 'overdue'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title={`待補件 (${overdueCount} 筆)`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  <span className="text-[9px] text-red-600 leading-none mt-0.5">{overdueCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewType('unreported')}
                  className={`w-10 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold transition-all relative ${
                    viewType === 'unreported'
                      ? 'bg-orange-50 text-orange-700 border border-orange-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title={`未回報 (${unreportedCount} 筆)`}
                >
                  <ClipboardList className="h-3.5 w-3.5 text-orange-600" />
                  <span className="text-[9px] text-orange-600 leading-none mt-0.5">{unreportedCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewType('analytics')}
                  className={`w-10 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold transition-all ${
                    viewType === 'analytics'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="出差分析"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                </button>

                <div className="w-8 border-t border-slate-200/80 my-1" />

                {/* 動作快捷圖示 */}
                <button
                  type="button"
                  onClick={reloadData}
                  disabled={isRefreshing}
                  className="w-10 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all"
                  title="刷新行程資料"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleNotionSync}
                  disabled={isSyncingNotion}
                  className="w-10 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all"
                  title="Notion 同步"
                >
                  <ArrowDownToLine className={`h-3.5 w-3.5 ${isSyncingNotion ? 'animate-bounce text-blue-600' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-10 h-8 rounded-xl flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-all"
                  title="匯出 CSV"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                </button>
                {permissions.schedules.canManage && (
                  <button
                    type="button"
                    onClick={() => setShowHolidayModal(true)}
                    className="w-10 h-8 rounded-xl flex items-center justify-center text-red-600 hover:bg-red-50 transition-all"
                    title="假日管理"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                  </button>
                )}

                {hasAnyFilter && (
                  <button
                    type="button"
                    onClick={handleResetFilter}
                    className="w-10 h-8 rounded-xl flex items-center justify-center text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all"
                    title="重設所有篩選條件"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </>
          ) : (
            /* 側邊欄展開狀態 */
            <>
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-slate-900">專案行程</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {filteredTrips.length} 筆
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 gap-1 font-semibold"
                  title="縮成直行以放大右側行事曆空間"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>縮成直行</span>
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3.5 text-xs divide-y divide-slate-100">
                {/* 1. 操作選項與統計速覽 */}
                <div className="space-y-2.5">
                  {permissions.schedules.canManage && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenCreateForm()}
                      className="w-full h-8.5 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-2xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>新增出差 / 會議行程</span>
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={reloadData}
                      disabled={isRefreshing}
                      className="h-7.5 text-xs gap-1 justify-center text-slate-700"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>刷新</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNotionSync}
                      disabled={isSyncingNotion}
                      className="h-7.5 text-xs gap-1 justify-center text-slate-700"
                      title={lastNotionSync ? `上次同步：${lastNotionSync}` : '從 Notion 同步最新行程'}
                    >
                      <ArrowDownToLine className={`w-3 h-3 ${isSyncingNotion ? 'animate-bounce' : ''}`} />
                      <span>{isSyncingNotion ? '同步中' : 'Notion同步'}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCSV}
                      className="h-7.5 text-xs gap-1 justify-center text-slate-700"
                    >
                      <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                      <span>匯出 CSV</span>
                    </Button>
                    {permissions.schedules.canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowHolidayModal(true)}
                        className="h-7.5 text-xs gap-1 justify-center text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <CalendarDays className="w-3 h-3 text-red-600" />
                        <span>假日管理</span>
                      </Button>
                    )}
                  </div>

                  {/* 狀態指標膠囊 (點擊可快速切換或篩選) */}
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setFilter((prev) => ({
                          ...prev,
                          status: prev.status === 'pending' ? undefined : 'pending',
                        }))
                      }
                      className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        filter.status === 'pending'
                          ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                          : 'bg-amber-50/60 border-amber-200/80 text-amber-800 hover:bg-amber-100/70'
                      }`}
                      title="點擊篩選待確認行程"
                    >
                      <div className="text-[10px] text-amber-700">待確認</div>
                      <div className="text-xs font-extrabold">{pendingCount}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewType('overdue')}
                      className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        viewType === 'overdue'
                          ? 'bg-red-100 border-red-400 text-red-900 font-bold'
                          : 'bg-red-50/60 border-red-200/80 text-red-700 hover:bg-red-100/70'
                      }`}
                      title="點擊檢視待補出差報告"
                    >
                      <div className="text-[10px] text-red-600">待補報告</div>
                      <div className="text-xs font-extrabold">{overdueCount}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewType('unreported')}
                      className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        viewType === 'unreported'
                          ? 'bg-orange-100 border-orange-400 text-orange-900 font-bold'
                          : 'bg-orange-50/60 border-orange-200/80 text-orange-700 hover:bg-orange-100/70'
                      }`}
                      title="點擊檢視未回報行程"
                    >
                      <div className="text-[10px] text-orange-600">未回報</div>
                      <div className="text-xs font-extrabold">{unreportedCount}</div>
                    </button>
                  </div>
                </div>

                {/* 2. 行程類別快速切換 */}
                <div className="pt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">行程類別</span>
                    {filter.category && (
                      <button
                        type="button"
                        onClick={() => setFilter((prev) => ({ ...prev, category: undefined }))}
                        className="text-[10px] text-blue-600 hover:underline"
                      >
                        顯示全部
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setFilter((prev) => ({ ...prev, category: undefined }))}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        !filter.category
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      全部
                    </button>
                    {TRIP_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() =>
                          setFilter((prev) => ({
                            ...prev,
                            category: prev.category === cat.value ? undefined : cat.value,
                          }))
                        }
                        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          filter.category === cat.value
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. 多維度篩選選項 */}
                <div className="pt-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">進階篩選選項</span>
                    {hasAnyFilter && (
                      <button
                        type="button"
                        onClick={handleResetFilter}
                        className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-0.5"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>重設</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">客戶單位</label>
                    <select
                      value={filter.customerId || ''}
                      onChange={(e) => setFilter({ ...filter, customerId: e.target.value || undefined })}
                      className="w-full h-7.5 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">全部客戶</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.code ? `(${c.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">所屬專案</label>
                    <select
                      value={filter.projectId || ''}
                      onChange={(e) => setFilter({ ...filter, projectId: e.target.value || undefined })}
                      className="w-full h-7.5 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 truncate"
                    >
                      <option value="">全部專案</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">負責 PM</label>
                      <select
                        value={filter.pm || ''}
                        onChange={(e) => setFilter({ ...filter, pm: e.target.value || undefined })}
                        className="w-full h-7.5 px-1.5 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 truncate"
                      >
                        <option value="">全部 PM</option>
                        {allPMs.map((pm) => (
                          <option key={pm} value={pm}>
                            {pm}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">TPM 窗口</label>
                      <select
                        value={filter.tpm || ''}
                        onChange={(e) => setFilter({ ...filter, tpm: e.target.value || undefined })}
                        className="w-full h-7.5 px-1.5 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 truncate"
                      >
                        <option value="">全部 TPM</option>
                        {allTPMs.map((tpm) => (
                          <option key={tpm} value={tpm}>
                            {tpm}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">確認狀態</label>
                      <select
                        value={filter.status || ''}
                        onChange={(e) => setFilter({ ...filter, status: (e.target.value as any) || undefined })}
                        className="w-full h-7.5 px-1.5 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">全部狀態</option>
                        <option value="confirmed">已確認</option>
                        <option value="pending">待確認</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">快速週別</label>
                      <select
                        value={filter.week || ''}
                        onChange={(e) => {
                          const w = e.target.value ? Number(e.target.value) : undefined;
                          setFilter({ ...filter, week: w, year: w ? currentYear : undefined });
                          if (w) {
                            const targetWeek = weeks.find((item) => item.weekNumber === w);
                            if (targetWeek) {
                              setViewType('week');
                              setCurrentWeek(targetWeek);
                            }
                          }
                        }}
                        className="w-full h-7.5 px-1.5 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 truncate"
                      >
                        <option value="">不限週別</option>
                        {weeks.map((w) => (
                          <option key={w.weekNumber} value={w.weekNumber}>
                            {w.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>

        {/* ============================================================== */}
        {/* 右側主內容區：最上方置頂檢視列 (含出差分析旁的搜尋/篩選) + 行事曆內容 */}
        {/* ============================================================== */}
        <div className="flex-1 min-w-0 w-full space-y-3">
          {/* 置頂檢視與搜尋篩選合一工具列 (sticky 固定於頂部導覽列下方，不隨畫面捲動消失) */}
          <div className="sticky top-[112px] z-30 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 rounded-xl border border-slate-200 shadow-xs px-3 py-1.5 space-y-2 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* 左側：月檢視、週檢視、列表檢視、待補件、未回報、出差分析 */}
              <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setViewType('month')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition cursor-pointer ${
                    viewType === 'month'
                      ? 'bg-blue-50 text-blue-700 font-bold shadow-2xs border border-blue-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  月檢視
                </button>

                <button
                  type="button"
                  onClick={() => setViewType('week')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition cursor-pointer ${
                    viewType === 'week'
                      ? 'bg-blue-50 text-blue-700 font-bold shadow-2xs border border-blue-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  週檢視
                </button>

                <button
                  type="button"
                  onClick={() => setViewType('list')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition cursor-pointer ${
                    viewType === 'list'
                      ? 'bg-blue-50 text-blue-700 font-bold shadow-2xs border border-blue-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  列表檢視
                </button>

                <button
                  type="button"
                  onClick={() => setViewType('overdue')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    viewType === 'overdue'
                      ? 'bg-red-50 text-red-700 font-bold shadow-2xs border border-red-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span>待補件</span>
                  {overdueCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-red-600 text-white text-[10px] font-extrabold rounded-full">
                      {overdueCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setViewType('unreported')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    viewType === 'unreported'
                      ? 'bg-orange-50 text-orange-700 font-bold shadow-2xs border border-orange-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <span>📋</span>
                  <span>未回報</span>
                  {unreportedCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-orange-500 text-white text-[10px] font-extrabold rounded-full">
                      {unreportedCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setViewType('analytics')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    viewType === 'analytics'
                      ? 'bg-blue-50 text-blue-700 font-bold shadow-2xs border border-blue-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>出差分析</span>
                </button>
              </div>

              {/* 右側：緊鄰出差分析旁之搜尋框與篩選按鈕 */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial justify-end min-w-[240px]">
                <div className="relative flex-1 sm:w-60 md:w-72">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <Input
                    value={filter.searchKeyword || ''}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="搜尋人員 / 主題 / 專案 / 地點..."
                    className="pl-8 pr-7 h-8 text-xs bg-slate-50/70 border-slate-200 focus:bg-white transition-colors"
                  />
                  {filter.searchKeyword && (
                    <button
                      type="button"
                      onClick={() => handleSearchChange('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTopAdvancedFilter((prev) => !prev)}
                  className={`h-8 px-2.5 text-xs gap-1 shrink-0 transition-colors ${
                    showTopAdvancedFilter || activeAdvancedCount > 0
                      ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 border-slate-200'
                  }`}
                  title="展開或收合進階篩選下拉選單"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>篩選</span>
                  {activeAdvancedCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                      {activeAdvancedCount}
                    </span>
                  )}
                </Button>

                {hasAnyFilter && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilter}
                    className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 shrink-0"
                    title="清除所有搜尋與篩選條件"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">重設</span>
                  </Button>
                )}
              </div>
            </div>

            {/* 若點擊頂部「篩選」按鈕，在置頂列內展開精簡橫向篩選列 */}
            {showTopAdvancedFilter && (
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">客戶單位</label>
                  <select
                    value={filter.customerId || ''}
                    onChange={(e) => setFilter({ ...filter, customerId: e.target.value || undefined })}
                    className="w-full h-7.5 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700"
                  >
                    <option value="">全部客戶</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">所屬專案</label>
                  <select
                    value={filter.projectId || ''}
                    onChange={(e) => setFilter({ ...filter, projectId: e.target.value || undefined })}
                    className="w-full h-7.5 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700 truncate"
                  >
                    <option value="">全部專案</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">負責 PM</label>
                  <select
                    value={filter.pm || ''}
                    onChange={(e) => setFilter({ ...filter, pm: e.target.value || undefined })}
                    className="w-full h-7.5 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700 truncate"
                  >
                    <option value="">全部 PM</option>
                    {allPMs.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">行程類別</label>
                  <select
                    value={filter.category || ''}
                    onChange={(e) => setFilter({ ...filter, category: (e.target.value as TripCategory) || undefined })}
                    className="w-full h-7.5 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700"
                  >
                    <option value="">全部類別</option>
                    {TRIP_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">確認狀態</label>
                  <select
                    value={filter.status || ''}
                    onChange={(e) => setFilter({ ...filter, status: (e.target.value as any) || undefined })}
                    className="w-full h-7.5 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700"
                  >
                    <option value="">全部狀態</option>
                    <option value="confirmed">已確認</option>
                    <option value="pending">待確認</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">快速週別 (WK)</label>
                  <select
                    value={filter.week || ''}
                    onChange={(e) => {
                      const w = e.target.value ? Number(e.target.value) : undefined;
                      setFilter({ ...filter, week: w, year: w ? currentYear : undefined });
                      if (w) {
                        const targetWeek = weeks.find((item) => item.weekNumber === w);
                        if (targetWeek) {
                          setViewType('week');
                          setCurrentWeek(targetWeek);
                        }
                      }
                    }}
                    className="w-full h-7.5 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700"
                  >
                    <option value="">不限週別</option>
                    {weeks.map((w) => (
                      <option key={w.weekNumber} value={w.weekNumber}>
                        {w.label} ({w.startDate.getMonth() + 1}/{w.startDate.getDate()}~{w.endDate.getMonth() + 1}/{w.endDate.getDate()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">TPM 窗口 (燁輝)</label>
                  <select
                    value={filter.tpm || ''}
                    onChange={(e) => setFilter({ ...filter, tpm: e.target.value || undefined })}
                    className="w-full h-7.5 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700"
                  >
                    <option value="">全部 TPM</option>
                    {allTPMs.map((tpm) => (
                      <option key={tpm} value={tpm}>
                        {tpm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 視圖內容渲染 */}
      {viewType === 'month' ? (
        <MonthView
          year={currentYear}
          month={currentMonth}
          trips={filteredTrips}
          holidays={holidays}
          onYearChange={setCurrentYear}
          onMonthChange={setCurrentMonth}
          onTripClick={handleTripClick}
          onDateClick={(date) => handleOpenCreateForm(date)}
          onOpenHolidayModal={() => setShowHolidayModal(true)}
        />
      ) : viewType === 'week' ? (
        <WeekView
          weekInfo={currentWeek}
          trips={filteredTrips}
          holidays={holidays}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
          onGoToCurrentWeek={() => setCurrentWeek(getCurrentWeek())}
          onTripClick={handleTripClick}
          onDateClick={(date) => handleOpenCreateForm(date)}
          onOpenHolidayModal={() => setShowHolidayModal(true)}
        />
      ) : viewType === 'list' ? (
        <ScheduleListView
          trips={filteredTrips}
          holidays={holidays}
          onTripClick={handleTripClick}
          onEditTrip={handleEditTrip}
          onDeleteTrip={(t) => handleDeleteTrip(t)}
        />
      ) : viewType === 'overdue' ? (
        <OverdueView
          trips={filteredTrips}
          onFillReport={(t) => handleEditTrip(t)}
        />
      ) : viewType === 'unreported' ? (
        <UnreportedView
          trips={trips}
          onFillReport={(t) => handleEditTrip(t)}
        />
      ) : (
        <TravelAnalyticsView
          trips={trips}
          users={users}
          clients={clients}
          onArrangeVisit={(customerName) => {
            const matched = clients.find((c) => c.name === customerName);
            handleOpenCreateForm();
            if (matched) {
              setFilter((prev) => ({ ...prev, customerId: matched.id }));
            }
          }}
        />
      )}
        </div>
      </div>

      {/* 新增 / 編輯行程彈跳對話框 */}
      {showTripForm && (
        <TripFormDialog
          open={showTripForm}
          onOpenChange={(open) => {
            setShowTripForm(open);
            if (!open) {
              setSelectedTrip(null);
              setSelectedDate(null);
            }
          }}
          trip={selectedTrip}
          selectedDate={selectedDate}
          clients={clients}
          projects={projects}
          users={users}
          defaultCustomerId={filter.customerId}
          onSave={handleSaveTrip}
          onProjectCreated={(newProj) => {
            setProjects((prev) => [newProj, ...prev.filter((p) => p.id !== newProj.id)]);
          }}
        />
      )}

      {/* 行程詳細檢視彈跳對話框 */}
      {showTripDetail && selectedTrip && (
        <TripDetailDialog
          open={showTripDetail}
          onOpenChange={(open) => {
            setShowTripDetail(open);
            if (!open) setSelectedTrip(null);
          }}
          trip={selectedTrip}
          onEdit={() => handleEditTrip(selectedTrip)}
          onDelete={() => handleDeleteTrip(selectedTrip)}
          onStatusChange={handleStatusChange}
          canManage={permissions.schedules.canManage}
        />
      )}

      {/* 國定與自訂假日管理對話框 */}
      {showHolidayModal && (
        <HolidayManagementDialog
          open={showHolidayModal}
          onOpenChange={setShowHolidayModal}
          holidays={holidays}
          currentYear={currentYear}
          onHolidaysChange={async () => {
            const hData = await getHolidays();
            setHolidays(hData);
          }}
        />
      )}
    </div>
  );
}
