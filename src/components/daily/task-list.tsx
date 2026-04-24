import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addMinutes, format, isSameDay, setHours, setMinutes, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import {
  Check,
  ListTodo,
  PanelLeftClose,
  Plus,
  Sparkles,
  X,
  ChevronDown,
  Sun,
  CalendarDays,
  Tag,
  CheckCircle2,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';
import type { Task, TimeBlock } from '@/types';
import { cn, parseTagsFromText, formatTitleWithTags, getTagPalette } from '@/lib/utils';
import { TaskProgressPie } from './task-progress-pie';

type TaskListProps = {
  onCollapse?: () => void;
};

type TaskNavType = 'today' | 'week' | 'tags' | 'completed' | 'deleted';

type TaskMeta = {
  task: Task;
  blockCount: number;
  isScheduledOnSelectedDate: boolean;
  isScheduledThisWeek: boolean;
  latestBlockEnd: Date | null;
};

const QUICK_DURATION_OPTIONS = [30, 60, 90] as const;

const formatSelectedDateLabel = (value: Date) => format(value, 'M月d日 EEEE');
const formatDueLikeLabel = (value: Date | null) => (value ? format(value, 'M月d日') : null);

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

const sortCompletedTasks = (a: TaskMeta, b: TaskMeta) => {
  return new Date(b.task.updated_at).getTime() - new Date(a.task.updated_at).getTime();
};

export function TaskList({ onCollapse }: TaskListProps) {
  const {
    tasks,
    deletedTasks,
    timeBlocks,
    selectedDate,
    loadTasks,
    loadDeletedTasks,
    addTask,
    updateTask,
    softDeleteTask,
    restoreTask,
    toggleTaskCompletion,
    convertTaskToTimeBlock,
    checkTimeConflict,
    draggingTask,
    setDraggingTask,
    setDragPointer,
  } = useStore();

  const [activeNav, setActiveNav] = useState<TaskNavType>('today');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [quickDuration, setQuickDuration] = useState(30);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (activeNav === 'deleted') {
      void loadDeletedTasks();
    }
  }, [activeNav, loadDeletedTasks]);

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

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
      const thisWeekBlocks = relatedBlocks.filter((block) =>
        isWithinInterval(new Date(block.start_time), { start: weekStart, end: weekEnd })
      );
      const latestBlockEnd =
        selectedDayBlocks
          .map((block) => new Date(block.end_time))
          .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

      return {
        task,
        blockCount: relatedBlocks.length,
        isScheduledOnSelectedDate: selectedDayBlocks.length > 0,
        isScheduledThisWeek: thisWeekBlocks.length > 0,
        latestBlockEnd,
      } satisfies TaskMeta;
    });
  }, [selectedDate, tasks, timeBlocks, weekStart, weekEnd]);

  const deletedTaskMeta = useMemo(() => {
    return deletedTasks.map((task) => ({
      task,
      blockCount: 0,
      isScheduledOnSelectedDate: false,
      isScheduledThisWeek: false,
      latestBlockEnd: null,
    } satisfies TaskMeta));
  }, [deletedTasks]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach((task) => {
      task.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  const navCounts = useMemo(() => {
    const todayCount = taskMeta.filter((m) => !m.task.completed).length;
    const weekCount = taskMeta.filter((m) => !m.task.completed && (m.isScheduledThisWeek || !m.isScheduledOnSelectedDate)).length;
    const completedCount = taskMeta.filter((m) => m.task.completed).length;
    const deletedCount = deletedTasks.length;

    return {
      today: todayCount,
      week: Math.max(weekCount, todayCount),
      tags: allTags.length,
      completed: completedCount,
      deleted: deletedCount,
    };
  }, [taskMeta, allTags.length, deletedTasks.length]);

  const filteredTasks = useMemo(() => {
    if (activeNav === 'deleted') {
      return deletedTaskMeta;
    }

    switch (activeNav) {
      case 'today':
        return taskMeta.filter((m) => !m.task.completed).sort(sortPlannerTasks);
      case 'week':
        return taskMeta.filter((m) => !m.task.completed).sort(sortPlannerTasks);
      case 'tags':
        if (selectedTag) {
          return taskMeta
            .filter((m) => !m.task.completed && m.task.tags?.includes(selectedTag))
            .sort(sortPlannerTasks);
        }
        return [];
      case 'completed':
        return taskMeta.filter((m) => m.task.completed).sort(sortCompletedTasks);
      default:
        return [];
    }
  }, [activeNav, selectedTag, taskMeta, deletedTaskMeta]);

  const selectedDateLabel = useMemo(() => formatSelectedDateLabel(selectedDate), [selectedDate]);

  const getNavTitle = () => {
    switch (activeNav) {
      case 'today':
        return '今天';
      case 'week':
        return '本周';
      case 'tags':
        return selectedTag ? `#${selectedTag}` : '标签';
      case 'completed':
        return '已完成';
      case 'deleted':
        return '回收站';
      default:
        return '今天';
    }
  };

  const handleAddTask = useCallback(
    async (event?: React.FormEvent | React.KeyboardEvent) => {
      event?.preventDefault();

      if (isAdding) {
        return;
      }

      const inputText = newTaskTitle.trim();
      if (!inputText) {
        return;
      }

      const { tags, cleanText } = parseTagsFromText(inputText);
      const title = cleanText || (tags.length > 0 ? tags[0] : inputText);

      setIsAdding(true);
      setNewTaskTitle('');

      try {
        await addTask({
          title,
          tags: tags.length > 0 ? tags : undefined,
          estimated_duration: quickDuration,
        });
        inputRef.current?.focus();
      } catch (error) {
        setNewTaskTitle(inputText);
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
    setEditValue(formatTitleWithTags(task.title, task.tags || []));

    window.setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 20);
  }, []);

  const handleSaveEdit = useCallback(
    async (taskId: string) => {
      const inputText = editValue.trim();
      setEditingTaskId(null);

      if (!inputText) {
        return;
      }

      const { tags, cleanText } = parseTagsFromText(inputText);
      const title = cleanText || inputText;

      await updateTask(taskId, { title, tags });
    },
    [editValue, updateTask]
  );

  const handleDeleteClick = useCallback((task: Task) => {
    setTaskToDelete(task);
    setDeleteConfirmDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!taskToDelete) {
      return;
    }

    await softDeleteTask(taskToDelete.id);
    setDeleteConfirmDialogOpen(false);
    setTaskToDelete(null);
  }, [taskToDelete, softDeleteTask]);

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
    [checkTimeConflict, selectedDate, now]
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
    (meta: TaskMeta, _options?: { emphasizeScheduling?: boolean }) => {
      const { task, latestBlockEnd } = meta;
      const isEditing = editingTaskId === task.id;
      const showScheduleButton = !task.completed;
      const trailingDateLabel = formatDueLikeLabel(latestBlockEnd);
      const isDeleted = task.deleted;

      if (isDeleted) {
        return (
          <article
            key={task.id}
            className="group select-none border-b border-border/50 py-2.5 transition-colors hover:bg-muted/[0.12]"
          >
            <div className="flex items-center gap-3 px-1">
              <div className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <Trash2 size={12} className="text-muted-foreground/60" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-muted-foreground/70">
                      {task.title}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void restoreTask(task.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`恢复任务 ${task.title}`}
                  title="恢复"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>
          </article>
        );
      }

      if (activeNav === 'completed') {
        return (
          <article
            key={task.id}
            className="group select-none border-b border-border/50 py-2.5 transition-colors hover:bg-muted/[0.12]"
          >
            <div className="flex items-center gap-3 px-1">
              <button
                type="button"
                onClick={() => void toggleTaskCompletion(task.id)}
                className={cn(
                  'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border transition-all',
                  task.completed
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary'
                )}
                aria-label={task.completed ? '标记为未完成' : '标记为已完成'}
              >
                {task.completed ? <Check size={12} strokeWidth={2.5} /> : null}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'truncate text-[14px] font-medium',
                        task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                      )}
                    >
                      {task.title}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDeleteClick(task)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  aria-label={`删除任务 ${task.title}`}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          </article>
        );
      }

      return (
        <article
          key={task.id}
          draggable={false}
          className={cn(
            'group flex h-12 items-center gap-3 border-b border-border/50 px-1 transition-colors',
            draggingTask?.id === task.id
              ? 'bg-primary/[0.04]'
              : 'hover:bg-muted/[0.18]'
          )}
          onMouseDown={(event) => handleCustomDragStart(event, task)}
          onDragStart={(event) => {
            event.preventDefault();
          }}
        >
          {showScheduleButton ? (
            <button
              type="button"
              onClick={() => void handleQuickSchedule(task)}
              className="inline-flex shrink-0 items-center gap-0.5 rounded px-0.5 py-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 group/btn"
              aria-label={`快速安排任务 ${task.title}`}
            >
              <Sparkles size={12} />
              <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs transition-all duration-200 group-hover/btn:max-w-20">
                一键安排
              </span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void toggleTaskCompletion(task.id)}
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-none border transition-all',
              task.completed
                ? 'border-primary bg-primary'
                : 'bg-white hover:border-gray-600'
            )}
            aria-label={task.completed ? '标记为未完成' : '标记为已完成'}
            style={{
              width: '18px',
              height: '18px',
              borderColor: task.completed ? undefined : '#666',
              color: task.completed ? '#fff' : '#999',
            }}
          >
            {task.completed ? <Check size={10} strokeWidth={2.5} /> : null}
          </button>

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
                className="h-8 rounded-lg border-gray-300 bg-white px-2 text-sm shadow-none"
                style={{ color: '#333' }}
              />
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="block min-w-0 flex-1 text-left"
                  onClick={() => handleStartEditing(task)}
                  aria-label={`编辑任务 ${task.title}`}
                >
                  <span
                    className={cn(
                      'truncate text-sm font-medium',
                      task.completed ? 'line-through' : ''
                    )}
                    style={{ color: task.completed ? '#999' : '#333' }}
                  >
                    {task.title}
                  </span>
                </button>

                {task.tags && task.tags.length > 0 ? (
                  <div className="flex shrink-0 items-center gap-1">
                    {task.tags!.map((tag) => {
                      const palette = getTagPalette(tag);
                      return (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: palette.accent,
                            color: palette.text,
                          }}
                        >
                          #{tag}
                        </span>
                      );
                    })}
                  </div>
                ) : null}

                {trailingDateLabel ? (
                  <span className="shrink-0 text-xs" style={{ color: '#999' }}>
                    {trailingDateLabel}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
            {QUICK_DURATION_OPTIONS.map((duration) => (
              <button
                key={`${task.id}-${duration}`}
                type="button"
                onClick={() => void handleSetEstimate(task.id, duration)}
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs transition-colors',
                  task.estimated_duration === duration
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
                style={{ color: task.estimated_duration === duration ? '#fff' : '#666' }}
                aria-label={`将任务时长设置为 ${duration} 分钟`}
              >
                {duration}m
              </button>
            ))}

            <button
              type="button"
              onClick={() => void deleteTask(task.id)}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500"
              aria-label={`删除任务 ${task.title}`}
            >
              <X size={12} />
            </button>
          </div>
        </article>
      );
    },
    [
      activeNav,
      draggingTask?.id,
      editValue,
      editingTaskId,
      handleCustomDragStart,
      handleDeleteClick,
      handleQuickSchedule,
      handleSaveEdit,
      handleSetEstimate,
      handleStartEditing,
      restoreTask,
      toggleTaskCompletion,
    ]
  );

  const renderTaskSection = (
    title: string,
    tasks: TaskMeta[],
    options?: {
      emphasizeScheduling?: boolean;
      emptyText?: string;
    }
  ) => {
    const emptyText = options?.emptyText ?? '这里还没有任务';

    return (
      <section className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold" style={{ color: '#333' }}>{title}</h4>
            <span className="text-xs" style={{ color: '#999' }}>{tasks.length}</span>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="px-1 py-2 text-sm" style={{ color: '#999' }}>
            {emptyText}
          </div>
        ) : (
          <div>
            {tasks.map((task) => renderTaskCard(task, { emphasizeScheduling: options?.emphasizeScheduling }))}
          </div>
        )}
      </section>
    );
  };

  const renderTaskSections = () => {
    if (activeNav === 'deleted') {
      if (filteredTasks.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-5 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Trash2 size={20} />
            </div>
            <p className="text-sm font-medium">回收站为空</p>
          </div>
        );
      }

      return (
        <div className="space-y-7">
          {renderTaskSection('已删除', filteredTasks, {
            emptyText: '回收站为空',
          })}
        </div>
      );
    }

    return (
      <section className="space-y-1 border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={() => setShowCompletedTasks(!showCompletedTasks)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-2">
            <History size={14} style={{ color: '#999' }} />
            <h4 className="text-sm font-semibold" style={{ color: '#333' }}>历史任务</h4>
            <span className="text-xs" style={{ color: '#999' }}>{completedTasks.length}</span>
          </div>
          {showCompletedTasks ? (
            <ChevronUp size={14} style={{ color: '#999' }} />
          ) : (
            <ChevronDown size={14} style={{ color: '#999' }} />
          )}
        </button>

        {showCompletedTasks ? (
          <div className="mt-1">
            {completedTasks.map((task) => renderTaskCard(task))}
          </div>
        );
      }

      return (
        <div className="space-y-2">
          {allTags.map((tag) => {
            const palette = getTagPalette(tag);
            const tagTaskCount = taskMeta.filter(
              (m) => !m.task.completed && m.task.tags?.includes(tag)
            ).length;

            return (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium"
                    style={{
                      backgroundColor: hexToRgba(palette.accent, 0.18),
                      color: palette.text,
                      border: `1px solid ${hexToRgba(palette.accent, 0.3)}`,
                    }}
                  >
                    #{tag}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{tagTaskCount}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if (filteredTasks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100" style={{ color: '#999' }}>
            <ListTodo size={20} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#666' }}>暂无任务</p>
        </div>
      );
    }

    const unscheduledInFiltered = filteredTasks.filter(({ isScheduledOnSelectedDate }) => !isScheduledOnSelectedDate);

    return (
      <div className="space-y-4">
        {plannerTasks.length > 0
          ? renderTaskSection('任务', unscheduledTasks, {
              emptyText: '当前没有待办任务',
            })
          : null}
        {renderCompletedTasks()}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="border-b border-gray-200 px-5 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-semibold tracking-tight" style={{ color: '#333' }}>今天</h3>
              <span className="text-xs" style={{ color: '#999' }}>{selectedDateLabel}</span>
            </div>
          </div>

          {onCollapse ? (
            <button
              type="button"
              onClick={onCollapse}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-gray-100"
              style={{ color: '#999' }}
              aria-label="收起任务栏"
              title="收起任务栏"
            >
              {count}
            </span>
          )}
        </button>
        <div
          className={cn(
            'pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100',
            'after:absolute after:right-full after:top-1/2 after:-translate-y-1/2 after:border-4 after:border-transparent after:border-r-foreground'
          )}
        >
          {label}
          {count > 0 && <span className="ml-1 text-background/70">({count})</span>}
        </div>
      </div>
    );
  };

        <form onSubmit={handleAddTask} className="mt-3 space-y-2">
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder="添加任务"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              className="h-10 rounded-lg border-gray-200 bg-gray-50 pl-10 pr-14 text-sm shadow-none focus-visible:border-gray-300 focus-visible:bg-white focus-visible:ring-0"
              style={{ color: '#333' }}
            />
            <Plus size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#999' }} />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs transition-colors hover:bg-gray-200"
              style={{ color: '#666' }}
              aria-label="添加任务"
            >
              添加
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs" style={{ color: '#999' }}>
            <span>默认时长</span>
            {QUICK_DURATION_OPTIONS.map((duration) => (
              <button
                type="button"
                onClick={() => setQuickDuration(duration)}
                className={cn(
                  'rounded-md px-1.5 py-0.5 transition-colors',
                  quickDuration === duration
                    ? 'bg-gray-800 text-white'
                    : 'hover:bg-gray-100'
                )}
                style={{ color: quickDuration === duration ? '#fff' : '#666' }}
                aria-label={`将新任务默认时长设为 ${duration} 分钟`}
              >
                <PanelLeftClose size={16} />
              </button>
            ) : null}
          </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-3">
        {renderTaskSections()}
      </div>

      <Dialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除任务「{taskToDelete?.title}」吗？<br />
              删除后可以在回收站中恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteConfirmDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
