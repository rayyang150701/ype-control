'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Search, Edit2, Trash2, ShieldCheck, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { deleteClient } from '@/lib/actions';
import { ClientDialog } from './client-dialog';
import type { Client } from '@/types';

interface ClientsClientProps {
  initialClients: Client[];
}

const SQL_SCHEMA_SCRIPT = `-- 在 Supabase SQL Editor 執行此段以建立客戶資料表
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT DEFAULT '',
  contact_person TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Allow service role all clients" ON public.clients FOR ALL USING (auth.role() = 'service_role');

INSERT INTO public.clients (name, code, contact_person, notes)
VALUES ('燁輝', 'YP', '黃裕峰', '系統核心預設客戶')
ON CONFLICT (name) DO NOTHING;`;

export function ClientsClient({ initialClients }: ClientsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // 刪除確認
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const filteredClients = clients.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    );
  });

  const handleOpenAdd = () => {
    setSelectedClient(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setSelectedClient(client);
    setIsDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!clientToDelete) return;
    if (clientToDelete.name === '燁輝') {
      toast({ title: '無法刪除', description: '「燁輝」為核心預設客戶，不可刪除！', variant: 'destructive' });
      setClientToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteClient(clientToDelete.id, clientToDelete.name);
      if (res.success) {
        toast({ title: '已刪除', description: res.message });
        setClients((prev) => prev.filter((c) => c.id !== clientToDelete.id));
        router.refresh();
      } else {
        toast({ title: '刪除失敗', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '刪除異常', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setClientToDelete(null);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_SCRIPT);
    setCopiedSql(true);
    toast({ title: '已複製 SQL 指令', description: '可前往 Supabase SQL Editor 執行建立資料表' });
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-5">
      {/* 標頭與操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-lg border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              客戶維護管理
              <Badge variant="secondary" className="text-xs">
                {clients.length} 間客戶
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              維護各案對應之客戶名稱與窗口，供新增/編輯專案時快速下拉選取與歸類。
            </p>
          </div>
        </div>

        <Button onClick={handleOpenAdd} className="gap-1.5 text-xs h-9">
          <Plus className="h-4 w-4" />
          新增客戶名稱
        </Button>
      </div>

      {/* 搜尋列 */}
      <div className="flex items-center gap-3 bg-card p-3 rounded-lg border shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋客戶名稱、代碼、聯絡人窗口..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>
        {searchQuery && (
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="text-xs h-9">
            清除搜尋
          </Button>
        )}
      </div>

      {/* 客戶列表 Table */}
      <div className="rounded-lg border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[200px] text-xs font-semibold">客戶名稱</TableHead>
              <TableHead className="w-[100px] text-xs font-semibold">代碼</TableHead>
              <TableHead className="w-[150px] text-xs font-semibold">主要窗口</TableHead>
              <TableHead className="w-[200px] text-xs font-semibold">聯絡方式</TableHead>
              <TableHead className="text-xs font-semibold">備註說明</TableHead>
              <TableHead className="w-[120px] text-xs font-semibold text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground">
                  查無符合條件的客戶名稱
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => {
                const isDefault = client.name === '燁輝';
                return (
                  <TableRow key={client.id} className="hover:bg-slate-50/70">
                    <TableCell className="font-medium text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">{client.name}</span>
                        {isDefault && (
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] px-1.5 py-0 border-0 flex items-center gap-0.5">
                            <ShieldCheck className="h-3 w-3" />
                            系統核心
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-600">
                      {client.code || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {client.contactPerson || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{client.contactPhone || '-'}</div>
                      {client.contactEmail && (
                        <div className="text-[11px] text-slate-500">{client.contactEmail}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-xs truncate">
                      {client.notes || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-600 hover:text-primary"
                          onClick={() => handleOpenEdit(client)}
                          title="編輯客戶"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-destructive disabled:opacity-30"
                          onClick={() => setClientToDelete(client)}
                          disabled={isDefault}
                          title={isDefault ? '系統預設核心客戶不可刪除' : '刪除客戶'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 資料庫結構備查區塊 */}
      <Card className="bg-slate-50/60 border border-slate-200">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <span>🛠️ Supabase 資料表備查 (Clients Table DDL)</span>
            </CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">
              系統已內建容錯機制。若需在 Supabase 資料庫建立獨立表格，可複製下方指令直接執行：
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopySql} className="h-7 text-xs gap-1">
            {copiedSql ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedSql ? '已複製' : '複製 SQL 指令'}
          </Button>
        </CardHeader>
        <CardContent className="py-0 px-4 pb-3">
          <pre className="p-2.5 rounded bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-36">
            {SQL_SCHEMA_SCRIPT}
          </pre>
        </CardContent>
      </Card>

      {/* 新增/編輯彈窗 */}
      <ClientDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        client={selectedClient}
        onSuccess={() => {
          router.refresh();
        }}
      />

      {/* 刪除確認對話框 */}
      <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-1.5">
              <Trash2 className="h-5 w-5" />
              確認刪除客戶？
            </AlertDialogTitle>
            <AlertDialogDescription>
              您確定要刪除客戶「<strong className="text-foreground">{clientToDelete?.name}</strong>」嗎？
              刪除後將無法復原，但不會影響目前已建立該客戶的歷史專案資料。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? '刪除中...' : '確認刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
