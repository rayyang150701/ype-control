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
type WorkloadViewMode = 'trend' | 'monthly';

// ============== 單月人員資料介面 ==============
interface SingleMonthPMData {
  name: string;
  days: number;
  colorIndex: number;
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
  [pmName: string]: string | number;
}

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
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // 最近 6 個月資料
  const recentTrips = trips.filter((trip) => {
    const tripDate = new Date(trip.endDate.replace(/-/g, '/'));
    return tripDate >= sixMonthsAgo && tripDate <= now;
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
  const monthlyData = new Map<string, Map<string, number>>();

  const dimension = options?.dimension || 'individual';
  const teamFilter = options?.teamFilter || 'all';
  const nameToCompany = options?.personnelLookup?.nameToCompany || new Map<string, string>();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    monthlyData.set(monthKey, new Map());
  }

  recentTrips.forEach((trip) => {
    const tripDate = new Date(trip.startDate.replace(/-/g, '/'));
    const monthKey = `${tripDate.getFullYear()}-${(tripDate.getMonth() + 1).toString().padStart(2, '0')}`;

    if (!monthlyData.has(monthKey)) return;

    const start = new Date(trip.startDate.replace(/-/g, '/'));
    const end = new Date(trip.endDate.replace(/-/g, '/'));
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    (trip.travelers || []).forEach((travelerStr) => {
      const individualNames = splitNames(travelerStr);

      individualNames.forEach((pmName) => {
        const company = nameToCompany.get(pmName) || '專案團隊';

        if (dimension === 'team') {
          entitySet.add(company);
          const monthMap = monthlyData.get(monthKey)!;
          monthMap.set(company, (monthMap.get(company) || 0) + days);
        } else {
          if (teamFilter !== 'all' && company !== teamFilter) {
            return;
          }
          entitySet.add(pmName);
          const monthMap = monthlyData.get(monthKey)!;
          monthMap.set(pmName, (monthMap.get(pmName) || 0) + days);
        }
      });
    });
  });

  const pmList = Array.from(entitySet).sort();
  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const monthlyPMLoad: MonthlyPMLoad[] = Array.from(monthlyData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, pmMap]) => {
      const parts = monthKey.split('-');
      const monthIndex = parseInt(parts[1], 10) - 1;
      const result: MonthlyPMLoad = {
        month: monthKey,
        monthLabel: `${monthLabels[monthIndex]}`,
      };
      pmList.forEach((pm) => {
        result[pm] = pmMap.get(pm) || 0;
      });
      return result;
    });

  const uniqueProjects = new Set(recentTrips.map((t) => t.projectName).filter(Boolean));
  const uniqueClients = new Set(recentTrips.map((t) => t.customerName).filter(Boolean));
  const uniquePMs = new Set(
    recentTrips.flatMap((t) => (t.travelers || []).flatMap((str) => splitNames(str)))
  );

  let totalDays = 0;
  recentTrips.forEach((trip) => {
    const start = new Date(trip.startDate.replace(/-/g, '/'));
    const end = new Date(trip.endDate.replace(/-/g, '/'));
    totalDays += Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  });

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
    return dashboardData.monthlyPMLoad
      .filter((monthData) => {
        return dashboardData.pmList.some((pm) => (Number(monthData[pm]) || 0) > 0);
      })
      .map((monthData) => ({
        value: monthData.month,
        label: `${monthData.month.split('-')[0]}年${monthData.monthLabel}`,
      }));
  }, [dashboardData.monthlyPMLoad, dashboardData.pmList]);

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      const currentMonthKey = getCurrentMonthKey();
      const hasCurrentMonth = availableMonths.some((m) => m.value === currentMonthKey);
      if (hasCurrentMonth) {
        setSelectedMonth(currentMonthKey);
      } else {
        setSelectedMonth(availableMonths[availableMonths.length - 1].value);
      }
    }
  }, [availableMonths, selectedMonth]);

  const singleMonthData = useMemo((): SingleMonthPMData[] => {
    if (workloadViewMode !== 'monthly' || !selectedMonth) return [];

    const monthData = dashboardData.monthlyPMLoad.find((m) => m.month === selectedMonth);
    if (!monthData) return [];

    return dashboardData.pmList
      .map((pm, index) => ({
        name: pm,
        days: Number(monthData[pm]) || 0,
        colorIndex: index,
      }))
      .filter((item) => item.days > 0)
      .sort((a, b) => b.days - a.days);
  }, [workloadViewMode, selectedMonth, dashboardData.monthlyPMLoad, dashboardData.pmList]);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-gray-900">團隊負荷量分析</h3>
                {/* 視圖切換 (趨勢圖 vs 本月排行) */}
                <button
                  type="button"
                  onClick={() => setWorkloadViewMode(workloadViewMode === 'trend' ? 'monthly' : 'trend')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition shadow-xs text-white cursor-pointer"
                  style={{
                    background:
                      workloadViewMode === 'trend'
                        ? 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)'
                        : 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
                  }}
                >
                  {workloadViewMode === 'trend' ? (
                    <>
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span>查看本月排行</span>
                    </>
                  ) : (
                    <>
                      <LineChart className="w-3.5 h-3.5" />
                      <span>返回趨勢圖</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {workloadViewMode === 'trend'
                  ? analysisDimension === 'team'
                    ? '各部門每月出差天數趨勢'
                    : '各人員每月出差天數趨勢'
                  : `${availableMonths.find((m) => m.value === selectedMonth)?.label || '選定月份'} 出差天數排行`}
              </p>
            </div>
          </div>

          {/* 右側篩選切換區 */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 月份選擇下拉 */}
            {workloadViewMode === 'monthly' && availableMonths.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-2.5 py-1 border border-blue-200 rounded-lg text-xs bg-blue-50/50 text-blue-900 font-medium"
                >
                  {availableMonths.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 依部門 / 依人員 切換 */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setAnalysisDimension('team')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  analysisDimension === 'team'
                    ? 'bg-white text-purple-700 shadow-2xs font-bold'
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
                    ? 'bg-white text-purple-700 shadow-2xs font-bold'
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

        {/* 趨勢檢視 (Stacked BarChart) */}
        {workloadViewMode === 'trend' && (
          dashboardData.monthlyPMLoad.length === 0 || dashboardData.pmList.length === 0 ? (
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
                    data={dashboardData.monthlyPMLoad}
                    margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      label={{ value: '出差天數', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [`${value} 天`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    {dashboardData.pmList.map((pm, index) => (
                      <Bar
                        key={pm}
                        dataKey={pm}
                        stackId="a"
                        fill={getPMColor(index)}
                        name={pm}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 底部各成員累積天數標籤 */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-3">
                {dashboardData.pmList.map((pm, index) => {
                  const total = dashboardData.monthlyPMLoad.reduce(
                    (sum, m) => sum + (Number(m[pm]) || 0),
                    0
                  );
                  return (
                    <div key={pm} className="flex items-center gap-1.5 text-xs">
                      <div
                        className="w-2.5 h-2.5 rounded-xs"
                        style={{ backgroundColor: getPMColor(index) }}
                      />
                      <span className="text-gray-700 font-medium">{pm}</span>
                      <span className="text-gray-400 font-mono">({total}天)</span>
                    </div>
                  );
                })}
              </div>
            </>
          )
        )}

        {/* 單月排行榜檢視 */}
        {workloadViewMode === 'monthly' && (
          singleMonthData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              {selectedMonth ? `${selectedMonth} 暫無出差資料` : '請選擇月份'}
            </div>
          ) : (
            <>
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
                      label={{ value: '出差天數', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as SingleMonthPMData;
                          const rank = singleMonthData.findIndex((it) => it.name === data.name) + 1;
                          const barColor = getLeaderboardBarColor(rank);

                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-xs">
                              <div className="flex items-center gap-1.5 font-bold">
                                <span style={{ color: barColor }}>#{rank}</span>
                                <span className="text-gray-900">{data.name}</span>
                              </div>
                              <p className="text-gray-600 mt-1">
                                出差天數：<span className="font-semibold text-gray-900">{data.days} 天</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="days" radius={[4, 4, 0, 0]}>
                      {singleMonthData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={getLeaderboardBarColor(index + 1)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top 3 說明圖例 */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>
                  共 {singleMonthData.length} 位人員出差，總計 {singleMonthData.reduce((s, it) => s + it.days, 0)} 天
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
            </>
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
