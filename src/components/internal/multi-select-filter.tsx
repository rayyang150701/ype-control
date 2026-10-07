"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  subText?: string;
}

export interface MultiSelectFilterProps {
  title: string;
  placeholder?: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onSelectionChange: (newValues: string[]) => void;
  className?: string;
  triggerClassName?: string;
  activeColorClass?: string;
  width?: string;
}

export function MultiSelectFilterPopover({
  title,
  placeholder,
  options,
  selectedValues,
  onSelectionChange,
  className,
  triggerClassName,
  activeColorClass = "border-blue-500 bg-blue-50/70 text-blue-900 font-bold",
  width = "w-[175px] sm:w-[195px]",
}: MultiSelectFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const isFiltered = selectedValues.length > 0;

  // 篩選搜尋關鍵字
  const filteredOptions = React.useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.trim().toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.subText && opt.subText.toLowerCase().includes(term))
    );
  }, [options, searchTerm]);

  const handleToggle = (id: string) => {
    if (selectedValues.includes(id)) {
      onSelectionChange(selectedValues.filter((v) => v !== id));
    } else {
      onSelectionChange([...selectedValues, id]);
    }
  };

  const handleSelectAll = () => {
    // 全選當前符合搜尋的項目（或全部選項）
    const allIds = filteredOptions.map((o) => o.id);
    const newSet = new Set([...selectedValues, ...allIds]);
    onSelectionChange(Array.from(newSet));
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  // 顯示選取標籤摘要
  const displayLabel = React.useMemo(() => {
    if (selectedValues.length === 0) {
      return placeholder || `全部${title}`;
    }
    if (selectedValues.length === 1) {
      const match = options.find((o) => o.id === selectedValues[0]);
      return match ? match.label : selectedValues[0];
    }
    const firstMatch = options.find((o) => o.id === selectedValues[0]);
    const firstName = firstMatch ? firstMatch.label : selectedValues[0];
    return `${firstName} +${selectedValues.length - 1}`;
  }, [selectedValues, options, placeholder, title]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            `${width} h-9 text-xs font-medium justify-between shrink-0 bg-background transition-colors`,
            isFiltered ? activeColorClass : "text-muted-foreground",
            triggerClassName
          )}
          title={`點擊篩選 ${title} (多選勾選)`}
        >
          <span className="truncate text-left flex-1 mr-1">
            {displayLabel}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selectedValues.length > 1 && (
              <Badge
                variant="secondary"
                className="h-4 px-1 text-[10px] font-mono leading-none bg-blue-100 text-blue-800 border border-blue-200"
              >
                {selectedValues.length}
              </Badge>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 sm:w-80 p-3" align="start">
        {/* 頂部標題與快捷動作 */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-800">
              選擇 {title}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              ({selectedValues.length}/{options.length})
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-blue-600 hover:text-blue-800 hover:underline px-1 py-0.5 rounded cursor-pointer"
            >
              全選
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-muted-foreground hover:text-red-600 hover:underline px-1 py-0.5 rounded cursor-pointer"
            >
              清除
            </button>
          </div>
        </div>

        {/* 關鍵字搜尋過濾 (若選項大於 5 個時顯示) */}
        {options.length >= 6 && (
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={`搜尋 ${title}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-7 h-7 text-xs bg-slate-50"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* 選項列表 */}
        <div className="max-h-60 overflow-y-auto space-y-0.5 pr-1">
          {filteredOptions.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              無符合項目
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = selectedValues.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => handleToggle(opt.id)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors",
                    isSelected
                      ? "bg-blue-50/80 text-blue-900 font-medium"
                      : "hover:bg-slate-100 text-slate-700"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggle(opt.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className="truncate">{opt.label}</span>
                    {opt.subText && (
                      <span className="text-[10px] text-muted-foreground truncate shrink-0">
                        {opt.subText}
                      </span>
                    )}
                  </div>
                  {opt.count !== undefined && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded font-mono shrink-0",
                        isSelected
                          ? "bg-blue-200/80 text-blue-900 font-semibold"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {opt.count}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 底部確認關閉按鈕 */}
        <div className="flex items-center justify-between pt-2 mt-2 border-t text-[11px] text-muted-foreground">
          <span>
            已選取{" "}
            <strong className="text-slate-800 font-mono">
              {selectedValues.length}
            </strong>{" "}
            項
          </span>
          <Button
            size="sm"
            onClick={() => setOpen(false)}
            className="h-6 text-xs px-3 bg-slate-900 hover:bg-slate-800 text-white"
          >
            完成
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
