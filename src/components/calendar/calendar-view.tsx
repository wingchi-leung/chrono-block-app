import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useStore } from '@/store';
import type { TimeBlock } from '@/types';
import { cn, getTimeBlockPalette } from '@/lib/utils';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export function CalendarView() {
  const { selectedDate, timeBlocks, setCurrentView, setSelectedDate, loadTimeBlocks } = useStore();
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);

  const monthRange = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return { monthStart, monthEnd, calendarStart, calendarEnd };
  }, [selectedDate]);

  useEffect(() => {
    loadTimeBlocks(
      monthRange.calendarStart.toISOString(),
      addDays(monthRange.calendarEnd, 1).toISOString()
    );
  }, [loadTimeBlocks, monthRange]);

  useEffect(() => {
    const days: Date[] = [];
    let cursor = monthRange.calendarStart;
    while (cursor <= monthRange.calendarEnd) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    setCalendarDays(days);
  }, [monthRange]);

  const getBlocksForDay = (date: Date): TimeBlock[] =>
    timeBlocks.filter((block) => isSameDay(new Date(block.start_time), date));

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setCurrentView('day');
  };

  const monthBlockCount = timeBlocks.filter((block) =>
    isSameMonth(new Date(block.start_time), selectedDate)
  ).length;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">月视图</h2>
          <p className="text-xs text-muted-foreground">点击任意日期会直接切到当天时间网格</p>
        </div>
        <div className="text-sm text-muted-foreground">
          本月共 <span className="font-semibold text-foreground">{monthBlockCount}</span> 个时间块
        </div>
      </div>

      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={cn(
              'py-2 text-center text-sm font-medium text-muted-foreground',
              (index === 0 || index === 6) && 'text-red-500/70'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {calendarDays.map((day) => {
          const dayBlocks = getBlocksForDay(day);
          const isCurrentMonth = isSameMonth(day, selectedDate);
          const isCurrentDay = isToday(day);
          const isSelected = isSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => handleDayClick(day)}
              className={cn(
                'border-b border-r p-2 text-left transition-colors hover:bg-accent/50',
                !isCurrentMonth && 'bg-muted/30',
                isSelected && 'bg-primary/5 ring-1 ring-inset ring-primary/30'
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-sm',
                  isCurrentDay && 'bg-primary text-primary-foreground font-bold',
                  isSelected && !isCurrentDay && 'bg-secondary text-secondary-foreground font-semibold',
                  !isCurrentMonth && 'text-muted-foreground'
                )}
              >
                {format(day, 'd')}
              </div>

              <div className="mt-2 space-y-1 overflow-hidden">
                {dayBlocks.slice(0, 3).map((block) => {
                  const palette = getTimeBlockPalette(block);

                  return (
                    <div
                      key={block.id}
                      className="truncate rounded-md border px-2 py-1 text-xs font-medium shadow-sm"
                      style={{
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                        color: palette.text,
                      }}
                    >
                      {block.title}
                    </div>
                  );
                })}
                {dayBlocks.length > 3 && (
                  <div className="px-1 text-xs text-muted-foreground">+{dayBlocks.length - 3} 更多</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
