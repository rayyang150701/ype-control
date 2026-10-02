'use client';
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Phone } from 'lucide-react';
import phoneDataRaw from '@/data/phone-directory.json';

// Type for the parsed phone directory entry
interface PhoneEntry {
  title: string;
  name: string;
  englishName: string;
  extension: string;
  location: string;
}

const phoneData = phoneDataRaw as PhoneEntry[];

interface PhoneDirectoryDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function PhoneDirectoryDialog({ isOpen, setIsOpen }: PhoneDirectoryDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return phoneData;
    const lowerSearch = searchTerm.toLowerCase();
    return phoneData.filter((entry) => 
      (entry.name && entry.name.toLowerCase().includes(lowerSearch)) ||
      (entry.englishName && entry.englishName.toLowerCase().includes(lowerSearch)) ||
      (entry.title && entry.title.toLowerCase().includes(lowerSearch)) ||
      (entry.extension && entry.extension.includes(lowerSearch))
    );
  }, [searchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-primary">
            <Phone className="h-5 w-5" />
            億威電子 分機一覽表
          </DialogTitle>
          <DialogDescription>
            輸入姓名、英文名、職稱或分機來快速尋找聯絡資訊。
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-2 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="搜尋分機或人名..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-[300px] border rounded-md">
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-semibold shadow-sm z-10 text-xs">
              <tr>
                <th className="px-4 py-3 w-20">廠區</th>
                <th className="px-4 py-3">職稱</th>
                <th className="px-4 py-3">姓名</th>
                <th className="px-4 py-3">英文名</th>
                <th className="px-4 py-3 text-right">分機</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredData.length > 0 ? (
                filteredData.map((entry, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {entry.location}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {entry.title || '-'}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {entry.name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {entry.englishName || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-blue-600">
                      {entry.extension}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    找不到符合條件的分機資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
