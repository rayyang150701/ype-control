'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createClient, updateClient } from '@/lib/actions';
import { Building2 } from 'lucide-react';
import type { Client } from '@/types';

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSuccess: () => void;
}

export function ClientDialog({
  open,
  onOpenChange,
  client,
  onSuccess,
}: ClientDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (client) {
      setName(client.name || '');
      setCode(client.code || '');
      setContactPerson(client.contactPerson || '');
      setContactPhone(client.contactPhone || '');
      setContactEmail(client.contactEmail || '');
      setNotes(client.notes || '');
    } else {
      setName('');
      setCode('');
      setContactPerson('');
      setContactPhone('');
      setContactEmail('');
      setNotes('');
    }
  }, [client, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: '請輸入客戶名稱', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (client?.id && !client.id.startsWith('default-')) {
        const res = await updateClient(client.id, {
          name: name.trim(),
          code: code.trim(),
          contactPerson: contactPerson.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
          notes: notes.trim(),
        });
        if (res.success) {
          toast({ title: '更新成功', description: res.message });
          onOpenChange(false);
          onSuccess();
        } else {
          toast({ title: '更新失敗', description: res.message, variant: 'destructive' });
        }
      } else {
        const res = await createClient({
          name: name.trim(),
          code: code.trim(),
          contactPerson: contactPerson.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
          notes: notes.trim(),
        });
        if (res.success) {
          toast({ title: '建立成功', description: res.message });
          onOpenChange(false);
          onSuccess();
        } else {
          toast({ title: '建立失敗', description: res.message, variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: '操作異常', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = !!(client && !client.id.startsWith('default-'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Building2 className="h-5 w-5 text-primary" />
            {isEdit ? '編輯客戶資料' : '新增客戶名稱'}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            維護客戶基本資訊，供新增專案與管制表進行歸類與下拉挑選。
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-semibold">客戶名稱 *</Label>
              <Input
                className="mt-1 text-xs"
                placeholder="例如：燁輝企業、億威電子..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">客戶代碼</Label>
              <Input
                className="mt-1 text-xs font-mono uppercase"
                placeholder="例如：YP"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">主要聯絡窗口</Label>
              <Input
                className="mt-1 text-xs"
                placeholder="例如：黃裕峰"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">聯絡電話 / 分機</Label>
              <Input
                className="mt-1 text-xs"
                placeholder="例如：07-1234567 #888"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">聯絡 Email</Label>
            <Input
              type="email"
              className="mt-1 text-xs"
              placeholder="例如：contact@yieh.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">備註說明</Label>
            <Textarea
              className="mt-1 min-h-[60px] text-xs"
              placeholder="例如：智慧製造主要專案配合客戶..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? '儲存中...' : isEdit ? '儲存變更' : '確認新增'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
