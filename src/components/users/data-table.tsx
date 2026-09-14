'use client';

import { useState, useMemo } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Client } from '@/types';
import { Building2, Layers, Search, RotateCcw } from 'lucide-react';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey: string;
  clients?: Client[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  clients = [],
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  // 動態彙總所有存在的公司別 (所屬客戶)
  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      if (c.name && c.name.trim()) set.add(c.name.trim());
    });
    data.forEach((item: any) => {
      if (item.clientName && item.clientName.trim()) {
        set.add(item.clientName.trim());
      }
    });
    return Array.from(set).sort();
  }, [data, clients]);

  // 動態彙總所有存在的部門
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach((item: any) => {
      if (item.department && item.department.trim()) {
        set.add(item.department.trim());
      }
    });
    return Array.from(set).sort();
  }, [data]);

  const clientFilterValue = (table.getColumn('clientName')?.getFilterValue() as string) ?? 'all';
  const departmentFilterValue = (table.getColumn('department')?.getFilterValue() as string) ?? 'all';
  const isFiltered = columnFilters.some(
    (f) => f.value !== undefined && f.value !== '' && f.value !== 'all'
  );

  const handleResetFilters = () => {
    setColumnFilters([]);
  };

  return (
    <div>
      {/* 篩選工具列 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* 搜尋姓名 */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋姓名..."
              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
              onChange={(event) =>
                table.getColumn(searchKey)?.setFilterValue(event.target.value)
              }
              className="pl-8 h-9 text-xs"
            />
          </div>

          {/* 公司別 (所屬客戶) 下拉篩選 */}
          <div className="w-full sm:w-44">
            <Select
              value={clientFilterValue}
              onValueChange={(val) =>
                table.getColumn('clientName')?.setFilterValue(val === 'all' ? undefined : val)
              }
            >
              <SelectTrigger className="h-9 text-xs bg-white">
                <div className="flex items-center gap-1.5 truncate">
                  <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <SelectValue placeholder="所有公司別" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">🏢 全部公司別</SelectItem>
                {companyOptions.map((comp) => (
                  <SelectItem key={comp} value={comp} className="text-xs">
                    {comp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 部門 下拉篩選 */}
          <div className="w-full sm:w-40">
            <Select
              value={departmentFilterValue}
              onValueChange={(val) =>
                table.getColumn('department')?.setFilterValue(val === 'all' ? undefined : val)
              }
            >
              <SelectTrigger className="h-9 text-xs bg-white">
                <div className="flex items-center gap-1.5 truncate">
                  <Layers className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <SelectValue placeholder="所有部門" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">📂 全部部門</SelectItem>
                {departmentOptions.map((dept) => (
                  <SelectItem key={dept} value={dept} className="text-xs">
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 重置篩選按鈕 */}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重置
            </Button>
          )}
        </div>

        {/* 筆數統計 */}
        <div className="text-xs text-muted-foreground shrink-0 self-end sm:self-center">
          顯示 {table.getFilteredRowModel().rows.length} / 共 {data.length} 位成員
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  無結果。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          上一頁
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          下一頁
        </Button>
      </div>
    </div>
  );
}
