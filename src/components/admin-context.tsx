'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminContextType {
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
  isLoginDialogOpen: boolean;
  setIsLoginDialogOpen: (val: boolean) => void;
  logout: () => void;
}

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  setIsAdmin: () => {},
  isLoginDialogOpen: false,
  setIsLoginDialogOpen: () => {},
  logout: () => {},
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);

  useEffect(() => {
    // 檢查 sessionStorage 是否已登入
    const saved = sessionStorage.getItem('ype_admin_logged_in');
    if (saved === 'true') {
      setIsAdmin(true);
    }
  }, []);

  const handleSetIsAdmin = (val: boolean) => {
    setIsAdmin(val);
    if (val) {
      sessionStorage.setItem('ype_admin_logged_in', 'true');
    } else {
      sessionStorage.removeItem('ype_admin_logged_in');
    }
  };

  const logout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem('ype_admin_logged_in');
  };

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        setIsAdmin: handleSetIsAdmin,
        isLoginDialogOpen,
        setIsLoginDialogOpen,
        logout,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);
