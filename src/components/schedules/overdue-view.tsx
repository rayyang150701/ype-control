'use client';

import { useMemo } from 'react';
import { AlertTriangle, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';
import { BusinessTrip } from '@/types/businessTrip';
import { isTripReportOverdue, formatDateChinese } from '@/lib/calendar-helper';

interface OverdueViewProps {
  trips: BusinessTrip[];
  onFillReport: (trip: BusinessTrip) => void;
}

export function OverdueView({ trips, onFillReport }: OverdueViewProps) {
  const overdueTrips = useMemo(() => {
    return trips
      .filter((t) => isTripReportOverdue(t.endDate, t.endTime, t.notes))
      .sort((a, b) => new Date(a.endDate.replace(/-/g, '/')).getTime() - new Date(b.endDate.replace(/-/g, '/')).getTime());
  }, [trips]);

  return (
    <div className="space-y-4">
      {/* 統計與提醒資訊卡片 */}
      <div className="bg-red-50/80 border border-red-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">待補件行程數量</p>
              <p className="text-3xl font-extrabold text-red-700">{overdueTrips.length} <span className="text-sm font-normal text-red-600">件</span></p>
            </div>
          </div>
          <div className="sm:ml-auto text-left sm:text-right text-xs text-red-600 space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-red-200">
            <p className="font-semibold">⚠️ 依管理規定：行程結束超過 3 天</p>
            <p className="text-red-500">且尚未填寫「出差重點彙整」者列入待補件追蹤</p>
          </div>
        </div>
      </div>

      {/* 列表內容 */}
      {overdueTrips.length === 0 ? (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CalendarIcon className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-emerald-800 mb-1">太棒了！目前沒有待補件的行程</h3>
          <p className="text-sm text-emerald-600">所有出差與行程重點彙整皆已如期填寫完成。</p>
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
            {overdueTrips.map((trip) => {
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
