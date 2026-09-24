'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings, Printer, AlertTriangle, CalendarDays } from 'lucide-react';
import { BusinessTrip, TRIP_CATEGORIES, WeekInfo, Holiday } from '@/types/businessTrip';
import { getWeekDays, getDayName, isSameDay, formatWeekChinese, isTripReportOverdue, findHoliday } from '@/lib/calendar-helper';

interface DisplaySettings {
  showCustomer: boolean;
  showProject: boolean;
  showLocation: boolean;
  showTime: boolean;
  showTravelers: boolean;
  showWeekend: boolean;
}

interface WeekViewProps {
  weekInfo: WeekInfo;
  trips: BusinessTrip[];
  holidays: Holiday[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onTripClick: (trip: BusinessTrip) => void;
  onDateClick: (date: Date) => void;
  onOpenHolidayModal: () => void;
}

export function WeekView({
  weekInfo,
  trips,
  holidays,
  onPrevWeek,
  onNextWeek,
  onTripClick,
  onDateClick,
  onOpenHolidayModal,
}: WeekViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    showCustomer: true,
    showProject: true,
    showLocation: true,
    showTime: true,
    showTravelers: true,
    showWeekend: true,
  });

  const allDays = getWeekDays(weekInfo.year, weekInfo.weekNumber);
  const days = displaySettings.showWeekend
    ? allDays
    : allDays.filter((date) => date.getDay() !== 0 && date.getDay() !== 6);

  const today = new Date();

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

  const isToday = (date: Date) => {
    return isSameDay(date, today);
  };

  const toggleSetting = (key: keyof DisplaySettings) => {
    setDisplaySettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const gridCols = displaySettings.showWeekend ? 'grid-cols-7' : 'grid-cols-5';

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 print:shadow-none print:border-none week-print-container">
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 5mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .week-print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: none !important;
          }
          .week-print-col {
            min-height: calc(100vh - 30mm) !important;
            max-height: calc(100vh - 30mm) !important;
            overflow: hidden !important;
            padding: 4px !important;
          }
          .week-print-card {
            padding: 4px 6px !important;
            margin-bottom: 4px !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
            box-shadow: none !important;
            border: 1px solid #e2e8f0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* 週別導航列 */}
      <div className="flex items-center justify-between p-4 border-b print:hidden">
        <button
          onClick={onPrevWeek}
          className="p-2 hover:bg-gray-100 rounded-lg transition cursor-pointer"
          title="上一週"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="text-center flex-1">
          <h2 className="text-lg font-bold text-gray-800">{weekInfo.label}</h2>
          <p className="text-xs text-gray-500 font-medium">{formatWeekChinese(weekInfo)}</p>
        </div>

        {/* 功能按鈕組 */}
        <div className="flex items-center gap-2">
          {/* 列印/PDF 匯出 */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition text-xs font-semibold text-gray-700 cursor-pointer border border-gray-200"
            title="以 A4 橫向單頁格式列印或儲存為 PDF"
          >
            <Printer className="w-4 h-4" />
            <span>列印週總表 (單頁PDF)</span>
          </button>

          {/* 設定按鈕 */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600 cursor-pointer"
              title="顯示設定"
            >
              <Settings className="w-5 h-5" />
            </button>

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
        </div>

        <button
          onClick={onNextWeek}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          title="下一週"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* 列印專用簡潔標頭 (僅在列印時顯示，聚焦週別與重點行程) */}
      <div className="hidden print:flex items-center justify-between px-3 py-1.5 border-b-2 border-slate-900 bg-white">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-extrabold text-slate-900 tracking-wide">
            【{weekInfo.label}】行程管理週報總表
          </h1>
          <span className="text-xs text-slate-600 font-semibold">{formatWeekChinese(weekInfo)}</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          製表時間：{new Date().toLocaleDateString('zh-TW')}
        </div>
      </div>

      {/* 橫列星期與日期標題 */}
      <div className="border-b bg-gray-50/70 print:bg-slate-100/90">
        <div className={`grid ${gridCols}`}>
          {days.map((date, index) => {
            const holiday = findHoliday(date, holidays);
            return (
              <div
                key={index}
                className={`py-2 px-3 text-center text-sm font-medium border-r last:border-r-0 print:py-1 print:px-1 ${
                  holiday ? 'text-red-600 bg-red-50/60 print:bg-red-50' : 'text-gray-700'
                }`}
              >
                <div className="print:text-xs print:font-bold">{getDayName(date.getDay())}</div>
                <div className={`text-xs print:text-[10px] ${holiday ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                  {date.getMonth() + 1}/{date.getDate()}
                </div>
                {holiday && (
                  <div className="text-[11px] print:text-[9px] text-red-600 font-medium mt-0.5 truncate">{holiday.name}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 日期內容欄位 */}
      <div className={`grid ${gridCols} divide-x print:border-b print:border-slate-300`}>
        {days.map((date, index) => {
          const dayTrips = getTripsForDate(date);
          const isTodayDate = isToday(date);
          const holiday = findHoliday(date, holidays);

          return (
            <div
              key={index}
              className={`week-print-col min-h-[420px] p-2 group transition-colors print:min-h-0 print:p-1 print:bg-white ${
                holiday
                  ? 'bg-red-50/40'
                  : isTodayDate
                  ? 'bg-blue-50/40'
                  : 'bg-white hover:bg-gray-50/30'
              }`}
            >
              {/* 日期與快速新增 */}
              <div className="flex items-center justify-between mb-2 px-1 print:mb-1">
                <span
                  className={`text-lg font-bold print:text-xs ${
                    holiday ? 'text-red-600' : isTodayDate ? 'text-blue-600' : 'text-gray-700'
                  }`}
                >
                  {date.getDate()}
                </span>
                <button
                  onClick={() => onDateClick(date)}
                  className="p-1 hover:bg-gray-200/80 rounded transition opacity-0 group-hover:opacity-100 text-gray-500 print:hidden cursor-pointer"
                  title="新增行程"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 行程卡片 */}
              <div className="space-y-2 print:space-y-1">
                {dayTrips.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-8 print:py-2 print:text-[10px]">
                    暫無行程
                  </div>
                ) : (
                  dayTrips.map((trip) => {
                    const isOverdue = isTripReportOverdue(trip.endDate, trip.endTime, trip.notes);
                    return (
                      <button
                        key={trip.id}
                        onClick={() => onTripClick(trip)}
                        className="week-print-card w-full text-left p-2.5 rounded-lg hover:shadow-md transition border bg-white cursor-pointer print:p-1.5 print:mb-1 print:border-slate-300 print:shadow-none"
                        style={{
                          borderLeft: `4px solid ${getCategoryColor(trip.category)}`,
                        }}
                      >
                        {/* 主題與狀態標籤 */}
                        <div className="font-semibold text-sm text-gray-900 mb-1 flex items-start justify-between gap-1 print:text-[11px] print:mb-0.5">
                          <span className="line-clamp-2 print:line-clamp-2">{trip.subject}</span>
                          <div className="flex items-center gap-1 shrink-0 print:hidden">
                            {isOverdue && (
                              <span
                                className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded flex items-center gap-0.5"
                                title="出差報告逾期未填"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                <span>缺</span>
                              </span>
                            )}
                            {trip.status === 'pending' && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded">
                                待確認
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 動態顯示詳細資訊 */}
                        <div className="space-y-1 text-xs text-gray-600 print:space-y-0.5 print:text-[9.5px]">
                          {displaySettings.showCustomer && trip.customerName && (
                            <div className="flex items-center gap-1 truncate">
                              <span className="text-gray-400 shrink-0">🏢</span>
                              <span className="truncate">{trip.customerName}</span>
                            </div>
                          )}

                          {displaySettings.showProject && trip.projectName && (
                            <div className="flex items-center gap-1 truncate">
                              <span className="text-gray-400 shrink-0">📋</span>
                              <span className="truncate">{trip.projectName}</span>
                            </div>
                          )}

                          {displaySettings.showLocation && trip.location && (
                            <div className="flex items-center gap-1 truncate">
                              <span className="text-gray-400 shrink-0">📍</span>
                              <span className="truncate">{trip.location}</span>
                            </div>
                          )}

                          {displaySettings.showTime && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 shrink-0">🕐</span>
                              <span className="text-[11px] print:text-[9.5px]">{trip.startTime} - {trip.endTime}</span>
                            </div>
                          )}

                          {displaySettings.showTravelers && trip.travelers && trip.travelers.length > 0 && (
                            <div className="flex items-center gap-1 truncate">
                              <span className="text-gray-400 shrink-0">👥</span>
                              <span className="truncate">{trip.travelers.join(', ')}</span>
                            </div>
                          )}

                          {/* 🍱 便當數顯示 */}
                          {Boolean(trip.lunchBoxes && trip.lunchBoxes > 0) && (
                            <div className="flex items-center gap-1 text-amber-900 font-bold text-[10px] print:text-[9px] bg-amber-100/90 px-1.5 py-0.2 rounded border border-amber-300 w-fit mt-0.5">
                              <span>🍱 便當: {trip.lunchBoxes} 個</span>
                            </div>
                          )}
                        </div>

                        {/* 類別標籤 */}
                        <div className="mt-2 print:mt-1">
                          <span
                            className="inline-block px-2 py-0.5 rounded text-[10px] print:text-[8.5px] font-medium text-white"
                            style={{ backgroundColor: getCategoryColor(trip.category) }}
                          >
                            {TRIP_CATEGORIES.find((c) => c.value === trip.category)?.label}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
