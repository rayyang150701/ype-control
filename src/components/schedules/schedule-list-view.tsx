'use client';

import { useMemo } from 'react';
import { Edit, Trash2, CalendarOff, Users } from 'lucide-react';
import { BusinessTrip, TRIP_CATEGORIES, Holiday } from '@/types/businessTrip';
import { isTripReportOverdue, findHoliday } from '@/lib/calendar-helper';

interface ScheduleListViewProps {
  trips: BusinessTrip[];
  holidays: Holiday[];
  onTripClick: (trip: BusinessTrip) => void;
  onEditTrip: (trip: BusinessTrip) => void;
  onDeleteTrip: (trip: BusinessTrip) => void;
}

// 按日期分組並降冪排列
const groupTripsByDate = (trips: BusinessTrip[]) => {
  const sorted = [...trips].sort(
    (a, b) => new Date(b.startDate.replace(/-/g, '/')).getTime() - new Date(a.startDate.replace(/-/g, '/')).getTime()
  );

  const groups: { dateKey: string; dateLabel: string; weekday: string; trips: BusinessTrip[] }[] = [];
  const map = new Map<string, BusinessTrip[]>();

  for (const trip of sorted) {
    const key = trip.startDate.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(trip);
  }

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  for (const [key, groupTrips] of map) {
    const [y, m, d] = key.split('-');
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    groups.push({
      dateKey: key,
      dateLabel: `${y}/${m}/${d}`,
      weekday: `週${weekdays[date.getDay()]}`,
      trips: groupTrips,
    });
  }

  return groups;
};

// 狀態 Badge 設定
const statusConfig: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  confirmed: {
    label: '已確認',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
  },
  pending: {
    label: '待確認',
    dot: 'bg-amber-500',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
  },
};

const overdueConfig = {
  label: '待補件',
  dot: 'bg-red-500 animate-pulse',
  bg: 'bg-red-50 border-red-200',
  text: 'text-red-700',
};

export function ScheduleListView({
  trips,
  holidays,
  onTripClick,
  onEditTrip,
  onDeleteTrip,
}: ScheduleListViewProps) {
  const groups = useMemo(() => groupTripsByDate(trips), [trips]);

  if (trips.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-16 text-center shadow-sm">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CalendarOff className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-700 mb-1">目前沒有行程資料</h3>
        <p className="text-sm text-gray-400">
          請使用右上方「+ 新增行程」按鈕建立新行程，或調整篩選條件。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* 表格標題列 */}
      <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-gray-100/80 border border-gray-200 rounded-t-xl text-xs font-semibold text-gray-600 tracking-wider">
        <div className="col-span-3">專案 / 客戶</div>
        <div className="col-span-3">行程主題</div>
        <div className="col-span-2">人員 / TPM</div>
        <div className="col-span-2">狀態</div>
        <div className="col-span-2 text-right">操作</div>
      </div>

      {/* 分組列表 */}
      {groups.map((group) => {
        const [y, m, d] = group.dateKey.split('-');
        const groupDate = new Date(Number(y), Number(m) - 1, Number(d));
        const holiday = findHoliday(groupDate, holidays);

        return (
          <div key={group.dateKey}>
            {/* 日期分組標題 */}
            <div
              className={`flex items-center gap-3 px-6 py-2 border-x border-gray-200 ${
                holiday ? 'bg-red-50/70' : 'bg-gray-50'
              }`}
            >
              <span className={`text-sm font-bold ${holiday ? 'text-red-600' : 'text-gray-800'}`}>
                {group.dateLabel}
              </span>
              <span className="text-xs text-gray-500 font-medium">{group.weekday}</span>
              {holiday && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded font-medium">
                  {holiday.name}
                </span>
              )}
              <span className="text-xs text-gray-400">
                {group.trips.length} 筆行程
              </span>
              <div className="flex-1 border-b border-gray-200" />
            </div>

            {/* 該日期下的行程列表 */}
            {group.trips.map((trip) => {
              const category = TRIP_CATEGORIES.find((c) => c.value === trip.category);
              const isOverdue = isTripReportOverdue(trip.endDate, trip.endTime, trip.notes);
              const sConfig = isOverdue ? overdueConfig : statusConfig[trip.status] || statusConfig.pending;

              // 人員縮寫與數量
              const travelers = trip.travelers ? trip.travelers.slice(0, 3) : [];
              const extraCount = trip.travelers ? Math.max(0, trip.travelers.length - 3) : 0;

              return (
                <div
                  key={trip.id}
                  onClick={() => onTripClick(trip)}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-3.5 border-x border-b border-gray-200 bg-white hover:bg-blue-50/40 transition-colors cursor-pointer group items-center"
                >
                  {/* 專案 / 客戶 */}
                  <div className="md:col-span-3 flex items-center gap-3 min-w-0">
                    <div
                      className="hidden md:block w-1.5 h-9 rounded-full shrink-0"
                      style={{ backgroundColor: category?.color || '#3b82f6' }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {trip.projectName || '—'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {trip.customerName || '未指定客戶'}
                      </p>
                    </div>
                  </div>

                  {/* 行程主題 */}
                  <div className="md:col-span-3 flex items-center min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">{trip.subject}</p>
                        {Boolean(trip.lunchBoxes && trip.lunchBoxes > 0) && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            🍱 {trip.lunchBoxes}個便當
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 md:hidden">
                        {group.dateLabel} {trip.startTime}–{trip.endTime}
                      </p>
                      <p className="text-xs text-gray-500 hidden md:block truncate">
                        {trip.startTime}–{trip.endTime} {trip.location ? `・ 📍 ${trip.location}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* 人員 / TPM */}
                  <div className="md:col-span-2 flex items-center gap-2 min-w-0">
                    <div className="flex -space-x-1.5 shrink-0">
                      {travelers.map((name, idx) => (
                        <div
                          key={idx}
                          className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 border-2 border-white flex items-center justify-center text-xs font-semibold shrink-0"
                          title={name}
                        >
                          {name.slice(-1)}
                        </div>
                      ))}
                      {extraCount > 0 && (
                        <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 border-2 border-white flex items-center justify-center text-xs font-medium shrink-0">
                          +{extraCount}
                        </div>
                      )}
                    </div>
                    {trip.tpm && (
                      <div className="hidden lg:flex items-center gap-1 text-xs text-gray-500 min-w-0">
                        <Users className="w-3 h-3 shrink-0" />
                        <span className="truncate">{trip.tpm}</span>
                      </div>
                    )}
                  </div>

                  {/* 狀態 */}
                  <div className="md:col-span-2 flex items-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sConfig.bg} ${sConfig.text}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${sConfig.dot}`} />
                      {sConfig.label}
                    </span>
                  </div>

                  {/* 操作按鈕 */}
                  <div className="md:col-span-2 flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTrip(trip);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition opacity-0 group-hover:opacity-100"
                      title="編輯"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTrip(trip);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                      title="刪除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="h-2 bg-gray-100 rounded-b-xl border-x border-b border-gray-200" />
    </div>
  );
}
