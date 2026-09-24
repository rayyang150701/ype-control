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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  BusinessTrip,
  CalendarViewType,
  TripFilter,
  WeekInfo,
  Holiday,
  TRIP_CATEGORIES,
} from '@/types/businessTrip';
import type { Client, Project, User } from '@/types';
import {
  getCurrentWeek,
  getYearWeeks,
  formatDate,
  isTripReportOverdue,
} from '@/lib/calendar-helper';
import {
  getBusinessTrips,
  createBusinessTrip,
  updateBusinessTrip,
  deleteBusinessTrip,
  updateBusinessTripStatus,
  getHolidays,
} from '@/lib/actions';

import { TripFilterPanel } from './trip-filter-panel';
import { MonthView } from './month-view';
import { WeekView } from './week-view';
import { ScheduleListView } from './schedule-list-view';
import { OverdueView } from './overdue-view';
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
  const { toast } = useToast();

  // 視圖切換狀態
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentWeek, setCurrentWeek] = useState<WeekInfo>(getCurrentWeek());

  // 資料狀態
  const [trips, setTrips] = useState<BusinessTrip[]>(initialTrips);
  const [clients] = useState<Client[]>(initialClients);
  const [projects] = useState<Project[]>(initialProjects);
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

  // 重新載入行程與假日資料
  const reloadData = async () => {
    try {
      setIsRefreshing(true);
      const [tripsData, holidaysData] = await Promise.all([
        getBusinessTrips(),
        getHolidays(),
      ]);
      setTrips(tripsData);
      setHolidays(holidaysData);
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

  // 前端過濾行程（支援統一關鍵字、客戶、專案、類別、狀態、TPM、週別）
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      // 關鍵字搜尋 (主題、人員、專案、地點、客戶)
      if (filter.searchKeyword) {
        const kw = filter.searchKeyword.toLowerCase();
        const matchSubject = trip.subject?.toLowerCase().includes(kw);
        const matchProject = trip.projectName?.toLowerCase().includes(kw);
        const matchCustomer = trip.customerName?.toLowerCase().includes(kw);
        const matchLocation = trip.location?.toLowerCase().includes(kw);
        const matchTravelers = trip.travelers?.some((t) => t.toLowerCase().includes(kw));
        if (!matchSubject && !matchProject && !matchCustomer && !matchLocation && !matchTravelers) {
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

      // 類別篩選
      if (filter.category && trip.category !== filter.category) {
        return false;
      }

      // 狀態篩選
      if (filter.status && trip.status !== filter.status) {
        return false;
      }

      // TPM 篩選
      if (filter.tpm && trip.tpm !== filter.tpm) {
        return false;
      }

      return true;
    });
  }, [trips, filter, clients]);

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
    setSelectedTrip(trip);
    setShowTripDetail(false);
    setShowTripForm(true);
  };

  // 儲存行程（新增或更新）
  const handleSaveTrip = async (
    tripData: Omit<BusinessTrip, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (selectedTrip) {
      const res = await updateBusinessTrip(selectedTrip.id, tripData);
      if (res.success) {
        toast({ title: '更新成功', description: '行程資料已成功更新' });
        setShowTripForm(false);
        setSelectedTrip(null);
        await reloadData();
      } else {
        toast({ variant: 'destructive', title: '更新失敗', description: res.message });
      }
    } else {
      const res = await createBusinessTrip(tripData);
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
    const target = trip || selectedTrip;
    if (!target) return;

    if (!confirm(`確定要刪除「${target.subject}」這筆出差行程嗎？`)) return;

    try {
      const res = await deleteBusinessTrip(target.id);
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
    if (!selectedTrip) return;

    try {
      const res = await updateBusinessTripStatus(selectedTrip.id, newStatus);
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

  // 計算統計數字
  const pendingCount = useMemo(
    () => filteredTrips.filter((t) => t.status === 'pending').length,
    [filteredTrips]
  );

  const overdueCount = useMemo(
    () => trips.filter((t) => isTripReportOverdue(t.endDate, t.endTime, t.notes)).length,
    [trips]
  );

  return (
    <div className="space-y-4">
      {/* 頂部主控台標題列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">出差與行程管理</h1>
              <Badge variant="secondary" className="text-xs">
                {filteredTrips.length} 筆行程
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
              <span>跨廠出差調校、會議與專案行程追蹤</span>
              {pendingCount > 0 && (
                <span className="text-amber-600 font-medium">・ 待確認 {pendingCount} 筆</span>
              )}
              {overdueCount > 0 && (
                <span className="text-red-600 font-bold">・ 待補出差報告 {overdueCount} 筆</span>
              )}
            </div>
          </div>
        </div>

        {/* 頂部動作按鈕群 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={reloadData}
            disabled={isRefreshing}
            className="text-xs h-9 gap-1.5"
            title="刷新行程資料"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>刷新</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs h-9 gap-1.5 text-slate-700"
            title="匯出為 CSV 報表"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>匯出 CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenCreateForm()}
            className="text-xs h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>新增行程</span>
          </Button>
        </div>
      </div>

      {/* 篩選面板 (搜尋、客戶、專案、類別、狀態、WK週別、TPM) - 在行事曆視圖中顯示 */}
      {viewType !== 'analytics' && (
        <TripFilterPanel
          trips={trips}
          clients={clients}
          projects={projects}
          currentYear={currentYear}
          filter={filter}
          onFilterChange={setFilter}
          onWeekSelect={(wInfo) => {
            setViewType('week');
            setCurrentWeek(wInfo);
          }}
        />
      )}

      {/* 視圖切換標籤列 */}
      <div className="flex items-center gap-1 border-b border-gray-200 bg-white rounded-t-xl px-3 pt-1 shadow-2xs">
        <button
          type="button"
          onClick={() => setViewType('month')}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 cursor-pointer ${
            viewType === 'month'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 hover:text-gray-900 border-transparent'
          }`}
        >
          月檢視
        </button>

        <button
          type="button"
          onClick={() => setViewType('week')}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 cursor-pointer ${
            viewType === 'week'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 hover:text-gray-900 border-transparent'
          }`}
        >
          週檢視
        </button>

        <button
          type="button"
          onClick={() => setViewType('list')}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 cursor-pointer ${
            viewType === 'list'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 hover:text-gray-900 border-transparent'
          }`}
        >
          列表檢視
        </button>

        <button
          type="button"
          onClick={() => setViewType('overdue')}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
            viewType === 'overdue'
              ? 'text-red-600 border-red-600'
              : 'text-gray-500 hover:text-gray-900 border-transparent'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>待補件</span>
          {overdueCount > 0 && (
            <span className="px-1.5 py-0.2 bg-red-600 text-white text-[10px] font-extrabold rounded-full">
              {overdueCount}
            </span>
          )}
        </button>

        {/* 🆕 出差分析儀表板分頁 */}
        <button
          type="button"
          onClick={() => setViewType('analytics')}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
            viewType === 'analytics'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 hover:text-gray-900 border-transparent'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>出差分析</span>
        </button>
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
