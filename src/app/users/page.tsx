'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import type { User } from '@/types';

export default function UsersPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ displayName: '', email: '', role: 'viewer' as string, status: 'active' as string });

  useEffect(() => {
    if (!authLoading && (!authUser || authUser.role !== 'admin')) {
      router.replace('/dashboard');
    }
  }, [authUser, authLoading, router]);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ displayName: '', email: '', role: 'viewer', status: 'active' });
    setDialogOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setForm({ displayName: u.displayName, email: u.email, role: u.role, status: u.status });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const { updateUser } = await import('@/lib/actions');
        await updateUser(editingUser.uid, form as any);
      } else {
        const { createUser } = await import('@/lib/actions');
        await createUser(form as any);
      }
      await loadUsers();
      setDialogOpen(false);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (uid: string) => {
    if (!confirm('確定要刪除此成員嗎？')) return;
    try {
      const { deleteUser } = await import('@/lib/actions');
      await deleteUser(uid);
      await loadUsers();
    } catch (e) { console.error(e); }
  };

  if (authLoading || loading) return <div className="flex h-[60vh] items-center justify-center text-muted-foreground animate-pulse">載入中...</div>;
  if (authUser?.role !== 'admin') return null;

  const roleLabels: Record<string,string> = { admin: '管理員', editor: '編輯者', viewer: '檢視者' };
  const roleBadge: Record<string,string> = { admin: 'bg-purple-100 text-purple-800', editor: 'bg-blue-100 text-blue-800', viewer: 'bg-gray-100 text-gray-800' };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center h-16 gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}><ArrowLeft className="h-4 w-4 mr-1" />回到儀表板</Button>
          <h1 className="text-lg font-bold text-primary">👥 成員管理</h1>
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <p className="text-muted-foreground">管理系統使用者的帳號與權限。</p>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />新增成員</Button>
        </div>
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">姓名</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">角色</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">狀態</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-24">操作</th>
            </tr></thead>
            <tbody>{users.map(u => (
              <tr key={u.uid} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.displayName}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge[u.role]||''}`}>{roleLabels[u.role]||u.role}</span></td>
                <td className="px-4 py-3">{u.status==='active'?<Badge variant="success">啟用</Badge>:<Badge variant="secondary">待審核</Badge>}</td>
                <td className="px-4 py-3"><div className="flex gap-2">
                  <button onClick={()=>openEdit(u)} className="text-primary hover:underline text-xs">編輯</button>
                  <button onClick={()=>handleDelete(u.uid)} className="text-destructive hover:underline text-xs">刪除</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingUser ? '編輯成員' : '新增成員'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label>姓名 *</Label><Input value={form.displayName} onChange={e=>setForm(p=>({...p,displayName:e.target.value}))} required /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} required disabled={!!editingUser} /></div>
              <div className="space-y-2"><Label>角色</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}>
                  <option value="admin">管理員 (Admin)</option>
                  <option value="editor">編輯者 (Editor)</option>
                  <option value="viewer">檢視者 (Viewer)</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={()=>setDialogOpen(false)}>取消</Button>
                <Button type="submit">{editingUser ? '更新' : '建立'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
