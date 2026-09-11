'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
}

interface SearchableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | ComboboxOption)[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder = '可直接輸入或下拉選擇...',
  className,
  disabled = false,
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 標準化 options 為 ComboboxOption 格式
  const normalizedOptions: ComboboxOption[] = React.useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // 點擊元件外部時自動收合下拉選單
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 依當前輸入內容過濾選項
  const filteredOptions = React.useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.hint && opt.hint.toLowerCase().includes(q))
    );
  }, [normalizedOptions, value]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="relative flex items-center">
        <Input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-16 text-xs h-9"
        />
        <div className="absolute right-1 flex items-center gap-0.5">
          {value && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
              title="清除"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => !disabled && setIsOpen((prev) => !prev)}
            disabled={disabled}
            title="開啟選項清單"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
          </Button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
          {filteredOptions.length === 0 ? (
            <div className="py-2.5 px-3 text-xs text-muted-foreground text-center">
              {value ? `無精確相符選項，保留自訂姓名「${value}」` : '暫無預設選項'}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredOptions.map((opt) => {
                const isSelected = value.trim() === opt.value.trim();
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs text-left transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate">{opt.label}</span>
                      {opt.hint && (
                        <span className="text-[10px] text-muted-foreground">({opt.hint})</span>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
