'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  AlertTriangle,
  Users,
  TrendingUp,
  Calendar,
  Building,
  ChevronRight,
  Filter,
  BarChart2,
  LineChart,
  Briefcase,
  Layers,
  Clock,
  FolderKanban,
  CalendarDays,
} from 'lucide-react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Cell,
} from 'recharts';
import { BusinessTrip } from '@/types/businessTrip';
import type { User, Client } from '@/types';
import { formatDateChinese } from '@/lib/calendar-helper';

// ============== 分析維度類型 ==============
type AnalysisDimension = 'team' | 'individual';

// ============== 負荷量視圖模式 ==============
type WorkloadViewMode = 'trend' | 'weekly' | 'monthly';

// ============== 分析指標 (天數 vs 專案數) ==============
type WorkloadMetric = 'days' | 'projects';

// ============== 人員/部門在特定週期的詳細統計 ==============
export interface PMPeriodDetail {
  name: string;
  days: number;           // 不重複出差日曆天數 (同一天多個專案只算 1 天)
  projectCount: number;   // 負責/處理的不重複專案數
  projectNames: string[]; // 專案名稱清單
  tripCount: number;      // 出差行程次數
}

// ============== 單月人員資料介面 ==============
interface SingleMonthPMData {
  name: string;
  days: number;
  projectCount: number;
  projectNames: string[];
  tripCount: number;
  colorIndex: number;
}

// ============== 週切片介面 ==============
export interface MonthWeekSlice {
  weekKey: string;     // e.g. "W1", "W2"
  weekLabel: string;   // e.g. "第 1 週 (9/1 - 9/6)"
  startDate: string;   // "2026-09-01"
  endDate: string;     // "2026-09-06"
  dates: string[];     // ["2026-09-01", ...]
}

export interface WeeklyPMLoad {
  weekKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  [pmName: string]: string | number | any;
  _details?: Record<string, PMPeriodDetail>;
}

// ============== 類型定義 ==============
interface ProjectResourceData {
  projectName: string;
  totalDays: number;
  tripCount: number;
  priority: number; // 3=High, 2=Medium, 1=Low (基於出差次數推算)
  isAlert: boolean; // 低優先但高天數
}

interface NeglectedClient {
  customerName: string;
  lastVisitDate: Date;
  daysSinceLastVisit: number;
  visitCount: number;
}

interface MonthlyPMLoad {
  month: string;
  monthLabel: string;
  [pmName: string]: string | number | any;
  _details?: Record<string, PMPeriodDetail>;
}

// 取得兩個日期字串之間包含的所有 YYYY-MM-DD 日期
const getDatesInRange = (startDateStr: string, endDateStr: string): string[] => {
  if (!startDateStr) return [];
  const sStr = startDateStr.slice(0, 10);
  const eStr = (endDateStr || startDateStr).slice(0, 10);

  const start = new Date(sStr.replace(/-/g, '/'));
  const end = new Date(eStr.replace(/-/g, '/'));

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return [sStr];
  }

  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }

  return dates.length > 0 ? dates : [sStr];
};

// 將特定月份 (year, month: 1-12) 切分為各週區間 (以週一為起始，週日為結束)
const getWeeksInMonth = (year: number, month: number): MonthWeekSlice[] => {
  const weeks: MonthWeekSlice[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  let currentStartDay = 1;
  let weekIndex = 1;

  while (currentStartDay <= daysInMonth) {
    const startDate = new Date(year, month - 1, currentStartDay);
    const dayOfWeek = startDate.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const endDay = Math.min(daysInMonth, currentStartDay + daysUntilSunday);

    const startStr = `${year}-${String(month).padStart(2, '0')}-${String(currentStartDay).padStart(2, '0')}`;
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const dates: string[] = [];
    for (let d = currentStartDay; d <= endDay; d++) {
      dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }

    const startLabel = `${month}/${currentStartDay}`;
    const endLabel = `${month}/${endDay}`;

    weeks.push({
      weekKey: `W${weekIndex}`,
      weekLabel: `第 ${weekIndex} 週 (${startLabel} - ${endLabel})`,
      startDate: startStr,
      endDate: endStr,
      dates,
    });

    currentStartDay = endDay + 1;
    weekIndex++;
  }

  return weeks;
};

interface DashboardData {
  projectResources: ProjectResourceData[];
  neglectedClients: NeglectedClient[];
  monthlyPMLoad: MonthlyPMLoad[];
  pmList: string[];
  summary: {
    totalTrips: number;
    totalDays: number;
    uniqueProjects: number;
    uniqueClients: number;
    uniquePMs: number;
  };
}

// 拆解多人字串成個別人名陣列
const splitNames = (nameStr: string): string[] => {
  return nameStr
    .split(/[、,\s]+/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
};

interface PersonnelLookup {
  nameToCompany: Map<string, string>;
  companies: string[];
}

const buildPersonnelLookup = (users: User[]): PersonnelLookup => {
  const nameToCompany = new Map<string, string>();
  const companySet = new Set<string>();

  users.forEach((user) => {
    const name = user.displayName || user.username || user.email;
    const company = user.department || user.clientName || '智慧製造團隊';
    if (name) {
      nameToCompany.set(name, company);
      companySet.add(company);
    }
  });

  return {
    nameToCompany,
    companies: Array.from(companySet).sort(),
  };
};

interface TransformOptions {
  dimension: AnalysisDimension;
  teamFilter: string;
  personnelLookup: PersonnelLookup;
}

const transformData = (
  trips: BusinessTrip[],
  options?: TransformOptions
): DashboardData => {
  const now = new Date();
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0);

  // 最近 6 個月資料 (涵蓋至當月底)
  const recentTrips = trips.filter((trip) => {
    const tripEnd = new Date(trip.endDate.replace(/-/g, '/'));
    const tripStart = new Date(trip.startDate.replace(/-/g, '/'));
    return tripEnd >= sixMonthsAgo && tripStart <= endOfCurrentMonth;
  });

  // 1. 資源效率矩陣 (按專案分組)
  const projectMap = new Map<string, { days: number; count: number }>();

  recentTrips.forEach((trip) => {
    const projectName = trip.projectName || '未分類專案';
    const start = new Date(trip.startDate.replace(/-/g, '/'));
    const end = new Date(trip.endDate.replace(/-/g, '/'));
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const existing = projectMap.get(projectName) || { days: 0, count: 0 };
    projectMap.set(projectName, {
      days: existing.days + days,
      count: existing.count + 1,
    });
  });

  const projectResources: ProjectResourceData[] = Array.from(projectMap.entries()).map(
    ([projectName, data]) => {
      let priority = 1;
      if (data.count >= 5) priority = 3;
      else if (data.count >= 3) priority = 2;

      const isAlert = priority === 1 && data.days > 10;

      return {
        projectName,
        totalDays: data.days,
        tripCount: data.count,
        priority,
        isAlert,
      };
    }
  );

  // 2. 客戶關懷警示 (超過 90 天未拜訪)
  const customerMap = new Map<string, { lastVisit: Date; count: number }>();

  trips.forEach((trip) => {
    if (!trip.customerName) return;

    const tripEndDate = new Date(trip.endDate.replace(/-/g, '/'));
    const existing = customerMap.get(trip.customerName);

    if (!existing || tripEndDate > existing.lastVisit) {
      customerMap.set(trip.customerName, {
        lastVisit: tripEndDate,
        count: (existing?.count || 0) + 1,
      });
    } else {
      customerMap.set(trip.customerName, {
        ...existing,
        count: existing.count + 1,
      });
    }
  });

  const neglectedClients: NeglectedClient[] = Array.from(customerMap.entries())
    .map(([customerName, data]) => {
      const daysSinceLastVisit = Math.floor(
        (now.getTime() - data.lastVisit.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        customerName,
        lastVisitDate: data.lastVisit,
        daysSinceLastVisit,
        visitCount: data.count,
      };
    })
    .filter((client) => client.daysSinceLastVisit > 90)
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);

  // 3. 團隊負荷量分析 (最近 6 個月)
  const entitySet = new Set<string>();
  const monthlyEntityMap = new Map<
    string,
    Map<string, { dateSet: Set<string>; projectSet: Set<string>; tripCount: number }>
  >();

  const dimension = options?.dimension || 'individual';
  const teamFilter = options?.teamFilter || 'all';
  const nameToCompany = options?.personnelLookup?.nameToCompany || new Map<string, string>();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    monthlyEntityMap.set(monthKey, new Map());
  }

  recentTrips.forEach((trip) => {
    const tripDates = getDatesInRange(trip.startDate, trip.endDate);
    const projectName = trip.projectName?.trim() || '';

    tripDates.forEach((dateStr) => {
      const monthKey = dateStr.slice(0, 7);
      if (!monthlyEntityMap.has(monthKey)) return;

      const monthMap = monthlyEntityMap.get(monthKey)!;

      (trip.travelers || []).forEach((travelerStr) => {
        const individualNames = splitNames(travelerStr);

        individualNames.forEach((pmName) => {
          const company = nameToCompany.get(pmName) || '專案團隊';
          const targetEntity = dimension === 'team' ? company : pmName;

          if (dimension === 'individual' && teamFilter !== 'all' && company !== teamFilter) {
            return;
          }

          entitySet.add(targetEntity);

          if (!monthMap.has(targetEntity)) {
            monthMap.set(targetEntity, {
              dateSet: new Set(),
              projectSet: new Set(),
              tripCount: 0,
            });
          }

          const record = monthMap.get(targetEntity)!;
          // 同一天不管有幾個專案行程，日曆天數只計 1 次
          record.dateSet.add(dateStr);
          // 同時如實記錄當天處理之專案名稱
          if (projectName) record.projectSet.add(projectName);
        });
      });
    });

    // 統計行程次數 (歸屬在起始月)
    const startMonth = trip.startDate.slice(0, 7);
    if (monthlyEntityMap.has(startMonth)) {
      const monthMap = monthlyEntityMap.get(startMonth)!;
      (trip.travelers || []).forEach((travelerStr) => {
        splitNames(travelerStr).forEach((pmName) => {
          const company = nameToCompany.get(pmName) || '專案團隊';
          const targetEntity = dimension === 'team' ? company : pmName;
          if (monthMap.has(targetEntity)) {
            monthMap.get(targetEntity)!.tripCount += 1;
          }
        });
      });
    }
  });

  const pmList = Array.from(entitySet).sort();
  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const monthlyPMLoad: MonthlyPMLoad[] = Array.from(monthlyEntityMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, entityMap]) => {
      const parts = monthKey.split('-');
      const monthIndex = parseInt(parts[1], 10) - 1;
      const details: Record<string, PMPeriodDetail> = {};
      const result: MonthlyPMLoad = {
        month: monthKey,
        monthLabel: `${monthLabels[monthIndex]}`,
        _details: details,
      };

      pmList.forEach((pm) => {
        const record = entityMap.get(pm);
        const days = record ? record.dateSet.size : 0;
        const projectCount = record ? record.projectSet.size : 0;
        const projectNames = record ? Array.from(record.projectSet) : [];
        const tripCount = record ? record.tripCount : 0;

        result[pm] = days;
        details[pm] = {
          name: pm,
          days,
          projectCount,
          projectNames,
          tripCount,
        };
      });
      return result;
    });

  const uniqueProjects = new Set(recentTrips.map((t) => t.projectName).filter(Boolean));
  const uniqueClients = new Set(recentTrips.map((t) => t.customerName).filter(Boolean));
  const uniquePMs = new Set(
    recentTrips.flatMap((t) => (t.travelers || []).flatMap((str) => splitNames(str)))
  );

  // 總出差人天 (每人每天出差只算 1 人天，同人同天跨專案不重複計算天數)
  const personDaySet = new Set<string>();
  recentTrips.forEach((trip) => {
    const dates = getDatesInRange(trip.startDate, trip.endDate);
    const travelers = (trip.travelers || []).flatMap((str) => splitNames(str));
    if (travelers.length === 0) {
      dates.forEach((d) => personDaySet.add(`anon_${trip.id || trip.projectName}_${d}`));
    } else {
      travelers.forEach((name) => {
        dates.forEach((d) => personDaySet.add(`${name}_${d}`));
      });
    }
  });
  const totalDays = personDaySet.size;

  return {
    projectResources,
    neglectedClients,
    monthlyPMLoad,
    pmList,
    summary: {
      totalTrips: recentTrips.length,
      totalDays,
      uniqueProjects: uniqueProjects.size,
      uniqueClients: uniqueClients.size,
      uniquePMs: uniquePMs.size,
    },
  };
};

const PM_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#eab308', '#22c55e', '#0ea5e9',
];

const getPMColor = (index: number) => PM_COLORS[index % PM_COLORS.length];

const TOP_RANK_COLORS: Record<number, string> = {
  1: '#dc2626',
  2: '#ea580c',
  3: '#f59e0b',
};

const getLeaderboardBarColor = (rank: number): string => {
  if (rank <= 3) {
    return TOP_RANK_COLORS[rank] || '#3b82f6';
  }
  return '#3b82f6';
};

const getCurrentMonthKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
};

const ScatterTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ProjectResourceData;
    const priorityLabel = data.priority === 3 ? '高' : data.priority === 2 ? '中' : '低';
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs space-y-1">
        <p className="font-bold text-gray-900 text-sm">{data.projectName}</p>
        <p className="text-gray-600">出差總天數：<span className="font-semibold text-gray-800">{data.totalDays} 天</span></p>
        <p className="text-gray-600">出差次數：<span className="font-semibold text-gray-800">{data.tripCount} 次</span></p>
        <p className="text-gray-600">推估優先級：<span className="font-semibold text-gray-800">{priorityLabel}</span></p>
        {data.isAlert && (
          <p className="text-red-600 font-bold mt-1">⚠️ 資源可能錯置 (低優先級但出差天數多)</p>
        )}
      </div>
    );
  }
  return null;
};

// 週期圖表 Tooltip (支援月度趨勢與每週分析，完整展示天數、專案數與清單)
const WorkloadPeriodTooltip = ({ active, payload, label, metric }: any) => {
  if (active && payload && payload.length) {
    const items = payload
      .filter((p: any) => Number(p.value) > 0)
      .sort((a: any, b: any) => Number(b.value) - Number(a.value));

    if (items.length === 0) return null;

    const rowPayload = payload[0]?.payload;
    const details = rowPayload?._details || {};
    const totalValue = items.reduce((sum: number, p: any) => sum + Number(p.value), 0);

    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs max-w-xs sm:max-w-sm z-50">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
          <span className="font-bold text-gray-900 text-sm">{rowPayload?.weekLabel || label}</span>
          <span className="text-gray-500 font-medium">
            本期合計: <strong className="text-gray-900 font-bold">{totalValue}</strong> {metric === 'projects' ? '個專案' : '天'}
          </span>
        </div>
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {items.map((entry: any) => {
            const pmName = entry.dataKey;
            const pmDetail: PMPeriodDetail | undefined = details[pmName];
            const days = pmDetail ? pmDetail.days : (metric === 'days' ? Number(entry.value) : 0);
            const projectCount = pmDetail ? pmDetail.projectCount : (metric === 'projects' ? Number(entry.value) : 0);
            const projectNames = pmDetail?.projectNames || [];

            return (
              <div key={pmName} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-800 truncate">
                    <div
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="truncate">{pmName}</span>
                  </div>
                  <div className="text-right shrink-0 font-medium text-gray-700">
                    <span className="font-bold text-gray-900">{days}</span> 天 / <span className="font-bold text-purple-700">{projectCount}</span> 專案
                  </div>
                </div>
                {projectNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 pl-4 pt-0.5">
                    {projectNames.map((pName) => (
                      <span
                        key={pName}
                        className="inline-block px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded-sm truncate max-w-[150px]"
                        title={pName}
                      >
                        {pName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

// 單月排行榜 Tooltip
const SingleMonthLeaderboardTooltip = ({ active, payload, metric }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as SingleMonthPMData & { rank: number };
    const rank = data.rank || 1;
    const barColor = getLeaderboardBarColor(rank);

    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs space-y-1.5 max-w-xs z-50">
        <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 font-bold">
          <div className="flex items-center gap-1.5">
            <span style={{ color: barColor }}>#{rank}</span>
            <span className="text-gray-900 text-sm">{data.name}</span>
          </div>
          {data.projectCount > data.days && data.days > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded-sm font-semibold">
              💡 同日跨專案
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-gray-600 pt-0.5">
          <div>
            出差天數：<strong className="text-gray-900 font-semibold">{data.days} 天</strong>
          </div>
          <div>
            處理專案：<strong className="text-purple-700 font-semibold">{data.projectCount} 個</strong>
          </div>
        </div>
        <div className="text-gray-500 text-[11px]">
          行程次數：<span className="text-gray-800 font-medium">{data.tripCount} 次</span>
        </div>
        {data.projectNames && data.projectNames.length > 0 && (
          <div className="pt-1.5 border-t border-gray-100">
            <p className="text-[11px] text-gray-500 mb-1">參與專案：</p>
            <div className="flex flex-wrap gap-1">
              {data.projectNames.map((pName) => (
                <span
                  key={pName}
                  className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-sm text-[10px] font-medium"
                >
                  {pName}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

interface TravelAnalyticsViewProps {
  trips: BusinessTrip[];
  users: User[];
  clients: Client[];
  onArrangeVisit?: (customerName: string) => void;
}

export function TravelAnalyticsView({
  trips,
  users,
  clients,
  onArrangeVisit,
}: TravelAnalyticsViewProps) {
  const [analysisDimension, setAnalysisDimension] = useState<AnalysisDimension>('individual');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [workloadViewMode, setWorkloadViewMode] = useState<WorkloadViewMode>('trend');
  const [workloadMetric, setWorkloadMetric] = useState<WorkloadMetric>('days');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const personnelLookup = useMemo(() => buildPersonnelLookup(users), [users]);

  useEffect(() => {
    if (analysisDimension === 'team') {
      setTeamFilter('all');
    }
  }, [analysisDimension]);

  const dashboardData = useMemo(
    () =>
      transformData(trips, {
        dimension: analysisDimension,
        teamFilter,
        personnelLookup,
      }),
    [trips, analysisDimension, teamFilter, personnelLookup]
  );

  const availableMonths = useMemo(() => {
    const monthMap = new Map<string, string>();
    dashboardData.monthlyPMLoad.forEach((m) => {
      const parts = m.month.split('-');
      monthMap.set(m.month, `${parts[0]}年${parseInt(parts[1], 10)}月`);
    });
    trips.forEach((t) => {
      if (t.startDate) {
        const mKey = t.startDate.slice(0, 7);
        if (mKey.length === 7 && !monthMap.has(mKey)) {
          const parts = mKey.split('-');
          monthMap.set(mKey, `${parts[0]}年${parseInt(parts[1], 10)}月`);
        }
      }
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a)) // 最新月份優先排前面
      .map(([value, label]) => ({ value, label }));
  }, [dashboardData.monthlyPMLoad, trips]);

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      const currentMonthKey = getCurrentMonthKey();
      const hasCurrentMonth = availableMonths.some((m) => m.value === currentMonthKey);
      if (hasCurrentMonth) {
        setSelectedMonth(currentMonthKey);
      } else {
        setSelectedMonth(availableMonths[0].value);
      }
    }
  }, [availableMonths, selectedMonth]);

  // 月度圖表資料 (依據選定指標切換數值)
  const chartMonthlyData = useMemo(() => {
    return dashboardData.monthlyPMLoad.map((item) => {
      const row: Record<string, any> = {
        month: item.month,
        monthLabel: item.monthLabel,
        _details: item._details,
      };
      dashboardData.pmList.forEach((pm) => {
        const detail = item._details?.[pm];
        row[pm] = workloadMetric === 'projects' ? (detail?.projectCount || 0) : (detail?.days || 0);
      });
      return row;
    });
  }, [dashboardData.monthlyPMLoad, dashboardData.pmList, workloadMetric]);

  // 當月每週分析資料
  const weeklyData = useMemo(() => {
    if (!selectedMonth) return [];
    const [yStr, mStr] = selectedMonth.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    if (isNaN(year) || isNaN(month)) return [];

    const weeks = getWeeksInMonth(year, month);
    const nameToCompany = personnelLookup.nameToCompany;

    return weeks.map((week) => {
      const weekEntityMap = new Map<
        string,
        { dateSet: Set<string>; projectSet: Set<string>; tripCount: number }
      >();

      trips.forEach((trip) => {
        const tripDates = getDatesInRange(trip.startDate, trip.endDate);
        const datesInThisWeek = tripDates.filter((d) => week.dates.includes(d));
        if (datesInThisWeek.length === 0) return;

        const projectName = trip.projectName?.trim() || '';

        (trip.travelers || []).forEach((travelerStr) => {
          const individualNames = splitNames(travelerStr);
          individualNames.forEach((pmName) => {
            const company = nameToCompany.get(pmName) || '專案團隊';
            const targetEntity = analysisDimension === 'team' ? company : pmName;

            if (analysisDimension === 'individual' && teamFilter !== 'all' && company !== teamFilter) {
              return;
            }

            if (!weekEntityMap.has(targetEntity)) {
              weekEntityMap.set(targetEntity, {
                dateSet: new Set(),
                projectSet: new Set(),
                tripCount: 0,
              });
            }

            const record = weekEntityMap.get(targetEntity)!;
            // 同一天多個專案行程，日曆天數只計 1 次 (去重)
            datesInThisWeek.forEach((d) => record.dateSet.add(d));
            // 如實記錄當天處理之專案名稱
            if (projectName) record.projectSet.add(projectName);
            record.tripCount += 1;
          });
        });
      });

      const details: Record<string, PMPeriodDetail> = {};
      const row: Record<string, any> = {
        weekKey: week.weekKey,
        weekLabel: week.weekLabel,
        startDate: week.startDate,
        endDate: week.endDate,
        _details: details,
      };

      dashboardData.pmList.forEach((pm) => {
        const record = weekEntityMap.get(pm);
        const days = record ? record.dateSet.size : 0;
        const projectCount = record ? record.projectSet.size : 0;
        const projectNames = record ? Array.from(record.projectSet) : [];
        const tripCount = record ? record.tripCount : 0;

        row[pm] = workloadMetric === 'projects' ? projectCount : days;
        details[pm] = {
          name: pm,
          days,
          projectCount,
          projectNames,
          tripCount,
        };
      });

      return row;
    });
  }, [
    selectedMonth,
    trips,
    analysisDimension,
    teamFilter,
    personnelLookup,
    dashboardData.pmList,
    workloadMetric,
  ]);

  // 當月每週活躍人員名單
  const weeklyActivePMs = useMemo(() => {
    const activeSet = new Set<string>();
    weeklyData.forEach((week) => {
      if (week._details) {
        Object.entries(week._details).forEach(([name, detail]) => {
          const p = detail as PMPeriodDetail;
          if (p.days > 0 || p.projectCount > 0) {
            activeSet.add(name);
          }
        });
      }
    });

    return Array.from(activeSet).sort((a, b) => {
      const sumA = weeklyData.reduce(
        (acc, w) =>
          acc + (workloadMetric === 'projects' ? (w._details?.[a]?.projectCount || 0) : (w._details?.[a]?.days || 0)),
        0
      );
      const sumB = weeklyData.reduce(
        (acc, w) =>
          acc + (workloadMetric === 'projects' ? (w._details?.[b]?.projectCount || 0) : (w._details?.[b]?.days || 0)),
        0
      );
      return sumB - sumA;
    });
  }, [weeklyData, workloadMetric]);

  // 單月人員負荷排名資料
  const singleMonthData = useMemo((): (SingleMonthPMData & { rank: number })[] => {
    if (!selectedMonth) return [];

    const monthData = dashboardData.monthlyPMLoad.find((m) => m.month === selectedMonth);

    let list: SingleMonthPMData[] = [];

    if (monthData && monthData._details) {
      list = dashboardData.pmList.map((pm, index) => {
        const detail = monthData._details?.[pm];
        const days = detail ? detail.days : (Number(monthData[pm]) || 0);
        const projectCount = detail ? detail.projectCount : 0;
        const projectNames = detail ? detail.projectNames : [];
        const tripCount = detail ? detail.tripCount : 0;
        return {
          name: pm,
          days,
          projectCount,
          projectNames,
          tripCount,
          colorIndex: index,
        };
      });
    } else {
      list = dashboardData.pmList.map((pm, index) => {
        const dateSet = new Set<string>();
        const projectSet = new Set<string>();
        let tripCount = 0;
        weeklyData.forEach((w) => {
          const d = w._details?.[pm];
          if (d) {
            d.projectNames.forEach((p: string) => projectSet.add(p));
            tripCount += d.tripCount;
          }
        });
        trips.forEach((t) => {
          const tDates = getDatesInRange(t.startDate, t.endDate).filter((d) => d.startsWith(selectedMonth));
          if (tDates.length === 0) return;
          (t.travelers || []).forEach((tr) => {
            if (splitNames(tr).includes(pm)) {
              tDates.forEach((d) => dateSet.add(d));
            }
          });
        });

        return {
          name: pm,
          days: dateSet.size,
          projectCount: projectSet.size,
          projectNames: Array.from(projectSet),
          tripCount,
          colorIndex: index,
        };
      });
    }

    const filtered = list.filter((item) =>
      workloadMetric === 'projects' ? item.projectCount > 0 : item.days > 0
    );

    filtered.sort((a, b) => {
      if (workloadMetric === 'projects') {
        if (b.projectCount !== a.projectCount) return b.projectCount - a.projectCount;
        return b.days - a.days;
      }
      if (b.days !== a.days) return b.days - a.days;
      return b.projectCount - a.projectCount;
    });

    return filtered.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [selectedMonth, dashboardData.monthlyPMLoad, dashboardData.pmList, weeklyData, trips, workloadMetric]);

  return (
    <div className="space-y-6">
      {/* 5 大核心指標摘要卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">總出差次數</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{dashboardData.summary.totalTrips} 次</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">總出差天數</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{dashboardData.summary.totalDays} 天</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">涉及專案數</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{dashboardData.summary.uniqueProjects} 個</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">拜訪客戶數</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{dashboardData.summary.uniqueClients} 家</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">出差同仁數</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{dashboardData.summary.uniquePMs} 人</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2 欄版面：左側資源效率矩陣 vs 右側客戶關懷警示 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. 資源效率矩陣 (ScatterChart) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">資源效率矩陣</h3>
                <p className="text-xs text-gray-500">檢視各專案出差資源配置是否合理 (近 6 個月)</p>
              </div>
            </div>

            {dashboardData.projectResources.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                暫無專案出差紀錄
              </div>
            ) : (
              <div className="h-72 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      dataKey="totalDays"
                      name="出差天數"
                      unit="天"
                      tick={{ fontSize: 11 }}
                      label={{ value: '出差總天數', position: 'bottom', offset: 0, fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="priority"
                      name="優先級"
                      domain={[0, 4]}
                      ticks={[1, 2, 3]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => {
                        if (value === 1) return '低';
                        if (value === 2) return '中';
                        if (value === 3) return '高';
                        return '';
                      }}
                      label={{ value: '專案優先級', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    />
                    <ZAxis type="number" dataKey="tripCount" range={[120, 800]} name="出差次數" />
                    <Tooltip content={<ScatterTooltip />} />
                    <Scatter name="專案" data={dashboardData.projectResources}>
                      {dashboardData.projectResources.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isAlert ? '#ef4444' : '#3b82f6'}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-600 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>正常配置</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>資源可能錯置 (低優先級但出差天數高)</span>
            </div>
          </div>
        </div>

        {/* 2. 客戶關懷警示 (90天未拜訪) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">客戶關懷警示</h3>
                <p className="text-xs text-gray-500">超過 90 天未現場出差或拜訪之客戶</p>
              </div>
            </div>

            {dashboardData.neglectedClients.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-emerald-50/50 rounded-xl mt-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                  <Building className="w-6 h-6" />
                </div>
                <p className="text-emerald-800 font-bold text-sm">維繫狀態良好！</p>
                <p className="text-emerald-600 text-xs mt-0.5">所有客戶在 90 天內皆有出差拜訪紀錄</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 mt-3">
                {dashboardData.neglectedClients.map((client, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl hover:bg-amber-50 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-extrabold rounded-md shrink-0 text-white ${
                          client.daysSinceLastVisit > 180
                            ? 'bg-red-600'
                            : client.daysSinceLastVisit > 120
                            ? 'bg-amber-600'
                            : 'bg-amber-500'
                        }`}
                      >
                        {client.daysSinceLastVisit} 天
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{client.customerName}</p>
                        <p className="text-xs text-gray-500 truncate">
                          上次拜訪：{formatDateChinese(client.lastVisitDate)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-gray-500 block">累計拜訪</span>
                      <span className="font-bold text-gray-800 text-xs">{client.visitCount} 次</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {dashboardData.neglectedClients.length > 0 && (
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs mt-3">
              <span className="text-gray-500 font-medium">
                共 <span className="text-red-600 font-bold">{dashboardData.neglectedClients.length}</span> 位客戶需要關注
              </span>
              {onArrangeVisit && (
                <button
                  type="button"
                  onClick={() => onArrangeVisit(dashboardData.neglectedClients[0]?.customerName || '')}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                >
                  <span>安排拜訪</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. 團隊負荷量分析 (全寬卡片) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs">
        {/* 控制列 */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-base font-bold text-gray-900">團隊負荷量分析</h3>
                {/* 3 種模式切換按鈕組 */}
                <div className="inline-flex bg-gray-100 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setWorkloadViewMode('trend')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition cursor-pointer ${
                      workloadViewMode === 'trend'
                        ? 'bg-white text-purple-700 shadow-2xs font-bold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <LineChart className="w-3.5 h-3.5" />
                    <span>月度趨勢</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkloadViewMode('weekly')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition cursor-pointer ${
                      workloadViewMode === 'weekly'
                        ? 'bg-white text-purple-700 shadow-2xs font-bold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>當月每週</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkloadViewMode('monthly')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition cursor-pointer ${
                      workloadViewMode === 'monthly'
                        ? 'bg-white text-purple-700 shadow-2xs font-bold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>人員排行</span>
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {workloadViewMode === 'trend'
                  ? `近 6 個月${analysisDimension === 'team' ? '各部門' : '各同仁'}${workloadMetric === 'days' ? '出差天數趨勢 (同日去重)' : '負責專案數趨勢'}`
                  : workloadViewMode === 'weekly'
                  ? `${availableMonths.find((m) => m.value === selectedMonth)?.label || selectedMonth} 各週${analysisDimension === 'team' ? '各部門' : '各同仁'}${workloadMetric === 'days' ? '出差天數分析 (同日去重)' : '負責專案數分析'}`
                  : `${availableMonths.find((m) => m.value === selectedMonth)?.label || selectedMonth} ${analysisDimension === 'team' ? '各部門' : '各同仁'}${workloadMetric === 'days' ? '出差天數排行 (同日去重)' : '負責專案數排行'}`}
              </p>
            </div>
          </div>

          {/* 右側篩選切換區 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 月份選擇下拉 (當在每週或排行模式時) */}
            {workloadViewMode !== 'trend' && availableMonths.length > 0 && (
              <div className="flex items-center gap-1.5 bg-blue-50/80 border border-blue-200/80 px-2.5 py-1 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-xs text-blue-800 font-medium shrink-0">月份:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs text-blue-950 font-bold focus:outline-hidden cursor-pointer"
                >
                  {availableMonths.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 指標切換 (天數 vs 專案數) */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setWorkloadMetric('days')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  workloadMetric === 'days'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="同人同一天跨專案出差去重，日曆天計 1 天"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>出差天數</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkloadMetric('projects')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  workloadMetric === 'projects'
                    ? 'bg-white text-purple-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="統計同期間實際處理之不重複專案數"
              >
                <FolderKanban className="w-3.5 h-3.5" />
                <span>負責專案數</span>
              </button>
            </div>

            {/* 依部門 / 依人員 切換 */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setAnalysisDimension('team')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  analysisDimension === 'team'
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>依部門</span>
              </button>
              <button
                type="button"
                onClick={() => setAnalysisDimension('individual')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  analysisDimension === 'individual'
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>依人員</span>
              </button>
            </div>

            {/* 部門篩選下拉 (當維度為依人員時) */}
            {analysisDimension === 'individual' && personnelLookup.companies.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-gray-500" />
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs bg-white text-gray-700"
                >
                  <option value="all">全部部門</option>
                  {personnelLookup.companies.map((comp) => (
                    <option key={comp} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 1. 趨勢檢視 (Stacked BarChart) */}
        {workloadViewMode === 'trend' && (
          chartMonthlyData.length === 0 || dashboardData.pmList.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              {analysisDimension === 'individual' && teamFilter !== 'all'
                ? `「${teamFilter}」部門暫無出差紀錄`
                : '暫無出差負荷量資料'}
            </div>
          ) : (
            <>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartMonthlyData}
                    margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      label={{
                        value: workloadMetric === 'days' ? '出差天數 (天)' : '負責專案數 (個)',
                        angle: -90,
                        position: 'insideLeft',
                        fontSize: 11,
                      }}
                    />
                    <Tooltip content={<WorkloadPeriodTooltip metric={workloadMetric} />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    {dashboardData.pmList.map((pm, index) => (
                      <Bar
                        key={pm}
                        dataKey={pm}
                        stackId="trend"
                        fill={getPMColor(index)}
                        name={pm}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 底部各成員 6 個月累積指標標籤 */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-3">
                {dashboardData.pmList.map((pm, index) => {
                  const totalDays = dashboardData.monthlyPMLoad.reduce(
                    (sum, m) => sum + (m._details?.[pm]?.days || 0),
                    0
                  );
                  const totalProjects = new Set(
                    dashboardData.monthlyPMLoad.flatMap((m) => m._details?.[pm]?.projectNames || [])
                  ).size;

                  return (
                    <div key={pm} className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200/60 px-2 py-1 rounded-md">
                      <div
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: getPMColor(index) }}
                      />
                      <span className="text-gray-800 font-semibold">{pm}</span>
                      <span className="text-gray-500 font-mono text-[11px]">
                        ({totalDays}天 / {totalProjects}專案)
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )
        )}

        {/* 2. 當月每週分析檢視 (Weekly Stacked BarChart + 每週明細卡片) */}
        {workloadViewMode === 'weekly' && (
          weeklyActivePMs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-sm">
              <Calendar className="w-8 h-8 text-gray-300 mb-2" />
              <p>{selectedMonth ? `${selectedMonth} 暫無出差資料` : '請選擇月份'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 每週負荷量 Stacked BarChart */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weeklyData}
                    margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      label={{
                        value: workloadMetric === 'days' ? '出差天數 (天)' : '負責專案數 (個)',
                        angle: -90,
                        position: 'insideLeft',
                        fontSize: 11,
                      }}
                    />
                    <Tooltip content={<WorkloadPeriodTooltip metric={workloadMetric} />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    {weeklyActivePMs.map((pm, index) => (
                      <Bar
                        key={pm}
                        dataKey={pm}
                        stackId="weekly"
                        fill={getPMColor(index)}
                        name={pm}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 每週明細卡片清單 */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                  各週出差人員與專案明細 (同一天跨專案天數已去重)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {weeklyData.map((week) => {
                    const activeInWeek = weeklyActivePMs
                      .map((pm) => week._details?.[pm])
                      .filter((d): d is PMPeriodDetail => Boolean(d && (d.days > 0 || d.projectCount > 0)));

                    const weekTotalDays = activeInWeek.reduce((s, it) => s + it.days, 0);
                    const weekUniqueProjects = new Set(activeInWeek.flatMap((it) => it.projectNames)).size;

                    return (
                      <div
                        key={week.weekKey}
                        className="bg-gray-50/70 border border-gray-200 rounded-xl p-3.5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-gray-200/70 mb-2.5">
                            <span className="font-bold text-gray-900 text-sm">{week.weekLabel}</span>
                            <span className="text-[11px] font-semibold text-gray-600 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                              共 {weekTotalDays} 天 / {weekUniqueProjects} 專案
                            </span>
                          </div>

                          {activeInWeek.length === 0 ? (
                            <p className="text-xs text-gray-400 py-3 text-center">本週無出差紀錄</p>
                          ) : (
                            <div className="space-y-2.5">
                              {activeInWeek.map((pm) => (
                                <div
                                  key={pm.name}
                                  className="bg-white border border-gray-200/80 rounded-lg p-2.5 shadow-2xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-gray-900 text-xs">{pm.name}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-xs">
                                        {pm.days} 天
                                      </span>
                                      <span className="text-xs font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-xs">
                                        {pm.projectCount} 個專案
                                      </span>
                                    </div>
                                  </div>

                                  {/* 同日跨專案標籤 */}
                                  {pm.projectCount > pm.days && pm.days > 0 && (
                                    <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-xs font-medium">
                                      <span>💡 同日負責多專案</span>
                                    </div>
                                  )}

                                  {/* 專案名稱徽章 */}
                                  {pm.projectNames.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                      {pm.projectNames.map((pName) => (
                                        <span
                                          key={pName}
                                          className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-sm text-[10px] truncate max-w-[170px]"
                                          title={pName}
                                        >
                                          {pName}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        )}

        {/* 3. 單月排行榜檢視 (Leaderboard BarChart + 人員負荷明細卡片) */}
        {workloadViewMode === 'monthly' && (
          singleMonthData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-sm">
              <BarChart2 className="w-8 h-8 text-gray-300 mb-2" />
              <p>{selectedMonth ? `${selectedMonth} 暫無出差資料` : '請選擇月份'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 排行榜長條圖 */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={singleMonthData}
                    margin={{ top: 20, right: 20, left: 10, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      angle={-30}
                      textAnchor="end"
                      height={60}
                      interval={0}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      label={{
                        value: workloadMetric === 'days' ? '出差天數 (天)' : '負責專案數 (個)',
                        angle: -90,
                        position: 'insideLeft',
                        fontSize: 11,
                      }}
                    />
                    <Tooltip content={<SingleMonthLeaderboardTooltip metric={workloadMetric} />} />
                    <Bar
                      dataKey={workloadMetric === 'projects' ? 'projectCount' : 'days'}
                      radius={[4, 4, 0, 0]}
                    >
                      {singleMonthData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={getLeaderboardBarColor(index + 1)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top 3 說明圖例與月份總結 */}
              <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-500 gap-2">
                <span>
                  共 <strong className="text-gray-900">{singleMonthData.length}</strong> 位人員出差，總計{' '}
                  <strong className="text-gray-900">{singleMonthData.reduce((s, it) => s + it.days, 0)}</strong> 天，涵蓋{' '}
                  <strong className="text-purple-700">
                    {new Set(singleMonthData.flatMap((it) => it.projectNames)).size}
                  </strong>{' '}
                  個專案
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-xs bg-red-600" />
                    <span>Top 1</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-xs bg-orange-600" />
                    <span>Top 2</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                    <span>Top 3</span>
                  </div>
                </div>
              </div>

              {/* 人員負荷與專案明細卡片網格 */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                  人員出差明細卡片 (含負責專案清單)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {singleMonthData.map((item) => {
                    const isTop1 = item.rank === 1;
                    const isTop2 = item.rank === 2;
                    const isTop3 = item.rank === 3;
                    const rankBadgeColor = isTop1
                      ? 'bg-red-600 text-white'
                      : isTop2
                      ? 'bg-orange-600 text-white'
                      : isTop3
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-700';

                    return (
                      <div
                        key={item.name}
                        className={`bg-white border rounded-xl p-4 shadow-2xs space-y-3 transition hover:shadow-xs ${
                          isTop1 ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-extrabold ${rankBadgeColor}`}>
                              #{item.rank}
                            </span>
                            <span className="font-bold text-gray-900 text-sm">{item.name}</span>
                          </div>
                          {item.projectCount > item.days && item.days > 0 && (
                            <span className="px-2 py-0.5 text-[10px] bg-amber-50 text-amber-800 border border-amber-200 rounded-md font-semibold">
                              💡 兼顧 {item.projectCount} 專案
                            </span>
                          )}
                        </div>

                        {/* 指標統計格 */}
                        <div className="grid grid-cols-3 gap-2 bg-gray-50/80 p-2.5 rounded-lg text-center">
                          <div>
                            <span className="text-[10px] text-gray-500 block">出差天數</span>
                            <span className="font-bold text-gray-900 text-sm">{item.days} 天</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 block">負責專案</span>
                            <span className="font-bold text-purple-700 text-sm">{item.projectCount} 個</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 block">出差行程</span>
                            <span className="font-bold text-gray-800 text-sm">{item.tripCount} 次</span>
                          </div>
                        </div>

                        {/* 專案名稱列表 */}
                        {item.projectNames.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[11px] text-gray-500 font-medium block">參與專案：</span>
                            <div className="flex flex-wrap gap-1">
                              {item.projectNames.map((pName) => (
                                <span
                                  key={pName}
                                  className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium truncate max-w-full"
                                  title={pName}
                                >
                                  {pName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* 4. 資源錯置警示面板 (若有低優先但高天數專案自動提示) */}
      {dashboardData.projectResources.filter((p) => p.isAlert).length > 0 && (
        <div className="bg-red-50/80 border border-red-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center gap-2.5 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-red-800 text-sm">專案資源錯置警示</h3>
          </div>
          <p className="text-xs text-red-600 mb-3">
            以下專案出差頻率較低（推估非核心專案），但累計出差天數已超過 10 天，建議主管檢視資源配置是否合宜：
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dashboardData.projectResources
              .filter((p) => p.isAlert)
              .map((project, index) => (
                <div key={index} className="bg-white border border-red-200 rounded-lg p-3">
                  <p className="font-bold text-gray-900 text-sm truncate">{project.projectName}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                    <span>出差 {project.tripCount} 次</span>
                    <span>累計 {project.totalDays} 天</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
