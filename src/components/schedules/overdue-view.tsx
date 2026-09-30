'use client';

import { useState, useMemo } from 'react';
import { AlertTriangle, Calendar as CalendarIcon, ChevronRight, Filter, RotateCcw, User, Building2, CalendarDays } from 'lucide-react';
import { BusinessTrip } from '@/types/businessTrip';
import { isTripReportOverdue, formatDateChinese } from '@/lib/calendar-helper';

interface OverdueViewProps {
  trips: BusinessTrip[];
  onFillReport: (trip: BusinessTrip) => void;
}

export function OverdueView({ trips, onFillReport }: OverdueViewProps) {
  // 篩選條件：出差人員、客戶別、月份
  const [selectedTraveler, setSelectedTraveler] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // 1. 基礎待補件行程（已套用「沒有地點且沒有人名一律不納入跟催」規則）
  const allOverdueTrips = useMemo(() => {
    return trips
      .filter((t) => isTripReportOverdue(t.endDate, t.endTime, t.notes, t.location, t.travelers))
      .sort(
        (a, b) =>
          new Date(a.endDate.replace(/-/g, '/')).getTime() -
          new Date(b.endDate.replace(/-/g, '/')).getTime()
      );
  }, [trips]);

  // 2. 動態提取可篩選選項
  const availableTravelers = useMemo(() => {
    const set = new Set<string>();
    allOverdueTrips.forEach((t) => {
      t.travelers?.forEach((name) => {
        if (name && name.trim() && name !== '—') set.add(name.trim());
      });
    });
    return Array.from(set).sort();
  }, [allOverdueTrips]);

  const availableCustomers = useMemo(() => {
    const set = new Set<string>();
    allOverdueTrips.forEach((t) => {
      if (t.customerName && t.customerName.trim() && t.customerName !== '—') {
        set.add(t.customerName.trim());
      }
    });
    return Array.from(set).sort();
  }, [allOverdueTrips]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allOverdueTrips.forEach((t) => {
      const ym = t.endDate.slice(0, 7);
      if (ym) set.add(ym);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allOverdueTrips]);

  // 3. 執行條件篩選
  const filteredOverdueTrips = useMemo(() => {
    return allOverdueTrips.filter((t) => {
      // 人員篩選
      if (selectedTraveler !== 'all') {
        if (!t.travelers || !t.travelers.includes(selectedTraveler)) {
          return false;
        }
      }
      // 客戶篩選
      if (selectedCustomer !== 'all') {
        if (t.customerName !== selectedCustomer) {
          return false;
        }
      }
      // 月份篩選
      if (selectedMonth !== 'all') {
        const ym = t.endDate.slice(0, 7);
        if (ym !== selectedMonth) {
          return false;
        }
      }
      return true;
    });
  }, [allOverdueTrips, selectedTraveler, selectedCustomer, selectedMonth]);

  const isFiltered =
    selectedTraveler !== 'all' || selectedCustomer !== 'all' || selectedMonth !== 'all';

  const handleResetFilters = () => {
    setSelectedTraveler('all');
    setSelectedCustomer('all');
    setSelectedMonth('all');
  };

  const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${y}年${parseInt(m, 10)}月`;
  };

  return (
    <div className="space-y-4">
      {/* 統計與提醒資訊卡片 */}
      <div className="bg-red-50/80 border border-red-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                待補件行程數量
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-red-700">
                  {filteredOverdueTrips.length}
                </span>
                <span className="text-sm font-normal text-red-600">件</span>
                {isFiltered && (
                  <span className="text-xs text-red-500 font-medium">
                    (全部共 {allOverdueTrips.length} 件)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="sm:ml-auto text-left sm:text-right text-xs text-red-600 space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-red-200">
            <p className="font-semibold">⚠️ 依管理規定：行程結束超過 3 天</p>
            <p className="text-red-500">且尚未填寫「出差重點彙整」者列入待補件追蹤</p>
            <p className="text-[11px] text-red-400">（已自動排除無地點且無出差人員之假日與公務項目）</p>
          </div>
        </div>
      </div>

      {/* 🔍 待補件多功能篩選控制列 */}
      <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 shrink-0">
          <Filter className="w-3.5 h-3.5 text-red-600" />
          <span>篩選條件：</span>
        </div>

        {/* 1. 出差人員篩選 */}
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs">
          <User className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <select
            value={selectedTraveler}
            onChange={(e) => setSelectedTraveler(e.target.value)}
            className="bg-transparent border-none text-xs text-gray-800 focus:outline-none cursor-pointer pr-1"
          >
            <option value="all">全部出差人員 ({availableTravelers.length})</option>
            {availableTravelers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* 2. 客戶別篩選 */}
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs">
          <Building2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="bg-transparent border-none text-xs text-gray-800 focus:outline-none cursor-pointer pr-1"
          >
            <option value="all">全部客戶 ({availableCustomers.length})</option>
            {availableCustomers.map((cust) => (
              <option key={cust} value={cust}>
                {cust}
              </option>
            ))}
          </select>
        </div>

        {/* 3. 月份篩選 */}
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs">
          <CalendarDays className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent border-none text-xs text-gray-800 focus:outline-none cursor-pointer pr-1"
          >
            <option value="all">全部月份 ({availableMonths.length})</option>
            {availableMonths.map((ym) => (
              <option key={ym} value={ym}>
                {formatMonthLabel(ym)}
              </option>
            ))}
          </select>
        </div>

        {/* 重設篩選按鈕 */}
        {isFiltered && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-200 transition ml-auto"
            title="清除所有篩選條件"
          >
            <RotateCcw className="w-3 h-3" />
            <span>清除篩選</span>
          </button>
        )}
      </div>

      {/* 列表內容 */}
      {filteredOverdueTrips.length === 0 ? (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CalendarIcon className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-emerald-800 mb-1">
            {isFiltered ? '在此篩選條件下沒有待補件的行程' : '太棒了！目前沒有待補件的行程'}
          </h3>
          <p className="text-sm text-emerald-600">
            {isFiltered ? '您可以切換或清除上方篩選條件查看其他項目。' : '所有出差與行程重點彙整皆已如期填寫完成。'}
          </p>
          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="mt-4 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
            >
              清除所有篩選
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* 表頭 */}
          <div className="bg-gray-50/80 px-6 py-3 border-b border-gray-200 grid grid-cols-12 gap-4 text-xs font-semibold text-gray-500 tracking-wider">
            <div className="col-span-2 sm:col-span-1">逾期天數</div>
            <div className="col-span-4 sm:col-span-3">行程主題 / 客戶</div>
            <div className="col-span-3 sm:col-span-2">結束日期</div>
            <div className="hidden sm:block sm:col-span-2">地點</div>
            <div className="col-span-3 sm:col-span-3">出差人員</div>
            <div className="hidden sm:block sm:col-span-1 text-right">操作</div>
          </div>

          {/* 列表 */}
          <div className="divide-y divide-gray-100">
            {filteredOverdueTrips.map((trip) => {
              const daysSinceEnd = Math.max(
                0,
                Math.floor(
                  (new Date().getTime() - new Date(trip.endDate.replace(/-/g, '/')).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              );

              return (
                <div
                  key={trip.id}
                  onClick={() => onFillReport(trip)}
                  className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-red-50/40 transition cursor-pointer group"
                >
                  {/* 逾期天數 */}
                  <div className="col-span-2 sm:col-span-1">
                    <span className="inline-block px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">
                      {daysSinceEnd} 天
                    </span>
                  </div>

                  {/* 行程主題 */}
                  <div className="col-span-4 sm:col-span-3 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{trip.subject}</p>
                    {trip.customerName && (
                      <p className="text-xs text-gray-500 truncate">🏢 {trip.customerName}</p>
                    )}
                  </div>

                  {/* 結束日期 */}
                  <div className="col-span-3 sm:col-span-2 text-xs text-gray-600">
                    {formatDateChinese(trip.endDate)}
                    <span className="text-gray-400 block text-[11px]">{trip.endTime}</span>
                  </div>

                  {/* 地點 */}
                  <div className="hidden sm:block sm:col-span-2 text-xs text-gray-600 truncate">
                    📍 {trip.location || '—'}
                  </div>

                  {/* 出差人員 */}
                  <div className="col-span-3 sm:col-span-3 text-xs text-gray-600 truncate">
                    👥 {trip.travelers?.join(', ') || '—'}
                  </div>

                  {/* 操作按鈕 */}
                  <div className="col-span-12 sm:col-span-1 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFillReport(trip);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition shadow-sm"
                    >
                      <span>補填</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
