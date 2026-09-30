'use client';

import { useMemo } from 'react';
import { ClipboardX, CheckCircle2, ChevronRight } from 'lucide-react';
import { BusinessTrip, TRIP_CATEGORIES } from '@/types/businessTrip';
import { isTripEndedWithoutReport, formatDateChinese } from '@/lib/calendar-helper';

interface UnreportedViewProps {
  trips: BusinessTrip[];
  onFillReport: (trip: BusinessTrip) => void;
}

export function UnreportedView({ trips, onFillReport }: UnreportedViewProps) {
  const unreportedTrips = useMemo(() => {
    return trips
      .filter((t) =>
        isTripEndedWithoutReport(t.endDate, t.endTime, t.notes, t.location, t.travelers)
      )
      .sort(
        (a, b) =>
          new Date(b.endDate.replace(/-/g, '/')).getTime() -
          new Date(a.endDate.replace(/-/g, '/')).getTime()
      );
  }, [trips]);

  return (
    <div className="space-y-4">
      {/* 說明卡片 */}
      <div className="bg-orange-50/80 border border-orange-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
              <ClipboardX className="w-7 h-7 text-orange-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">
                尚未填寫出差紀錄
              </p>
              <p className="text-3xl font-extrabold text-orange-700">
                {unreportedTrips.length}{' '}
                <span className="text-sm font-normal text-orange-600">件</span>
              </p>
            </div>
          </div>
          <div className="sm:ml-auto text-left sm:text-right text-xs text-orange-600 space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-orange-200">
            <p className="font-semibold">📋 行程已結束、出差紀錄尚未填寫</p>
            <p className="text-orange-500">與「待補件」不同：此清單不受 3 天規則限制</p>
          </div>
        </div>
      </div>

      {/* 清單內容 */}
      {unreportedTrips.length === 0 ? (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-emerald-800 mb-1">
            太棒了！所有已結束行程均已回報
          </h3>
          <p className="text-sm text-emerald-600">所有出差紀錄皆已填寫完成。</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* 表頭 */}
          <div className="bg-gray-50/80 px-6 py-3 border-b border-gray-200 grid grid-cols-12 gap-4 text-xs font-semibold text-gray-500 tracking-wider">
            <div className="col-span-1">類別</div>
            <div className="col-span-3">行程主題 / 客戶</div>
            <div className="col-span-2">結束日期</div>
            <div className="hidden sm:block sm:col-span-2">地點</div>
            <div className="col-span-3">出差人員 / PM</div>
            <div className="col-span-1 text-right">操作</div>
          </div>

          {/* 列表 */}
          <div className="divide-y divide-gray-100">
            {unreportedTrips.map((trip) => {
              const category = TRIP_CATEGORIES.find((c) => c.value === trip.category);
              return (
                <div
                  key={trip.id}
                  onClick={() => onFillReport(trip)}
                  className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-orange-50/40 transition cursor-pointer group"
                >
                  {/* 類別標籤 */}
                  <div className="col-span-1">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: category?.color || '#6b7280' }}
                    >
                      {category?.label || trip.category}
                    </span>
                  </div>

                  {/* 行程主題 */}
                  <div className="col-span-3 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{trip.subject}</p>
                    {trip.customerName && (
                      <p className="text-xs text-gray-500 truncate">🏢 {trip.customerName}</p>
                    )}
                  </div>

                  {/* 結束日期 */}
                  <div className="col-span-2 text-xs text-gray-600">
                    {formatDateChinese(trip.endDate)}
                    <span className="text-gray-400 block text-[11px]">{trip.endTime}</span>
                  </div>

                  {/* 地點 */}
                  <div className="hidden sm:block sm:col-span-2 text-xs text-gray-600 truncate">
                    📍 {trip.location || '—'}
                  </div>

                  {/* 出差人員 / PM */}
                  <div className="col-span-3 text-xs text-gray-600 min-w-0">
                    <p className="truncate">👥 {trip.travelers?.join(', ') || '—'}</p>
                    {(trip.pm || trip.tpm) && (
                      <p className="text-gray-400 truncate text-[11px]">
                        {trip.pm && `PM: ${trip.pm}`}
                        {trip.pm && trip.tpm && ' / '}
                        {trip.tpm && `TPM: ${trip.tpm}`}
                      </p>
                    )}
                  </div>

                  {/* 操作按鈕 */}
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFillReport(trip);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition shadow-sm"
                    >
                      <span>填寫</span>
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
