import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TimeBlock } from '@/types';

type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';

type PomodoroPanelProps = {
  selectedBlock: TimeBlock | null;
  className?: string;
  style?: CSSProperties;
};

const MODES: Array<{
  id: PomodoroMode;
  label: string;
  minutes: number;
  accent: string;
}> = [
  { id: 'focus', label: '专注', minutes: 25, accent: '#4d6cf0' },
  { id: 'shortBreak', label: '短休', minutes: 5, accent: '#7f9cff' },
  { id: 'longBreak', label: '长休', minutes: 15, accent: '#3148c7' },
];

const formatClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

export function PomodoroPanel({ selectedBlock, className, style }: PomodoroPanelProps) {
  const [mode, setMode] = useState<PomodoroMode>('focus');
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedFocusCount, setCompletedFocusCount] = useState(0);
  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);
  const modeRef = useRef<PomodoroMode>('focus');
  const stopConfirmRef = useRef<HTMLDivElement>(null);

  const activeMode = useMemo(() => MODES.find((item) => item.id === mode) ?? MODES[0], [mode]);
  const totalSeconds = activeMode.minutes * 60;
  const progress = totalSeconds === 0 ? 0 : (totalSeconds - remainingSeconds) / totalSeconds;
  const hasStarted = remainingSeconds < totalSeconds || isRunning;
  const circumference = 2 * Math.PI * 178;
  const strokeDashoffset = circumference * (1 - progress);
  const timerSize = 'clamp(280px, 30vw, 380px)';

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    setRemainingSeconds(activeMode.minutes * 60);
    setIsRunning(false);
  }, [activeMode.minutes]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((previous) => {
        if (previous <= 1) {
          window.setTimeout(() => {
            setIsRunning(false);
            if (modeRef.current === 'focus') {
              setCompletedFocusCount((count) => count + 1);
            }
          }, 0);

          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (!isStopConfirmOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (stopConfirmRef.current?.contains(target)) {
        return;
      }

      setIsStopConfirmOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsStopConfirmOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStopConfirmOpen]);

  const handleToggleRunning = () => {
    if (remainingSeconds === 0) {
      setRemainingSeconds(totalSeconds);
    }

    setIsRunning((current) => !current);
  };

  const handleStop = () => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);
    setIsStopConfirmOpen(false);
  };

  return (
    <aside
      className={cn(
        'hidden min-w-0 overflow-y-auto border-l border-slate-200/70 bg-white xl:block dark:border-white/10 dark:bg-slate-950',
        className
      )}
      style={style}
    >
      <div className="flex min-h-full flex-col bg-white px-8 py-6">
        <div className="mx-auto flex w-full max-w-[560px] min-w-0 flex-col items-center gap-7 pb-6">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-slate-950">
            <button
              type="button"
              className="rounded-full bg-[#f3f6ff] px-3.5 py-1.5 text-[14px] font-medium text-[#4d6cf0] dark:bg-white dark:text-slate-950"
            >
              番茄计时
            </button>
            <button
              type="button"
              className="rounded-full px-3.5 py-1.5 text-[14px] font-medium text-slate-400"
            >
              正计时
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMode(mode === 'focus' ? 'shortBreak' : mode === 'shortBreak' ? 'longBreak' : 'focus')}
            className="text-[16px] font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
          >
            {activeMode.label}
            <span className="ml-2 text-slate-300">›</span>
          </button>

          <div
            className="relative flex items-center justify-center"
            style={{ height: timerSize, width: timerSize }}
          >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 420 420" aria-hidden="true">
              <circle cx="210" cy="210" r="178" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="6" />
              <circle
                cx="210"
                cy="210"
                r="178"
                fill="none"
                stroke={activeMode.accent}
                strokeOpacity="0.26"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>

            <div className="text-center">
              <div className="text-[clamp(54px,5.6vw,72px)] font-light leading-none tracking-[-0.04em] text-slate-900/90 dark:text-white/95 tabular-nums">
                {formatClock(remainingSeconds)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[14px] font-medium transition-all',
                  item.id === mode
                    ? 'border border-[#dbe4ff] bg-[#f5f8ff] text-[#4d6cf0] dark:bg-white dark:text-slate-950'
                    : 'border border-slate-200 bg-white text-slate-500 hover:text-slate-900 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-white'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative flex items-center gap-2.5">
            <Button
              type="button"
              onClick={handleToggleRunning}
              className="h-11 min-w-[132px] rounded-full bg-[#4d6cf0] px-6 text-[15px] font-medium text-white shadow-none hover:bg-[#4563e6]"
            >
              {isRunning ? <Pause size={15} className="mr-2" /> : <Play size={15} className="mr-2" />}
              {isRunning ? '暂停' : hasStarted ? '继续' : '开始'}
            </Button>
            {!isRunning && hasStarted ? (
              <div ref={stopConfirmRef} className="relative">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsStopConfirmOpen((current) => !current)}
                  className="h-11 min-w-[100px] rounded-full border-slate-200 bg-white px-5 text-[15px] font-medium text-slate-600 shadow-none hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.08]"
                >
                  <Square size={14} className="mr-2" />
                  停止
                </Button>

                {isStopConfirmOpen ? (
                  <div className="absolute left-[calc(100%+12px)] top-1/2 z-20 w-56 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-slate-950">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">停止这次番茄钟？</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      会清空当前进度，恢复到 {activeMode.minutes} 分钟。
                    </p>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsStopConfirmOpen(false)}
                        className="h-8 rounded-full px-3 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        取消
                      </Button>
                      <Button
                        type="button"
                        onClick={handleStop}
                        className="h-8 rounded-full bg-rose-500 px-3 text-xs text-white hover:bg-rose-600"
                      >
                        确认停止
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex w-full items-start justify-center gap-10 border-t border-slate-100 pt-5 text-sm text-slate-400 dark:border-white/10 dark:text-slate-400">
            <div className="min-w-[88px] text-center">
              <div className="text-[13px] font-normal tracking-[0.01em]">已完成</div>
              <div className="mt-2 text-[24px] font-medium tracking-[-0.03em] text-slate-900 dark:text-white">
                {completedFocusCount}
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200 dark:bg-white/10" />
            <div className="min-w-[160px] text-center">
              <div className="text-[13px] font-normal tracking-[0.01em]">当前时间块</div>
              <div className="mt-2 truncate text-[17px] font-medium tracking-[-0.02em] text-slate-900 dark:text-white">
                {selectedBlock?.title ?? '未选择'}
              </div>
            </div>
          </div>
        </div>
      </div>

    </aside>
  );
}
