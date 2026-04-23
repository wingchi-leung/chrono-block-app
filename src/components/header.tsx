import { useCallback } from 'react';
import { addDays, addMinutes, endOfWeek, format, setMinutes, setSeconds, startOfWeek, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  LayoutGrid,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';
import type { ViewType } from '@/types';
import { COLORS } from '@/lib/utils';

const viewIcons = {
  day: List,
  week: Calendar,
  month: LayoutGrid,
};

const viewLabels = {
  day: '日',
  week: '周',
  month: '月',
};

export function Header() {
  const { currentView, setCurrentView, selectedDate, setSelectedDate, addTimeBlock, checkTimeConflict } =
    useStore();

  const handlePrevious = useCallback(() => {
    switch (currentView) {
      case 'day':
        setSelectedDate(subDays(selectedDate, 1));
        break;
      case 'week':
        setSelectedDate(subDays(selectedDate, 7));
        break;
      case 'month':
        const prevMonth = new Date(selectedDate);
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        setSelectedDate(prevMonth);
        break;
    }
  }, [currentView, selectedDate, setSelectedDate]);

  const handleNext = useCallback(() => {
    switch (currentView) {
      case 'day':
        setSelectedDate(addDays(selectedDate, 1));
        break;
      case 'week':
        setSelectedDate(addDays(selectedDate, 7));
        break;
      case 'month':
        const nextMonth = new Date(selectedDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        setSelectedDate(nextMonth);
        break;
    }
  }, [currentView, selectedDate, setSelectedDate]);

  const handleToday = useCallback(() => {
    setSelectedDate(new Date());
  }, [setSelectedDate]);

  const handleCreateTimeBlock = useCallback(async () => {
    const baseDate = new Date(selectedDate);
    const now = new Date();
    baseDate.setHours(now.getHours(), now.getMinutes(), 0, 0);

    const roundedStart = setSeconds(
      setMinutes(baseDate, Math.ceil(baseDate.getMinutes() / 15) * 15),
      0
    );
    const end = addMinutes(roundedStart, 30);

    if (checkTimeConflict(roundedStart, end)) {
      setCurrentView('day');
      return;
    }

    await addTimeBlock({
      title: '未命名时间块',
      start_time: roundedStart.toISOString(),
      end_time: end.toISOString(),
      color: COLORS[0],
    });
    setCurrentView('day');
  }, [addTimeBlock, checkTimeConflict, selectedDate, setCurrentView]);

  const getDateDisplay = () => {
    switch (currentView) {
      case 'day':
        return format(selectedDate, 'yyyy年M月d日 EEEE', { locale: zhCN });
      case 'week':
        const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return `${format(start, 'M月d日', { locale: zhCN })} - ${format(
          end,
          'M月d日',
          { locale: zhCN }
        )}`;
      case 'month':
        return format(selectedDate, 'yyyy年M月', { locale: zhCN });
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl ring-1 ring-border/80">
            <img
              src="/favicon.svg"
              alt="ChronoBlock logo"
              className="h-full w-full object-contain p-1"
            />
          </div>
          <span className="text-lg font-semibold">ChronoBlock</span>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleToday}>
            今天
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium">{getDateDisplay()}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden md:block">
          <div className="group relative">
            <button
              type="button"
              className="overflow-hidden rounded-full shadow-[0_10px_24px_rgba(251,191,36,0.22)] transition-transform duration-200 hover:-translate-y-[1px]"
              aria-label="Buy me coffee"
            >
              <img
                src="/buymecoffee.png"
                alt="Buy me a coffee"
                className="h-10 w-auto object-contain"
              />
            </button>

            <div className="pointer-events-none absolute right-0 top-[calc(100%+12px)] z-30 w-56 rounded-3xl border border-slate-200/80 bg-white/98 p-3 opacity-0 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-md transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-inner">
                <img
                  src="/buymecoffee_wechat.jpg"
                  alt="微信赞赏码"
                  className="h-auto w-full rounded-xl object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center rounded-lg border p-1">
          {(Object.keys(viewIcons) as ViewType[]).map((view) => {
            const Icon = viewIcons[view];
            return (
              <Button
                key={view}
                variant={currentView === view ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView(view)}
                className="h-7 px-2"
              >
                <Icon className="mr-1 h-4 w-4" />
                {viewLabels[view]}
              </Button>
            );
          })}
        </div>

        {/* Add Button */}
        <Button size="sm" onClick={handleCreateTimeBlock}>
          <Plus className="mr-1 h-4 w-4" />
          新建
        </Button>
      </div>
    </header>
  );
}
