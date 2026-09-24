'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings, AlertTriangle, CalendarDays } from 'lucide-react';
import { BusinessTrip, TRIP_CATEGORIES, Holiday } from '@/types/businessTrip';
import { getMonthDays, isSameDay, isTripReportOverdue, findHoliday } from '@/lib/calendar-helper';

interface DisplaySettings {
  showCustomer: boolean;
  showProject: boolean;
  showLocation: boolean;
  showTime: boolean;
  showTravelers: boolean;
  showWeekend: boolean;
}

interface MonthViewProps {
  year: number;
  month: number;
  trips: BusinessTrip[];
  holidays: Holiday[];
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onTripClick: (trip: BusinessTrip) => void;
  onDateClick: (date: Date) => void;
  onOpenHolidayModal: () => void;
}

export function MonthView({
  year,
  month,
  trips,
  holidays,
  onYearChange,
  onMonthChange,
  onTripClick,
  onDateClick,
  onOpenHolidayModal,
}: MonthViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    showCustomer: true,
    showProject: true,
    showLocation: true,
    showTime: true,
    showTravelers: true,
    showWeekend: true,
  });

  const allDays = getMonthDays(year, month);
  const today = new Date();

  // 根據是否顯示週末來重新組織天數
  const getDaysForDisplay = () => {
    if (displaySettings.showWeekend) {
      return allDays;
    }
    // 過濾掉週末
    return allDays.filter((date) => {
      const day = date.getDay();
      return day !== 0 && day !== 6;
    });
  };

  const days = getDaysForDisplay();

  const handlePrevMonth = () => {
    if (month === 0) {
      onMonthChange(11);
      onYearChange(year - 1);
    } else {
      onMonthChange(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      onMonthChange(0);
      onYearChange(year + 1);
    } else {
      onMonthChange(month + 1);
    }
  };

  const getTripsForDate = (date: Date): BusinessTrip[] => {
    return trips.filter((trip) => {
      const tripStart = new Date(trip.startDate.replace(/-/g, '/'));
      const tripEnd = new Date(trip.endDate.replace(/-/g, '/'));
      tripStart.setHours(0, 0, 0, 0);
      tripEnd.setHours(23, 59, 59, 999);
      const dateTime = new Date(date);
      dateTime.setHours(12, 0, 0, 0);
      return dateTime >= tripStart && dateTime <= tripEnd;
    });
  };

  const getCategoryColor = (category: string) => {
    const cat = TRIP_CATEGORIES.find((c) => c.value === category);
    return cat?.color || '#6b7280';
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === month;
  };

  const isToday = (date: Date) => {
    return isSameDay(date, today);
  };

  const toggleSetting = (key: keyof DisplaySettings) => {
    setDisplaySettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const gridCols = displaySettings.showWeekend ? 'grid-cols-7' : 'grid-cols-5';
  const weekDays = displaySettings.showWeekend
    ? ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
    : ['週一', '週二', '週三', '週四', '週五'];

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* 月份導航 */}
      <div className="flex items-center justify-between p-4 border-b">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          title="上個月"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-lg font-bold flex-1 text-center text-gray-800">
          {year} 年 {month + 1} 月
        </h2>

        {/* 設定按鈕 */}
        <div className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="顯示設定"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>

          {/* 設定面板 */}
          {showSettings && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSettings(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-4">
                <h3 className="font-bold text-gray-900 mb-3">顯示設定</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={displaySettings.showCustomer}
                      onChange={() => toggleSetting('showCustomer')}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">顯示客戶</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={displaySettings.showProject}
                      onChange={() => toggleSetting('showProject')}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">顯示專案</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={displaySettings.showLocation}
                      onChange={() => toggleSetting('showLocation')}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">顯示地點</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={displaySettings.showTime}
                      onChange={() => toggleSetting('showTime')}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">顯示時間</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={displaySettings.showTravelers}
                      onChange={() => toggleSetting('showTravelers')}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">顯示參與人員</span>
                  </label>
                  <div className="border-t pt-2 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displaySettings.showWeekend}
                        onChange={() => toggleSetting('showWeekend')}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-800">顯示週末</span>
                    </label>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        onOpenHolidayModal();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <CalendarDays className="w-4 h-4" />
                      國定假日管理
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          title="下個月"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* 星期標題 */}
      <div className={`grid ${gridCols} border-b bg-gray-50/50`}>
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-2.5 text-center text-sm font-medium text-gray-600 border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日期網格 */}
      <div className={`grid ${gridCols}`}>
        {days.map((date, index) => {
          const dayTrips = getTripsForDate(date);
          const isInCurrentMonth = isCurrentMonth(date);
          const isTodayDate = isToday(date);
          const holiday = findHoliday(date, holidays);

          return (
            <div
              key={index}
              className={`min-h-[130px] border-r border-b last:border-r-0 p-2 group transition-colors ${
                holiday && isInCurrentMonth
                  ? 'bg-red-50/60'
                  : isTodayDate
                  ? 'bg-blue-50/60'
                  : !isInCurrentMonth
                  ? 'bg-gray-50/70 text-gray-400'
                  : 'bg-white hover:bg-gray-50/50'
              }`}
            >
              {/* 日期標題列 */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`text-sm font-medium ${
                      holiday && isInCurrentMonth
                        ? 'text-red-600 font-bold'
                        : isTodayDate
                        ? 'text-blue-600 font-bold'
                        : !isInCurrentMonth
                        ? 'text-gray-400'
                        : 'text-gray-700'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {holiday && isInCurrentMonth && (
                    <span className="text-[11px] px-1.5 py-0.2 bg-red-100 text-red-600 rounded font-medium truncate max-w-[85px]">
                      {holiday.name}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onDateClick(date)}
                  className="p-1 hover:bg-gray-200/80 rounded transition opacity-0 group-hover:opacity-100 text-gray-500"
                  title="新增行程"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 行程列表 */}
              <div className="space-y-1">
                {dayTrips.slice(0, 3).map((trip) => {
                  const isOverdue = isTripReportOverdue(trip.endDate, trip.endTime, trip.notes);
                  return (
                    <button
                      key={trip.id}
                      onClick={() => onTripClick(trip)}
                      className="w-full text-left px-2 py-1 rounded text-xs hover:shadow transition border border-black/5"
                      style={{
                        backgroundColor: `${getCategoryColor(trip.category)}18`,
                        borderLeft: `3px solid ${getCategoryColor(trip.category)}`,
                      }}
                      title={`${trip.subject}\n${trip.travelers.join(', ')}\n${trip.startTime}-${trip.endTime}${isOverdue ? '\n⚠️ 出差報告逾期未填' : ''}`}
                    >
                      {/* 主題與警示 */}
                      <div className="font-semibold text-gray-900 truncate flex items-center gap-1">
                        <span className="truncate">{trip.subject}</span>
                        {trip.status === 'pending' && (
                          <span className="text-amber-600 shrink-0 text-[10px]" title="待確認">⚠️</span>
                        )}
                        {isOverdue && (
                          <span
                            className="text-red-500 shrink-0"
                            title="出差報告逾期未填"
                          >
                            <AlertTriangle className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      {/* 動態顯示資訊 */}
                      {displaySettings.showCustomer && trip.customerName && (
                        <div className="text-gray-600 truncate text-[11px]">
                          🏢 {trip.customerName}
                        </div>
                      )}
                      {displaySettings.showProject && trip.projectName && (
                        <div className="text-gray-600 truncate text-[11px]">
                          📋 {trip.projectName}
                        </div>
                      )}
                      {displaySettings.showLocation && trip.location && (
                        <div className="text-gray-600 truncate text-[11px]">
                          📍 {trip.location}
                        </div>
                      )}
                      {displaySettings.showTime && (
                        <div className="text-gray-500 text-[10px]">
                          🕐 {trip.startTime}-{trip.endTime}
                        </div>
                      )}
                      {displaySettings.showTravelers && trip.travelers && trip.travelers.length > 0 && (
                        <div className="text-gray-600 truncate text-[11px]">
                          👥 {trip.travelers.join(', ')}
                        </div>
                      )}
                    </button>
                  );
                })}
                {dayTrips.length > 3 && (
                  <div className="text-[11px] text-gray-500 text-center font-medium">
                    +{dayTrips.length - 3} 更多
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
