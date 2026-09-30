'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CurrentUser, UserRole } from '@/types';
import { syncCurrentUser } from '@/lib/actions';

// 五大標準角色定義（符合權限管制表）
export type NormalizedRole = 'admin' | 'management' | 'execution' | 'monitor' | 'guest';

export interface ModulePermission {
  canView: boolean;
  canManage: boolean;
}

export interface RolePermissions {
  dashboard: ModulePermission;    // 燁輝進度管制表
  tasks: ModulePermission;        // 專案待辦
  schedules: ModulePermission;    // 專案行程
  gapAnalysis: ModulePermission;  // 專案 Gap-analysis
  km: ModulePermission;           // 專案 KM
  map: ModulePermission;          // 專案 MAP
}

export interface RoleInfo {
  role: NormalizedRole;
  label: string;
  badge: string;
  desc: string;
  icon: string;
}

export const ROLE_CONFIG: Record<NormalizedRole, RoleInfo> = {
  admin: {
    role: 'admin',
    label: '管理者',
    badge: '👑 管理者',
    desc: '系統最高權限（專案MAP、帳號與客戶管理、全部模組完全管理）',
    icon: '👑',
  },
  management: {
    role: 'management',
    label: '億威 PM',
    badge: '💼 億威 PM',
    desc: '專案管理權限（進度管制表、專案待辦、行程、Gap、KM 完全管理）',
    icon: '💼',
  },
  execution: {
    role: 'execution',
    label: '億威各部門',
    badge: '⚙️ 億威各部門',
    desc: '內部執行權限（專案行程完全管理；管制表、待辦、Gap、KM 僅能檢視）',
    icon: '⚙️',
  },
  monitor: {
    role: 'monitor',
    label: '燁輝/其他',
    badge: '📊 燁輝/其他',
    desc: '客戶監控權限（進度管制表完全管理；待辦、行程、Gap、KM 僅能檢視）',
    icon: '📊',
  },
  guest: {
    role: 'guest',
    label: '訪客',
    badge: '👤 訪客',
    desc: '訪客權限（進度管制表、專案待辦僅能檢視；行程、Gap、KM、MAP 無法檢視）',
    icon: '👤',
  },
};

// 權限矩陣解析函式（依據使用者上傳之權限管制表嚴格設定）
export function getRolePermissions(role: NormalizedRole): RolePermissions {
  switch (role) {
    case 'admin':
      return {
        dashboard: { canView: true, canManage: true },
        tasks: { canView: true, canManage: true },
        schedules: { canView: true, canManage: true },
        gapAnalysis: { canView: true, canManage: true },
        km: { canView: true, canManage: true },
        map: { canView: true, canManage: true },
      };
    case 'management':
      return {
        dashboard: { canView: true, canManage: true },
        tasks: { canView: true, canManage: true },
        schedules: { canView: true, canManage: true },
        gapAnalysis: { canView: true, canManage: true },
        km: { canView: true, canManage: true },
        map: { canView: false, canManage: false }, // 專案 MAP: 無法檢視、編輯 (看不到 icon)
      };
    case 'execution':
      return {
        dashboard: { canView: true, canManage: false }, // 燁輝進度管制表: 僅能檢視
        tasks: { canView: true, canManage: false },     // 專案待辦: 僅能檢視
        schedules: { canView: true, canManage: true },  // 專案行程: 完全管理
        gapAnalysis: { canView: true, canManage: false }, // Gap: 僅能檢視
        km: { canView: true, canManage: false },        // KM: 僅能檢視
        map: { canView: false, canManage: false },      // 專案 MAP: 無法檢視、編輯 (看不到 icon)
      };
    case 'monitor':
      return {
        dashboard: { canView: true, canManage: true },  // 燁輝進度管制表: 完全管理
        tasks: { canView: true, canManage: false },     // 專案待辦: 僅能檢視
        schedules: { canView: true, canManage: false }, // 專案行程: 僅能檢視
        gapAnalysis: { canView: true, canManage: false }, // Gap: 僅能檢視
        km: { canView: true, canManage: false },        // KM: 僅能檢視
        map: { canView: false, canManage: false },      // 專案 MAP: 無法檢視、編輯 (看不到 icon)
      };
    case 'guest':
    default:
      return {
        dashboard: { canView: true, canManage: false }, // 燁輝進度管制表: 僅能檢視
        tasks: { canView: true, canManage: false },     // 專案待辦: 僅能檢視
        schedules: { canView: false, canManage: false }, // 專案行程: 無法檢視、編輯 (看不到 icon)
        gapAnalysis: { canView: false, canManage: false }, // Gap: 無法檢視、編輯 (看不到 icon)
        km: { canView: false, canManage: false },        // KM: 無法檢視、編輯 (看不到 icon)
        map: { canView: false, canManage: false },      // 專案 MAP: 無法檢視、編輯 (看不到 icon)
      };
  }
}

export function normalizeUserRole(user?: CurrentUser | null): NormalizedRole {
  if (!user) return 'guest';
  const rawRole = (user.role || '').toLowerCase();

  if (rawRole === 'admin' || rawRole === 'super_admin') {
    // 只有 admin 或系統主管理員才是 admin
    if (
      user.email?.toLowerCase() === 'admin@emmt.com.tw' ||
      user.email?.toLowerCase() === 'jamesyang@emmt.com.tw' ||
      user.username?.toLowerCase() === 'admin'
    ) {
      return 'admin';
    }
    // 其他原標為 admin 但屬於 PM 部門者，標準對應為 management
    if (user.department?.toUpperCase() === 'PM') {
      return 'management';
    }
    return 'admin';
  }

  if (rawRole === 'management') return 'management';
  if (rawRole === 'execution') return 'execution';
  if (rawRole === 'monitor') return 'monitor';
  if (rawRole === 'guest') return 'guest';

  // 舊版 editor 相容判斷
  if (rawRole === 'editor') {
    if (user.department?.toUpperCase() === 'PM') return 'management';
    if (user.clientName === '燁輝' || user.company === '燁輝' || user.email?.includes('yiehphui.com.tw')) {
      return 'monitor';
    }
    if (user.clientName === '億威電子' || user.company === '億威電子') {
      return 'execution';
    }
    return 'monitor';
  }

  // 舊版 viewer 相容判斷
  if (rawRole === 'viewer') {
    if (user.email === 'guest@xxx.xxx') return 'guest';
    return 'monitor';
  }

  return 'guest';
}

interface AdminContextType {
  currentUser: CurrentUser | null;
  role: NormalizedRole;
  roleInfo: RoleInfo;
  permissions: RolePermissions;
  // 向下相容輔助屬性
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isGuest: boolean;
  isLoaded: boolean;
  setIsAdmin: (val: boolean) => void;
  isLoginDialogOpen: boolean;
  setIsLoginDialogOpen: (val: boolean) => void;
  login: (user: CurrentUser) => void;
  logout: () => void;
}

const defaultAdminUser: CurrentUser = {
  uid: '9d8f085a-5eb4-4346-93ec-435c33cd59d8',
  username: 'admin@emmt.com.tw',
  displayName: 'admin',
  email: 'admin@emmt.com.tw',
  role: 'admin',
  company: '億威電子',
  department: '管理部',
};

const defaultPermissions = getRolePermissions('guest');

const AdminContext = createContext<AdminContextType>({
  currentUser: null,
  role: 'guest',
  roleInfo: ROLE_CONFIG.guest,
  permissions: defaultPermissions,
  isSuperAdmin: false,
  isAdmin: false,
  isEditor: false,
  isGuest: true,
  isLoaded: false,
  setIsAdmin: () => {},
  isLoginDialogOpen: false,
  setIsLoginDialogOpen: () => {},
  login: () => {},
  logout: () => {},
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedUserStr =
        localStorage.getItem('ype_current_user') || sessionStorage.getItem('ype_current_user');
      if (savedUserStr) {
        const parsed: CurrentUser = JSON.parse(savedUserStr);
        if (
          parsed.username?.toLowerCase() === 'admin' ||
          parsed.email?.toLowerCase() === 'admin@emmt.com.tw' ||
          parsed.uid === '9d8f085a-5eb4-4346-93ec-435c33cd59d8'
        ) {
          parsed.role = 'admin';
          parsed.username = 'admin@emmt.com.tw';
        }
        setCurrentUser(parsed);

        // 背景同步最新資料庫權限
        if (parsed.email) {
          syncCurrentUser(parsed.email)
            .then((updated) => {
              if (updated && updated.role) {
                setCurrentUser((prev) => {
                  if (!prev) return null;
                  const fresh = { ...prev, ...updated };
                  try {
                    localStorage.setItem('ype_current_user', JSON.stringify(fresh));
                    sessionStorage.setItem('ype_current_user', JSON.stringify(fresh));
                  } catch {}
                  return fresh;
                });
              }
            })
            .catch(() => {});
        }
      } else {
        const legacyAdmin =
          localStorage.getItem('ype_admin_logged_in') ||
          sessionStorage.getItem('ype_admin_logged_in');
        if (legacyAdmin === 'true') {
          setCurrentUser(defaultAdminUser);
        }
      }
    } catch {}
    setIsLoaded(true);
  }, []);

  const login = (user: CurrentUser) => {
    setCurrentUser(user);
    try {
      const serialized = JSON.stringify(user);
      localStorage.setItem('ype_current_user', serialized);
      sessionStorage.setItem('ype_current_user', serialized);
      if (user.role === 'admin' || user.role === 'super_admin') {
        localStorage.setItem('ype_admin_logged_in', 'true');
        sessionStorage.setItem('ype_admin_logged_in', 'true');
      } else {
        localStorage.removeItem('ype_admin_logged_in');
        sessionStorage.removeItem('ype_admin_logged_in');
      }
    } catch {}
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('ype_current_user');
      sessionStorage.removeItem('ype_current_user');
      localStorage.removeItem('ype_admin_logged_in');
      sessionStorage.removeItem('ype_admin_logged_in');
    } catch {}
  };

  const handleSetIsAdmin = (val: boolean) => {
    if (val) {
      login(defaultAdminUser);
    } else {
      logout();
    }
  };

  // 取得當前標準化角色與權限
  const role: NormalizedRole = normalizeUserRole(currentUser);
  const roleInfo: RoleInfo = ROLE_CONFIG[role];
  const permissions: RolePermissions = getRolePermissions(role);

  // 向下相容輔助屬性
  const isSuperAdmin = role === 'admin';
  const isAdmin = role === 'admin' || role === 'management';
  const isEditor = role === 'admin' || role === 'management' || role === 'execution' || role === 'monitor';
  const isGuest = role === 'guest';

  return (
    <AdminContext.Provider
      value={{
        currentUser,
        role,
        roleInfo,
        permissions,
        isSuperAdmin,
        isAdmin,
        isEditor,
        isGuest,
        isLoaded,
        setIsAdmin: handleSetIsAdmin,
        isLoginDialogOpen,
        setIsLoginDialogOpen,
        login,
        logout,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);
