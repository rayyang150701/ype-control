import type { User } from '@/types';

/**
 * 子專案「負責人」只能由億威電子的 PM 擔任。
 * 來源：users 表中 clientName = 億威電子、department = PM、status = active。
 * 客戶窗口（燁輝等）與待維護的自動建檔帳號不可作為負責人。
 */
export const PM_CLIENT_NAME = '億威電子';
export const PM_DEPARTMENT = 'PM';

export function getPmOwnerOptions(users: User[]): User[] {
  return users.filter(
    (u) =>
      u.clientName === PM_CLIENT_NAME &&
      u.department === PM_DEPARTMENT &&
      u.status === 'active'
  );
}
