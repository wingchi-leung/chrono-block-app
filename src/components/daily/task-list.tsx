import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addMinutes, format, isSameDay, setHours, setMinutes } from 'date-fns';
import {
  Calendar,
  Check,
  Circle,
  Clock3,
  Focus,
  GripVertical,
  ListTodo,
  PanelLeftClose,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useStore } from '@/store';
import type { Task, TimeBlock } from '@/types';
import { cn } from '@/lib/utils';

type TaskView = 'planner' | 'scheduled' | 'completed';

type TaskListProps = {
  onCollapse?: () => void;
};

type TaskMeta = {
  task: Task;
  blockCount: number;
  isScheduledOnSelectedDate: boolean;
  latestBlockEnd: Date | null;
};

const QUICK_DURATION_OPTIONS = [30, 60, 90] as const;

const formatDurationLabel = (minutes: number | null) => {
  if (!minutes) {
    return '待估时';
  }

  if (minutes < 60) {
    return `${minutes} 分钟`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} 小时`;
  }

  return `${hours} 小时 ${remainingMinutes} 分钟`;
};

const formatCreatedLabel = (value: string) => format(new Date(value), 'M月d日 HH:mm');

const sortPlannerTasks = (left: TaskMeta, right: TaskMeta) => {
  if (left.isScheduledOnSelectedDate !== right.isScheduledOnSelectedDate) {
    return Number(left.isScheduledOnSelectedDate) - Number(right.isScheduledOnSelectedDate);
  }

  const leftHasDuration = Boolean(left.task.estimated_duration);
  const rightHasDuration = Boolean(right.task.estimated_duration);

  if (leftHasDuration !== rightHasDuration) {
    return Number(rightHasDuration) - Number(leftHasDuration);
  }

  return new Date(right.task.created_at).getTime() - new Date(left.task.created_at).getTime();
};

const sortScheduledTasks = (left: TaskMeta, right: TaskMeta) => {
  if (left.latestBlockEnd && right.latestBlockEnd) {
    return left.latestBlockEnd.getTime() - right.latestBlockEnd.getTime();
  }

  if (left.latestBlockEnd) {
    return -1;
  }

  if (right.latestBlockEnd) {
    return 1;
  }

  return new Date(right.task.created_at).getTime() - new Date(left.task.created_at).getTime();
};

export function TaskList({ onCollapse }: TaskListProps) {
  const {
    tasks,
    timeBlocks,
    selectedDate,
    loadTasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    convertTaskToTimeBlock,
    checkTimeConflict,
    draggingTask,
    setDraggingTask,
    setDragPointer,
  } = useStore();

  const [activeView, setActiveView] = useState<TaskView>('planner');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [quickDuration, setQuickDuration] = useState(30);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const taskMeta = useMemo(() => {
    const blocksByTask = new Map<string, TimeBlock[]>();

    timeBlocks.forEach((block) => {
      if (!block.task_id) {
        return;
      }

      const existing = blocksByTask.get(block.task_id) ?? [];
      existing.push(block);
      blocksByTask.set(block.task_id, existing);
    });

    return tasks.map((task) => {
      const relatedBlocks = blocksByTask.get(task.id) ?? [];
      const selectedDayBlocks = relatedBlocks.filter((block) =>
        isSameDay(new Date(block.start_time), selectedDate)
      );
      const latestBlockEnd =
        selectedDayBlocks
          .map((block) => new Date(block.end_time))
          .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

      return {
        task,
        blockCount: relatedBlocks.length,
        isScheduledOnSelectedDate: selectedDayBlocks.length > 0,
        latestBlockEnd,
      } satisfies TaskMeta;
    });
  }, [selectedDate, tasks, timeBlocks]);

  const plannerTasks = useMemo(
    () => taskMeta.filter(({ task }) => !task.completed).sort(sortPlannerTasks),
    [taskMeta]
  );

  const readyTasks = useMemo(
    () =>
      plannerTasks.filter(
        ({ task, isScheduledOnSelectedDate }) => Boolean(task.estimated_duration) && !isScheduledOnSelectedDate
      ),
    [plannerTasks]
  );

  const needsEstimateTasks = useMemo(
    () => plannerTasks.filter(({ task }) => !task.estimated_duration),
    [plannerTasks]
  );

  const scheduledTasks = useMemo(
    () => plannerTasks.filter(({ isScheduledOnSelectedDate }) => isScheduledOnSelectedDate).sort(sortScheduledTasks),
    [plannerTasks]
  );

  const completedTasks = useMemo(
    () =>
      taskMeta
        .filter(({ task }) => task.completed)
        .sort((left, right) => new Date(right.task.updated_at).getTime() - new Date(left.task.updated_at).getTime()),
    [taskMeta]
  );

  const summary = useMemo(
    () => ({
      readyCount: readyTasks.length,
      needsEstimateCount: needsEstimateTasks.length,
      scheduledCount: scheduledTasks.length,
      completedCount: completedTasks.length,
    }),
    [completedTasks.length, needsEstimateTasks.length, readyTasks.length, scheduledTasks.length]
  );

  const handleAddTask = useCallback(
    async (event?: React.FormEvent | React.KeyboardEvent) => {
      event?.preventDefault();

      if (isAdding) {
        return;
      }

      const title = newTaskTitle.trim();
      if (!title) {
        return;
      }

      setIsAdding(true);
      setNewTaskTitle('');

      try {
        await addTask({
          title,
          estimated_duration: quickDuration,
        });
        inputRef.current?.focus();
      } catch (error) {
        setNewTaskTitle(title);
      } finally {
        window.setTimeout(() => {
          setIsAdding(false);
        }, 250);
      }
    },
    [addTask, isAdding, newTaskTitle, quickDuration]
  );

  const handleStartEditing = useCallback((task: Task) => {
    setEditingTaskId(task.id);
    setEditValue(task.title);

    window.setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 20);
  }, []);

  const handleSaveEdit = useCallback(
    async (taskId: string) => {
      const title = editValue.trim();
      setEditingTaskId(null);

      if (!title) {
        return;
      }

      await updateTask(taskId, { title });
    },
    [editValue, updateTask]
  );

  const handleCustomDragStart = useCallback(
    (event: React.MouseEvent, task: Task) => {
      if (event.button !== 0) {
        return;
      }

      const target = event.target as HTMLElement;
      if (target.closest('button, input, textarea')) {
        return;
      }

      const originX = event.clientX;
      const originY = event.clientY;
      let activated = false;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const movedEnough =
          Math.abs(moveEvent.clientX - originX) > 4 || Math.abs(moveEvent.clientY - originY) > 4;

        if (!activated && movedEnough) {
          activated = true;
          setDraggingTask(task);
        }

        if (!activated) {
          return;
        }

        setDragPointer({ x: moveEvent.clientX, y: moveEvent.clientY });
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        window.setTimeout(() => {
          setDraggingTask(null);
          setDragPointer(null);
        }, 0);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp, { once: true });
    },
    [setDragPointer, setDraggingTask]
  );

  const findNextAvailableStart = useCallback(
    (duration: number) => {
      const now = new Date();
      const sameDayAsToday = isSameDay(selectedDate, now);
      let cursor = sameDayAsToday ? new Date(now) : setMinutes(setHours(new Date(selectedDate), 9), 0);
      cursor = setMinutes(cursor, Math.ceil(cursor.getMinutes() / 15) * 15);

      while (isSameDay(cursor, selectedDate)) {
        const end = addMinutes(cursor, duration);

        if (!isSameDay(end, selectedDate)) {
          return null;
        }

        if (!checkTimeConflict(cursor, end)) {
          return cursor;
        }

        cursor = addMinutes(cursor, 15);
      }

      return null;
    },
    [checkTimeConflict, selectedDate]
  );

  const handleQuickSchedule = useCallback(
    async (task: Task) => {
      const duration = task.estimated_duration || 30;
      const start = findNextAvailableStart(duration);

      if (!start) {
        return;
      }

      await convertTaskToTimeBlock(task.id, start);
    },
    [convertTaskToTimeBlock, findNextAvailableStart]
  );

  const handleSetEstimate = useCallback(
    async (taskId: string, duration: number) => {
      await updateTask(taskId, { estimated_duration: duration });
    },
    [updateTask]
  );

  const renderTaskCard = useCallback(
    (meta: TaskMeta, options?: { emphasizeScheduling?: boolean }) => {
      const { task, blockCount, isScheduledOnSelectedDate } = meta;
      const isEditing = editingTaskId === task.id;
      const showScheduleButton = !task.completed;

      return (
        <article
          key={task.id}
          draggable={false}
          className={cn(
            'group select-none rounded-xl border px-3 py-3 transition-all duration-200',
            draggingTask?.id === task.id
              ? 'border-primary/50 bg-primary/10 shadow-sm'
              : 'border-border/60 bg-background hover:border-border hover:bg-background'
          )}
          onMouseDown={(event) => handleCustomDragStart(event, task)}
          onDragStart={(event) => {
            event.preventDefault();
          }}
        >
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => void toggleTaskCompletion(task.id)}
              className={cn(
                'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all',
                task.completed
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary'
              )}
              aria-label={task.completed ? '标记为未完成' : '标记为已完成'}
            >
              {task.completed ? <Check size={12} strokeWidth={2.5} /> : <Circle size={11} strokeWidth={2.2} />}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <GripVertical
                  size={14}
                  className="mt-0.5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
                />
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <Input
                      ref={editInputRef}
                      type="text"
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      onBlur={() => void handleSaveEdit(task.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleSaveEdit(task.id);
                        }

                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setEditingTaskId(null);
                          setEditValue('');
                        }
                      }}
                      className="h-8 border-border bg-background px-2 text-sm shadow-none focus-visible:ring-primary/20"
                    />
                  ) : (
                    <button
                      type="button"
                      className="block w-full text-left"
                      onClick={() => handleStartEditing(task)}
                      aria-label={`编辑任务 ${task.title}`}
                    >
                      <div
                        className={cn(
                          'truncate text-sm font-semibold tracking-tight',
                          task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                        )}
                      >
                        {task.title}
                      </div>
                    </button>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium',
                        task.estimated_duration
                          ? 'bg-muted text-foreground/80'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200'
                      )}
                    >
                      <Clock3 size={11} />
                      {formatDurationLabel(task.estimated_duration)}
                    </span>

                    {isScheduledOnSelectedDate ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                        <Calendar size={11} />
                        已安排到今天
                      </span>
                    ) : null}

                    {blockCount > 0 ? (
                      <span className="inline-flex rounded-full bg-muted/70 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                        {blockCount} 个时间块
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 text-[11px] text-muted-foreground">
                    创建于 {formatCreatedLabel(task.created_at)}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {QUICK_DURATION_OPTIONS.map((duration) => (
                    <button
                      key={`${task.id}-${duration}`}
                      type="button"
                      onClick={() => void handleSetEstimate(task.id, duration)}
                      className={cn(
                        'rounded-full px-2 py-1 text-[11px] font-medium transition-colors',
                        task.estimated_duration === duration
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/80 text-muted-foreground hover:text-foreground'
                      )}
                      aria-label={`将任务时长设置为 ${duration} 分钟`}
                    >
                      {duration}m
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  {showScheduleButton ? (
                    <button
                      type="button"
                      onClick={() => void handleQuickSchedule(task)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                        options?.emphasizeScheduling
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'bg-primary/8 text-primary hover:bg-primary/12'
                      )}
                      aria-label={`快速安排任务 ${task.title}`}
                    >
                      <Sparkles size={12} />
                      安排空档
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void deleteTask(task.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`删除任务 ${task.title}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>
      );
    },
    [
      draggingTask?.id,
      editValue,
      editingTaskId,
      handleCustomDragStart,
      handleQuickSchedule,
      handleSaveEdit,
      handleSetEstimate,
      handleStartEditing,
      toggleTaskCompletion,
    ]
  );

  const renderPlannerView = () => {
    if (plannerTasks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/20 px-5 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ListTodo size={20} />
          </div>
          <p className="text-sm font-medium">暂无任务</p>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">优先安排</h4>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
              {readyTasks.length}
            </span>
          </div>

          {readyTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
              暂无可安排任务
            </div>
          ) : (
            <div className="space-y-3">{readyTasks.map((task) => renderTaskCard(task, { emphasizeScheduling: true }))}</div>
          )}
        </section>

      </div>
    );
  };

  const renderScheduledView = () => {
    if (scheduledTasks.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-5 py-8 text-center">
          <p className="text-sm font-medium">今天未安排</p>
        </div>
      );
    }

    return <div className="space-y-3">{scheduledTasks.map((task) => renderTaskCard(task))}</div>;
  };

  const renderCompletedView = () => {
    if (completedTasks.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-5 py-8 text-center">
          <p className="text-sm font-medium">暂无已完成</p>
        </div>
      );
    }

    return <div className="space-y-3">{completedTasks.map((task) => renderTaskCard(task))}</div>;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="border-b border-border/60 px-5 pb-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-primary">
              <ListTodo size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Task Planner</h3>
            </div>
          </div>

          {onCollapse ? (
            <button
              type="button"
              onClick={onCollapse}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="收起任务栏"
              title="收起任务栏"
            >
              <PanelLeftClose size={16} />
            </button>
          ) : null}
        </div>

        <form onSubmit={handleAddTask} className="mt-4 space-y-2.5">
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder="输入任务，回车直接进入任务箱"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              className="h-11 rounded-xl border-border/70 bg-background pr-16 shadow-none focus-visible:ring-primary/20"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              aria-label="添加任务"
            >
              <Plus size={12} />
              添加
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5 text-muted-foreground" aria-label="默认时长">
              <Clock3 size={13} />
            </div>
            <div className="flex items-center gap-1">
              {QUICK_DURATION_OPTIONS.map((duration) => (
                <button
                  key={`quick-duration-${duration}`}
                  type="button"
                  onClick={() => setQuickDuration(duration)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                    quickDuration === duration
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/70 text-muted-foreground hover:text-foreground'
                  )}
                  aria-label={`将新任务默认时长设为 ${duration} 分钟`}
                >
                  {duration}m
                </button>
              ))}
            </div>
          </div>
        </form>

        <div className="mt-3 flex gap-1 border-b border-border/50 pb-1">
          {[
            {
              id: 'planner' as const,
              label: '规划中',
              icon: Focus,
              count: summary.readyCount + summary.needsEstimateCount,
            },
            {
              id: 'scheduled' as const,
              label: '今天已排',
              icon: Calendar,
              count: summary.scheduledCount,
            },
            {
              id: 'completed' as const,
              label: '已完成',
              icon: Check,
              count: summary.completedCount,
            },
          ].map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveView(view.id)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
                activeView === view.id
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={`切换到${view.label}`}
              title={view.label}
            >
              <view.icon size={13} className="inline-block" />
              <span className="ml-1 text-[10px] opacity-80">{view.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4">
        {activeView === 'planner' ? renderPlannerView() : null}
        {activeView === 'scheduled' ? renderScheduledView() : null}
        {activeView === 'completed' ? renderCompletedView() : null}
      </div>
    </div>
  );
}
