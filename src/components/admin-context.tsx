'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CurrentUser, UserRole } from '@/types';

interface AdminContextType {
  currentUser: CurrentUser | null;
  role: UserRole | 'guest';
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
  uid: 'admin-master',
  username: 'admin',
  displayName: '系統主管理員',
  email: 'admin@emmt.com.tw',
  role: 'super_admin',
  company: '億威電子',
  department: '管理部',
};

const AdminContext = createContext<AdminContextType>({
  currentUser: null,
  role: 'guest',
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
    // 檢查 localStorage / sessionStorage 登入態
    try {
      const savedUserStr = localStorage.getItem('ype_current_user') || sessionStorage.getItem('ype_current_user');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        setCurrentUser(parsed);
      } else {
        // 舊版相容
        const legacyAdmin = localStorage.getItem('ype_admin_logged_in') || sessionStorage.getItem('ype_admin_logged_in');
        if (legacyAdmin === 'true') {
          setCurrentUser(defaultAdminUser);
        }
      }
    } catch {
      // 容錯
    }
    setIsLoaded(true);
  }, []);

  const login = (user: CurrentUser) => {
    setCurrentUser(user);
    try {
      const serialized = JSON.stringify(user);
      localStorage.setItem('ype_current_user', serialized);
      sessionStorage.setItem('ype_current_user', serialized);
      if (user.role === 'super_admin' || user.role === 'admin') {
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

  const role: UserRole | 'guest' = currentUser?.role || 'guest';
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'super_admin' || role === 'admin';
  const isEditor = role === 'super_admin' || role === 'admin' || role === 'editor';
  const isGuest = !currentUser || role === 'viewer';

  return (
    <AdminContext.Provider
      value={{
        currentUser,
        role,
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
