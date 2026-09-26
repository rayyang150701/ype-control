import { CurrentUser, User } from '@/types';

/**
 * 檢查使用者是否為具備完整課程維護權限之主管理員
 * 條件：
 * 1. 角色為 super_admin 或 admin
 * 2. 帳號、Email 或姓名包含 jamesyang 或 admin
 */
export function isCourseManager(user: CurrentUser | User | null | undefined): boolean {
  if (!user) return false;
  const role = user.role;
  if (role === 'super_admin' || role === 'admin') return true;

  const email = (user.email || '').toLowerCase().trim();
  const username = ((user as any).username || '').toLowerCase().trim();
  const displayName = (user.displayName || '').toLowerCase().trim();

  return (
    email.includes('jamesyang') ||
    username.includes('jamesyang') ||
    displayName.includes('james') ||
    email.includes('admin') ||
    username.includes('admin') ||
    displayName.includes('admin')
  );
}

/**
 * 檢查使用者是否可編輯特定課程（主管理員或該課程建立者）
 */
export function canUserEditCourse(
  currentUser: CurrentUser | User | null | undefined,
  courseCreatedBy?: string
): boolean {
  if (!currentUser) return false;
  if (isCourseManager(currentUser)) return true;
  if (courseCreatedBy && currentUser.uid === courseCreatedBy) return true;
  return false;
}
