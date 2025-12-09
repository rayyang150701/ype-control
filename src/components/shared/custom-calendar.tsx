'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

type CustomCalendarProps = {
    selected?: Date;
    onSelect: (date: Date) => void;
};

export function CustomCalendar({ selected, onSelect }: CustomCalendarProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(selected?.getFullYear() || today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(selected?.getMonth() || today.getMonth());

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  
  const generateCalendar = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
    
    const weeks = [];
    let days = [];
    
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
      if (days.length === 7) {
        weeks.push(days);
        days = [];
      }
    }
    
    if (days.length > 0) {
      while (days.length < 7) {
        days.push(null);
      }
      weeks.push(days);
    }
    
    return weeks;
  };

  const weeks = generateCalendar();

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  return (
    <div className="p-3 bg-white">
      {/* 月份導航 */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="p-1 hover:bg-gray-100 rounded"
        >
          ←
        </button>
        <div className="text-sm font-semibold">
          {currentYear} 年 {monthNames[currentMonth]}
        </div>
        <button
          type="button"
          onClick={goToNextMonth}
          className="p-1 hover:bg-gray-100 rounded"
        >
          →
        </button>
      </div>

      {/* 星期標題 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['日', '一', '二', '三', '四', '五', '六'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      {/* 日期網格 */}
      <div className="space-y-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((day, dayIndex) => {
              const isSelected = selected && 
                day !== null &&
                selected.getDate() === day && 
                selected.getMonth() === currentMonth && 
                selected.getFullYear() === currentYear;
              
              const isToday = day !== null &&
                day === today.getDate() && 
                currentMonth === today.getMonth() && 
                currentYear === today.getFullYear();

              return (
                <button
                  key={dayIndex}
                  type="button"
                  onClick={() => {
                    if (day) {
                      onSelect(new Date(currentYear, currentMonth, day));
                    }
                  }}
                  disabled={!day}
                  className={cn(
                    "p-2 text-sm rounded-md transition-colors",
                    !day && "invisible",
                    day && !isSelected && "hover:bg-accent",
                    isSelected && "bg-primary text-primary-foreground font-semibold",
                    isToday && !isSelected && "border border-primary"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}