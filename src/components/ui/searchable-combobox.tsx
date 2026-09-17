'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, X, Check, UserPlus } from 'lucide-react';
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
  emptyHint?: string;
}

export function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder = '可直接輸入或下拉選擇...',
  className,
  disabled = false,
  emptyHint,
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isBrowsingAll, setIsBrowsingAll] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // 標準化 options 為 ComboboxOption 格式，並過濾重覆值
  const normalizedOptions: ComboboxOption[] = React.useMemo(() => {
    const map = new Map<string, ComboboxOption>();
    options.forEach((opt) => {
      if (typeof opt === 'string') {
        const trimmed = opt.trim();
        if (trimmed && !map.has(trimmed)) {
          map.set(trimmed, { value: trimmed, label: trimmed });
        }
      } else if (opt && opt.value) {
        const trimmed = opt.value.trim();
        if (trimmed && !map.has(trimmed)) {
          map.set(trimmed, {
            value: trimmed,
            label: opt.label || trimmed,
            hint: opt.hint,
          });
        }
      }
    });
    return Array.from(map.values());
  }, [options]);

  // 點擊元件外部時自動收合下拉選單
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsBrowsingAll(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 依當前輸入內容過濾選項 (手動輸入即時帶出)
  const displayOptions = React.useMemo(() => {
    if (isBrowsingAll) return normalizedOptions;
    const q = (value || '').trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.hint && opt.hint.toLowerCase().includes(q))
    );
  }, [normalizedOptions, value, isBrowsingAll]);

  // 當候選項目改變時重設高亮索引
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [displayOptions.length]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
    setIsBrowsingAll(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsBrowsingAll(true);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setIsBrowsingAll(true);
        setHighlightedIndex(0);
      } else if (displayOptions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % displayOptions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setIsBrowsingAll(true);
        setHighlightedIndex(displayOptions.length - 1);
      } else if (displayOptions.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + displayOptions.length) % displayOptions.length);
      }
    } else if (e.key === 'Enter') {
      // 避免在 dialog 或 form 中直接送出表單
      e.preventDefault();
      if (isOpen) {
        if (highlightedIndex >= 0 && highlightedIndex < displayOptions.length) {
          handleSelect(displayOptions[highlightedIndex].value);
        } else {
          // 若無高亮項目，直接保留使用者目前手動輸入的值並收合選單
          setIsOpen(false);
          setIsBrowsingAll(false);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setIsBrowsingAll(false);
      setHighlightedIndex(-1);
    }
  };

  const isCustomValue = Boolean(
    value &&
    value.trim() &&
    !normalizedOptions.some((opt) => opt.value.trim().toLowerCase() === value.trim().toLowerCase())
  );

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="relative flex items-center">
        <Input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsBrowsingAll(false);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsBrowsingAll(true);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
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
            onClick={() => {
              if (disabled) return;
              setIsBrowsingAll(true);
              setIsOpen((prev) => !prev);
            }}
            disabled={disabled}
            title={isOpen ? '關閉選項清單' : '開啟選項清單'}
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
          </Button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
          {/* 自訂手動輸入提示按鈕 */}
          {isCustomValue && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsBrowsingAll(false);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left bg-amber-50 hover:bg-amber-100 text-amber-950 font-medium transition-colors border border-amber-200/80 mb-1"
            >
              <div className="flex items-center gap-1.5 truncate">
                <UserPlus className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="truncate">使用手動輸入：「{value}」</span>
              </div>
              <span className="text-[10px] text-amber-700 shrink-0 ml-1">(點此或 Enter 保留)</span>
            </button>
          )}

          {displayOptions.length === 0 ? (
            <div className="py-2.5 px-3 text-xs text-muted-foreground text-center">
              {emptyHint || (value ? `無精確相符選項，保留自訂姓名「${value}」` : '暫無預設選項，可直接手動輸入')}
            </div>
          ) : (
            <div className="space-y-0.5">
              {displayOptions.map((opt, idx) => {
                const isSelected = value.trim() === opt.value.trim();
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs text-left transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary font-medium'
                        : isHighlighted
                        ? 'bg-accent text-accent-foreground font-medium'
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
