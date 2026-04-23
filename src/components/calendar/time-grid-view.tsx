import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent } from 'react';
import {
  addDays,
  addMinutes,
  differenceInMinutes,
  format,
  isSameDay,
  isToday,
  max as maxDate,
  min as minDate,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Copy,
  Frown,
  GripVertical,
  PanelLeftOpen,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectPickerDialog } from '@/components/daily/project-picker-dialog';
import { TaskList } from '@/components/daily/task-list';
import { PomodoroPanel } from '@/components/daily/pomodoro-panel';
import { useStore } from '@/store';
import type { Task, TimeBlock } from '@/types';
import { cn, COLORS, getTimeBlockPalette, hexToRgba } from '@/lib/utils';

const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 32;
const MINUTES_IN_DAY = 24 * 60;
const DAY_COLUMN_MIN_WIDTH = 180;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const TOTAL_GRID_HEIGHT = (MINUTES_IN_DAY / SLOT_MINUTES) * SLOT_HEIGHT;
type TimeGridViewProps = {
  mode: 'day' | 'week';
};

type DragPreview = {
  blockId: string;
  dayIndex: number;
  startMinute: number;
  endMinute: number;
  invalid: boolean;
};

type ActiveInteraction =
  | {
      type: 'move';
      block: TimeBlock;
      originClientX: number;
      originClientY: number;
      originMinute: number;
      dayIndex: number;
      minute: number;
      moved: boolean;
    }
  | {
      type: 'resize-start';
      block: TimeBlock;
      dayIndex: number;
      minute: number;
    }
  | {
      type: 'resize-end';
      block: TimeBlock;
      dayIndex: number;
      minute: number;
    };

type ContextMenuState = {
  blockId: string;
  x: number;
  y: number;
};

type PendingMoveState = {
  block: TimeBlock;
  originClientX: number;
  originClientY: number;
  originMinute: number;
  dayIndex: number;
  minute: number;
};

const snapMinute = (minute: number) => {
  const snapped = Math.round(minute / SLOT_MINUTES) * SLOT_MINUTES;
  return Math.min(MINUTES_IN_DAY, Math.max(0, snapped));
};

const clampMinute = (minute: number) => Math.min(MINUTES_IN_DAY, Math.max(0, minute));
const getMinuteFromRelativeY = (relativeY: number) =>
  snapMinute((clampMinute((relativeY / SLOT_HEIGHT) * SLOT_MINUTES)));
const getDateFromMinute = (day: Date, minute: number) => addMinutes(startOfDay(day), clampMinute(minute));
const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();
const isHourSlot = (slotIndex: number) => slotIndex % (60 / SLOT_MINUTES) === 0;
const isHalfHourSlot = (slotIndex: number) => slotIndex % (30 / SLOT_MINUTES) === 0;

const formatDurationLabel = (minutes: number) => {
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

const getBlockStyle = (
  palette: ReturnType<typeof getTimeBlockPalette>,
  status: TimeBlock['completion_status'],
  selected: boolean
): CSSProperties => {
  if (status === 'completed') {
    return {
      backgroundColor: hexToRgba(palette.accent, selected ? 0.18 : 0.12),
      borderColor: hexToRgba(palette.accent, selected ? 0.36 : 0.22),
      boxShadow: selected ? `0 0 0 1px ${hexToRgba(palette.accent, 0.08)}` : 'none',
      opacity: 0.92,
    };
  }

  if (status === 'incomplete') {
    return {
      backgroundColor: hexToRgba(palette.accent, selected ? 0.14 : 0.1),
      borderColor: hexToRgba(palette.accent, selected ? 0.3 : 0.2),
      boxShadow: selected ? `0 0 0 1px ${hexToRgba(palette.accent, 0.06)}` : 'none',
      opacity: 0.84,
    };
  }

  return {
    backgroundColor: selected ? hexToRgba(palette.accent, 0.16) : hexToRgba(palette.accent, 0.08),
    borderColor: selected ? hexToRgba(palette.accent, 0.32) : hexToRgba(palette.accent, 0.18),
    boxShadow: selected ? `0 0 0 1px ${hexToRgba(palette.accent, 0.08)}` : 'none',
  };
};

const getBlockTone = (_palette: ReturnType<typeof getTimeBlockPalette>, selected: boolean) =>
  cn(
    selected ? 'text-slate-950 dark:text-slate-50' : 'text-slate-900 dark:text-slate-50',
    '[&_p]:text-current'
  );

const getPreviewForBlock = (
  interaction: ActiveInteraction,
  visibleDays: Date[]
): Omit<DragPreview, 'invalid'> | null => {
  const blockStart = new Date(interaction.block.start_time);
  const blockEnd = new Date(interaction.block.end_time);
  const duration = differenceInMinutes(blockEnd, blockStart);

  if (interaction.type === 'move') {
    let startMinute = clampMinute(interaction.minute);
    let endMinute = startMinute + duration;

    if (endMinute > MINUTES_IN_DAY) {
      endMinute = MINUTES_IN_DAY;
      startMinute = Math.max(0, endMinute - duration);
    }

    return { blockId: interaction.block.id, dayIndex: interaction.dayIndex, startMinute, endMinute };
  }

  const originalDayIndex = visibleDays.findIndex((day) => isSameDay(day, blockStart));
  if (originalDayIndex < 0) {
    return null;
  }

  const originalStartMinute = minuteOfDay(blockStart);
  const originalEndMinute = minuteOfDay(blockEnd);

  if (interaction.type === 'resize-start') {
    const endMinute = originalDayIndex === interaction.dayIndex ? originalEndMinute : MINUTES_IN_DAY;
    const startMinute = Math.min(interaction.minute, endMinute - SLOT_MINUTES);
    return {
      blockId: interaction.block.id,
      dayIndex: interaction.dayIndex,
      startMinute: clampMinute(startMinute),
      endMinute,
    };
  }

  const startMinute = originalDayIndex === interaction.dayIndex ? originalStartMinute : 0;
  const endMinute = Math.max(interaction.minute, startMinute + SLOT_MINUTES);
  return {
    blockId: interaction.block.id,
    dayIndex: interaction.dayIndex,
    startMinute,
    endMinute: clampMinute(endMinute),
  };
};

export function TimeGridView({ mode }: TimeGridViewProps) {
  const {
    selectedDate,
    timeBlocks,
    projects,
    loadTimeBlocks,
    loadTasks,
    loadProjects,
    addTimeBlock,
    updateTimeBlock,
    addProject,
    deleteTimeBlock,
    setSelectedDate,
    checkTimeConflict,
    convertTaskToTimeBlock,
    setTimeBlockCompletion,
    draggingTask,
    dragPointer,
    setDraggingTask,
    setDragPointer,
  } = useStore();

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [activeInteraction, setActiveInteraction] = useState<ActiveInteraction | null>(null);
  const [dragOverState, setDragOverState] = useState<{ dayIndex: number; minute: number } | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [isTaskSidebarOpen, setIsTaskSidebarOpen] = useState(true);
  const [clipboardBlock, setClipboardBlock] = useState<TimeBlock | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [inlineEditingBlockId, setInlineEditingBlockId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [pendingMove, setPendingMove] = useState<PendingMoveState | null>(null);
  const [projectPickerBlockId, setProjectPickerBlockId] = useState<string | null>(null);
  const [dayCalendarWidth, setDayCalendarWidth] = useState(42);
  const [isResizingDayPanels, setIsResizingDayPanels] = useState(false);
  const [isWideDayLayout, setIsWideDayLayout] = useState(false);
  const [taskSidebarWidth, setTaskSidebarWidth] = useState(380);
  const [isResizingTaskSidebar, setIsResizingTaskSidebar] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridBodyRef = useRef<HTMLDivElement>(null);
  const daySplitRef = useRef<HTMLDivElement>(null);
  const lastBlockClickRef = useRef<{ blockId: string; timestamp: number } | null>(null);

  const visibleDays = useMemo(() => {
    if (mode === 'day') {
      return [startOfDay(selectedDate)];
    }

    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [mode, selectedDate]);

  const selectedBlock = useMemo(
    () => timeBlocks.find((block) => block.id === selectedBlockId) ?? null,
    [selectedBlockId, timeBlocks]
  );
  const projectPickerBlock = useMemo(
    () => timeBlocks.find((block) => block.id === projectPickerBlockId) ?? null,
    [projectPickerBlockId, timeBlocks]
  );
  const visibleRange = useMemo(() => {
    const start = startOfDay(visibleDays[0]);
    const end = addDays(startOfDay(visibleDays[visibleDays.length - 1]), 1);
    return { start, end };
  }, [visibleDays]);
  const dayColumnTemplate =
    mode === 'day' ? 'minmax(0, 1fr)' : `minmax(${DAY_COLUMN_MIN_WIDTH}px, 1fr)`;
  const gridTemplateColumns = `72px repeat(${visibleDays.length}, ${dayColumnTemplate})`;

  const visibleBlocks = useMemo(
    () =>
      timeBlocks.filter((block) => {
        const start = new Date(block.start_time);
        const end = new Date(block.end_time);
        return start < visibleRange.end && end > visibleRange.start;
      }),
    [timeBlocks, visibleRange]
  );

  const getGridPosition = (clientX: number, clientY: number) => {
    const grid = gridBodyRef.current;
    if (!grid) {
      return null;
    }

    const column = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-day-index]');
    if (!column) {
      return null;
    }

    const dayIndexRaw = column.dataset.dayIndex;
    if (dayIndexRaw === undefined) {
      return null;
    }

    const dayIndex = Number(dayIndexRaw);
    const rect = column.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const minute = getMinuteFromRelativeY(relativeY);
    return { dayIndex, minute };
  };

  const createBlockAt = async (dayIndex: number, minute: number) => {
    const targetDay = visibleDays[dayIndex];
    const start = getDateFromMinute(targetDay, minute);
    const end = addMinutes(start, 30);

    if (checkTimeConflict(start, end)) {
      setMessage({ tone: 'error', text: '这个时间段已经有时间块了，不能重复创建。' });
      return;
    }

    try {
      const block = await addTimeBlock({
        title: '未命名时间块',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        color: COLORS[0],
      });
      setSelectedBlockId(block.id);
      setMessage({ tone: 'success', text: '已创建 30 分钟时间块。' });
    } catch (error) {
      setMessage({ tone: 'error', text: '创建时间块失败。' });
    }
  };

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadTimeBlocks(visibleRange.start.toISOString(), visibleRange.end.toISOString());
  }, [loadTimeBlocks, visibleRange]);

  useEffect(() => {
    if (!inlineEditingBlockId) {
      return;
    }

    const block = timeBlocks.find((item) => item.id === inlineEditingBlockId);
    if (!block) {
      setInlineEditingBlockId(null);
      setInlineEditValue('');
      return;
    }

    setInlineEditValue(block.title);
  }, [inlineEditingBlockId, timeBlocks]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    const now = new Date();
    const target = Math.max(0, (minuteOfDay(now) / SLOT_MINUTES) * SLOT_HEIGHT - 240);
    scrollRef.current.scrollTop = target;
  }, [mode]);

  useEffect(() => {
    if (mode !== 'week' || !scrollRef.current) {
      return;
    }

    const container = scrollRef.current;
    const selectedDayIndex = visibleDays.findIndex((day) => isSameDay(day, selectedDate));
    if (selectedDayIndex < 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const dayColumn = container.querySelector<HTMLElement>(`[data-day-column="${selectedDayIndex}"]`);
      if (!dayColumn) {
        return;
      }

      const preferredOffset = container.clientWidth * 0.35;
      const targetLeft = Math.max(
        0,
        dayColumn.offsetLeft - preferredOffset + dayColumn.offsetWidth / 2
      );

      container.scrollTo({
        left: targetLeft,
        behavior: 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isTaskSidebarOpen, mode, selectedDate, visibleDays]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = window.setTimeout(() => setMessage(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (event.key === 'Escape') {
        setSelectedBlockId(null);
        setContextMenu(null);
        return;
      }

      if (!selectedBlock || isTyping) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        await handleDeleteBlock(selectedBlock.id);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        setClipboardBlock(selectedBlock);
        setMessage({ tone: 'success', text: '已复制时间块。' });
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && clipboardBlock) {
        event.preventDefault();
        await handlePasteBlock();
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-context-menu]')) {
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [clipboardBlock, selectedBlock]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const handleMediaQueryChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsWideDayLayout(event.matches);
    };

    handleMediaQueryChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaQueryChange);
      return () => mediaQuery.removeEventListener('change', handleMediaQueryChange);
    }

    mediaQuery.addListener(handleMediaQueryChange);
    return () => mediaQuery.removeListener(handleMediaQueryChange);
  }, []);

  useEffect(() => {
    if (!pendingMove || activeInteraction) {
      return;
    }

    const cleanupListeners = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const movedEnough =
        Math.abs(event.clientX - pendingMove.originClientX) > 6 ||
        Math.abs(event.clientY - pendingMove.originClientY) > 6;

      if (!movedEnough) {
        return;
      }

      setActiveInteraction({
        type: 'move',
        block: pendingMove.block,
        originClientX: pendingMove.originClientX,
        originClientY: pendingMove.originClientY,
        originMinute: pendingMove.originMinute,
        dayIndex: pendingMove.dayIndex,
        minute: pendingMove.minute,
        moved: true,
      });
      setPendingMove(null);
    };

    const handleMouseUp = () => {
      cleanupListeners();

      const now = Date.now();
      const lastClick = lastBlockClickRef.current;
      const isDoubleClick =
        lastClick?.blockId === pendingMove.block.id && now - lastClick.timestamp < 320;

      if (isDoubleClick) {
        setSelectedBlockId(pendingMove.block.id);
        setInlineEditingBlockId(pendingMove.block.id);
        setInlineEditValue(pendingMove.block.title);
        setDragPreview(null);
        setDragOverState(null);
        setActiveInteraction(null);
        lastBlockClickRef.current = null;
      } else {
        lastBlockClickRef.current = {
          blockId: pendingMove.block.id,
          timestamp: now,
        };
        setSelectedBlockId(pendingMove.block.id);
      }

      setPendingMove(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    return cleanupListeners;
  }, [activeInteraction, pendingMove]);

  useEffect(() => {
    if (!draggingTask) {
      setDragOverState(null);
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const result = getGridPosition(event.clientX, event.clientY);
      if (!result) {
        setDragOverState(null);
        return;
      }

      setDragOverState(result);
      setDragPointer({ x: event.clientX, y: event.clientY });
    };

    const handleMouseUp = async () => {
      const hovered = dragOverState;
      const task = draggingTask;

      if (hovered && task) {
        const droppedDay = visibleDays[hovered.dayIndex];
        const block = await convertTaskToTimeBlock(task.id, getDateFromMinute(droppedDay, hovered.minute));
        if (block) {
          setSelectedBlockId(block.id);
          setMessage({ tone: 'success', text: '任务已转成时间块。' });
        } else {
          setMessage({ tone: 'error', text: '放置失败，这个时间段已经有冲突。' });
        }
      }

      setDragOverState(null);
      setDraggingTask(null);
      setDragPointer(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [convertTaskToTimeBlock, dragOverState, draggingTask, setDragPointer, setDraggingTask, visibleDays]);

  useEffect(() => {
    if (!activeInteraction) {
      return;
    }

    const cleanupListeners = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const result = getGridPosition(event.clientX, event.clientY);
      if (!result) {
        return;
      }

      if (activeInteraction.type === 'move') {
        const movedEnough =
          Math.abs(event.clientX - activeInteraction.originClientX) > 6 ||
          Math.abs(event.clientY - activeInteraction.originClientY) > 6;
        const deltaMinutes = snapMinute(
          activeInteraction.originMinute +
            ((event.clientY - activeInteraction.originClientY) / SLOT_HEIGHT) * SLOT_MINUTES
        );

        setActiveInteraction({
          ...activeInteraction,
          dayIndex: result.dayIndex,
          minute: deltaMinutes,
          moved: activeInteraction.moved || movedEnough,
        });
        return;
      }

      setActiveInteraction({
        ...activeInteraction,
        dayIndex: result.dayIndex,
        minute: result.minute,
      });
    };

    const handleMouseUp = async () => {
      cleanupListeners();

      const interaction = activeInteraction;
      setActiveInteraction(null);
      setDragPreview(null);

      const preview = getPreviewForBlock(interaction, visibleDays);
      if (!preview) {
        return;
      }

      const targetDay = visibleDays[preview.dayIndex];
      const start = getDateFromMinute(targetDay, preview.startMinute);
      const end = getDateFromMinute(targetDay, preview.endMinute);

      if (checkTimeConflict(start, end, interaction.block.id)) {
        setMessage({ tone: 'error', text: '这个时间段已经有时间块了。' });
        return;
      }

      try {
        await updateTimeBlock(interaction.block.id, {
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        });
        setSelectedBlockId(interaction.block.id);
      } catch (error) {
        setMessage({ tone: 'error', text: '更新时间块失败。' });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    return cleanupListeners;
  }, [activeInteraction, addTimeBlock, checkTimeConflict, updateTimeBlock, visibleDays]);

  useEffect(() => {
    if (!activeInteraction) {
      return;
    }

    if (activeInteraction.type === 'move' && !activeInteraction.moved) {
      setDragPreview(null);
      return;
    }

    const preview = getPreviewForBlock(activeInteraction, visibleDays);
    if (!preview) {
      setDragPreview(null);
      return;
    }

    const day = visibleDays[preview.dayIndex];
    const start = getDateFromMinute(day, preview.startMinute);
    const end = getDateFromMinute(day, preview.endMinute);
    const invalid =
      preview.endMinute - preview.startMinute < SLOT_MINUTES ||
      checkTimeConflict(start, end, activeInteraction.block.id);

    setDragPreview({ ...preview, invalid });
  }, [activeInteraction, checkTimeConflict, visibleDays]);

  useEffect(() => {
    if (!isResizingDayPanels || mode !== 'day' || !isWideDayLayout) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const container = daySplitRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const nextWidth = ((event.clientX - rect.left) / rect.width) * 100;
      const clampedWidth = Math.min(68, Math.max(30, nextWidth));
      setDayCalendarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingDayPanels(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingDayPanels, isWideDayLayout, mode]);

  useEffect(() => {
    if (!isResizingTaskSidebar || !isTaskSidebarOpen) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const container = layoutRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const nextWidth = rect.right - event.clientX;
      const clampedWidth = Math.min(520, Math.max(300, nextWidth));
      setTaskSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingTaskSidebar(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingTaskSidebar, isTaskSidebarOpen]);

  const handleTaskDrop = async (event: ReactDragEvent<HTMLDivElement>, dayIndex: number) => {
    event.preventDefault();
    setDragOverState(null);

    const rect = event.currentTarget.getBoundingClientRect();
    const minute = getMinuteFromRelativeY(event.clientY - rect.top);
    const droppedDay = visibleDays[dayIndex];

    try {
      const raw =
        event.dataTransfer.getData('application/x-chronoblock-task') ||
        event.dataTransfer.getData('text/plain');
      if (!raw) {
        return;
      }

      const task = JSON.parse(raw) as Task;
      if (!task.id) {
        return;
      }

      const block = await convertTaskToTimeBlock(task.id, getDateFromMinute(droppedDay, minute));
      if (!block) {
        setMessage({ tone: 'error', text: '放置失败，这个时间段已经有冲突。' });
        return;
      }

      setSelectedBlockId(block.id);
      setMessage({ tone: 'success', text: '任务已转成时间块。' });
    } catch (error) {
      setMessage({ tone: 'error', text: '拖入任务失败。' });
    }
  };

  const handleTaskDragOver = (event: ReactDragEvent<HTMLDivElement>, dayIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';

    const rect = event.currentTarget.getBoundingClientRect();
    const minute = getMinuteFromRelativeY(event.clientY - rect.top);
    setDragOverState({ dayIndex, minute });
  };

  const handleTaskDragEnter = (event: ReactDragEvent<HTMLDivElement>, dayIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';

    const rect = event.currentTarget.getBoundingClientRect();
    const minute = getMinuteFromRelativeY(event.clientY - rect.top);
    setDragOverState({ dayIndex, minute });
  };

  const findPasteStart = (source: TimeBlock) => {
    const sourceStart = new Date(source.start_time);
    const sourceEnd = new Date(source.end_time);
    const duration = differenceInMinutes(sourceEnd, sourceStart);
    const targetBaseDay = startOfDay(selectedDate);
    let candidateMinute = minuteOfDay(sourceStart);

    while (candidateMinute + duration <= MINUTES_IN_DAY) {
      const candidateStart = getDateFromMinute(targetBaseDay, candidateMinute);
      const candidateEnd = addMinutes(candidateStart, duration);
      if (!checkTimeConflict(candidateStart, candidateEnd)) {
        return { start: candidateStart, end: candidateEnd };
      }
      candidateMinute += SLOT_MINUTES;
    }

    return null;
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      await deleteTimeBlock(blockId);
      if (selectedBlockId === blockId) {
        setSelectedBlockId(null);
      }
      setContextMenu(null);
    } catch (error) {
      setMessage({ tone: 'error', text: '删除时间块失败。' });
    }
  };

  const handlePasteBlock = async () => {
    if (!clipboardBlock) {
      return;
    }

    const slot = findPasteStart(clipboardBlock);
    if (!slot) {
      setMessage({ tone: 'error', text: '没有可用空位来粘贴这个时间块。' });
      return;
    }

    try {
      const duplicated = await addTimeBlock({
        title: `${clipboardBlock.title} (副本)`,
        start_time: slot.start.toISOString(),
        end_time: slot.end.toISOString(),
        color: clipboardBlock.color ?? '#2563eb',
        task_id: clipboardBlock.task_id ?? undefined,
        is_pomodoro: clipboardBlock.is_pomodoro,
      });
      setSelectedBlockId(duplicated.id);
      setMessage({ tone: 'success', text: '时间块已粘贴。' });
    } catch (error) {
      setMessage({ tone: 'error', text: '粘贴时间块失败。' });
    }
  };

  const handleContextCompletion = async (
    blockId: string,
    status: 'completed' | 'incomplete' | null
  ) => {
    try {
      await setTimeBlockCompletion(blockId, status);
      setContextMenu(null);
    } catch (error) {
      setMessage({ tone: 'error', text: '更新时间块状态失败。' });
    }
  };

  const handleCycleBlockCompletion = async (block: TimeBlock) => {
    const nextStatus =
      block.completion_status === null
        ? 'completed'
        : block.completion_status === 'completed'
          ? 'incomplete'
          : null;

    try {
      await setTimeBlockCompletion(block.id, nextStatus);
    } catch (error) {
      setMessage({ tone: 'error', text: '更新时间块状态失败。' });
    }
  };

  const handleSaveInlineEdit = async (blockId: string) => {
    const title = inlineEditValue.trim();
    if (!title) {
      setInlineEditingBlockId(null);
      setInlineEditValue('');
      return;
    }

    try {
      await updateTimeBlock(blockId, { title });
    } catch (error) {
      setMessage({ tone: 'error', text: '更新时间块标题失败。' });
    } finally {
      setInlineEditingBlockId(null);
      setInlineEditValue('');
    }
  };

  const handleAssignProject = async (blockId: string, projectId: string | null) => {
    try {
      await updateTimeBlock(blockId, { project_id: projectId });
      setMessage({
        tone: 'success',
        text: projectId ? '时间块已绑定项目。' : '已移除项目绑定。',
      });
    } catch (error) {
      setMessage({ tone: 'error', text: '更新时间块项目失败。' });
    }
  };

  const handleCreateProject = async (input: { name: string; path?: string; color?: string }) => {
    if (!projectPickerBlock) {
      return;
    }

    try {
      const project = await addProject(input);
      await handleAssignProject(projectPickerBlock.id, project.id);
      setProjectPickerBlockId(null);
    } catch (error) {
      setMessage({ tone: 'error', text: '创建项目失败。' });
    }
  };

  const renderCurrentTimeLine = (day: Date) => {
    if (!isToday(day)) {
      return null;
    }

    const top = (minuteOfDay(new Date()) / SLOT_MINUTES) * SLOT_HEIGHT;
    return (
      <div
        className="pointer-events-none absolute left-0 right-0 z-20 border-t border-red-500/80"
        style={{ top }}
      >
        <div className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
      </div>
    );
  };

  return (
    <div ref={layoutRef} className="relative flex h-full min-h-0 w-full min-w-0 flex-1 bg-background">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border/50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays size={14} />
            <span>{mode === 'day' ? '今天日程' : '本周日程'}</span>
          </div>
        </div>

        {message && (
          <div
            className={cn(
              'mx-4 mt-3 rounded-lg border px-3 py-2 text-sm',
              message.tone === 'error'
                ? 'border-red-200/70 bg-red-50/60 text-red-700 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-200'
                : 'border-emerald-200/70 bg-emerald-50/50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200'
            )}
          >
            {message.text}
          </div>
        )}

        <div className={cn('flex min-h-0 flex-1', mode === 'day' ? 'px-4 pb-4' : '')}>
          <div
            ref={mode === 'day' ? daySplitRef : undefined}
            className={cn(
              'flex min-h-0 min-w-0',
              mode === 'day' ? 'w-full items-stretch' : 'flex-1'
            )}
          >
            <div
              className={cn(
                'flex min-w-0 flex-col',
                mode === 'day' ? 'grow xl:grow-0 xl:shrink-0' : 'flex-1'
              )}
              style={
                mode === 'day' && isWideDayLayout
                  ? { width: `calc(${dayCalendarWidth}% - 12px)` }
                  : undefined
              }
            >
            <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
              <div className="pointer-events-none absolute left-0 top-1 z-20 w-[72px] pr-3 text-right text-xs font-medium text-muted-foreground">
                <span className="bg-background px-1.5 py-0.5">00:00</span>
              </div>
              <div className="pointer-events-none absolute bottom-3 left-0 z-20 w-[72px] pr-3 text-right text-xs font-medium text-muted-foreground">
                <span className="bg-background px-1.5 py-0.5">24:00</span>
              </div>
              
              <div
                className="grid min-w-max border-b border-border/50 sticky top-0 z-10 bg-background"
                style={{ gridTemplateColumns }}
              >
                <div className="border-r border-border/50 bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
                  时间
                </div>
                {visibleDays.map((day) => (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'border-r border-border/50 px-3 py-2 text-left transition-colors last:border-r-0',
                      isToday(day) ? 'bg-muted/[0.22]' : 'bg-background hover:bg-muted/[0.22]'
                    )}
                  >
                    <div className="text-xs text-muted-foreground">
                      {format(day, mode === 'day' ? 'EEEE' : 'EEE', { locale: zhCN })}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-medium',
                          isToday(day) && 'bg-foreground text-background'
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      <span className="text-sm font-medium text-foreground">{format(day, 'M月d日')}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div
                ref={gridBodyRef}
                className="grid min-w-max"
                style={{ gridTemplateColumns }}
              >
                <div className="relative border-r border-border/50 bg-background">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="relative border-b border-border/45 pr-3 text-right text-xs font-medium text-muted-foreground"
                      style={{ height: `${(60 / SLOT_MINUTES) * SLOT_HEIGHT}px` }}
                    >
                      {hour > 0 ? (
                        <div className="-translate-y-2 bg-background px-1.5 py-0.5">
                          {`${String(hour).padStart(2, '0')}:00`}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {visibleDays.map((day, dayIndex) => (
                  <div
                    key={day.toISOString()}
                    data-day-index={dayIndex}
                    data-day-column={dayIndex}
                    className={cn(
                      'relative border-r border-border/45 last:border-r-0',
                      isToday(day) && 'bg-muted/[0.14]'
                    )}
                    style={{ height: TOTAL_GRID_HEIGHT }}
                    onDragEnter={(event) => handleTaskDragEnter(event, dayIndex)}
                    onDragOver={(event) => handleTaskDragOver(event, dayIndex)}
                    onDragLeave={() => setDragOverState(null)}
                    onDrop={(event) => handleTaskDrop(event, dayIndex)}
                  >
                    {Array.from({ length: MINUTES_IN_DAY / SLOT_MINUTES }, (_, slotIndex) => (
                      <div
                        key={slotIndex}
                        data-slot-index={slotIndex}
                        className={cn(
                          'relative border-b transition-colors',
                          isHourSlot(slotIndex)
                            ? 'border-border/45 bg-transparent'
                            : isHalfHourSlot(slotIndex)
                              ? 'border-border/30 bg-transparent'
                              : 'border-dashed border-border/20'
                        )}
                        style={{ height: SLOT_HEIGHT }}
                        onDoubleClick={async (event) => {
                          event.preventDefault();
                          event.stopPropagation();

                          if (
                            document
                              .elementsFromPoint(event.clientX, event.clientY)
                              .some((element) => (element as HTMLElement).dataset.blockId)
                          ) {
                            return;
                          }

                          const minute = slotIndex * SLOT_MINUTES;
                          await createBlockAt(dayIndex, minute);
                        }}
                      >
                        {!isHourSlot(slotIndex) && isHalfHourSlot(slotIndex) ? (
                          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border/35" />
                        ) : null}
                      </div>
                    ))}

                    {dragOverState?.dayIndex === dayIndex && (
                      <div
                        className="pointer-events-none absolute left-0 right-0 z-10 border-t border-foreground/50"
                        style={{ top: (dragOverState.minute / SLOT_MINUTES) * SLOT_HEIGHT }}
                      >
                        <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border border-background bg-foreground/70" />
                        <div className="absolute right-2 -top-3 bg-background px-1.5 py-0.5 text-[10px] text-foreground">
                          {format(getDateFromMinute(day, dragOverState.minute), 'HH:mm')}
                        </div>
                      </div>
                    )}

                    {dragPreview?.dayIndex === dayIndex && (
                      <div
                        className={cn(
                          'pointer-events-none absolute left-2 right-2 z-10 rounded-xl border',
                          dragPreview.invalid ? 'border-red-400/60 bg-red-50/30' : 'border-foreground/20 bg-foreground/[0.04]'
                        )}
                        style={{
                          top: (dragPreview.startMinute / SLOT_MINUTES) * SLOT_HEIGHT,
                          height: ((dragPreview.endMinute - dragPreview.startMinute) / SLOT_MINUTES) * SLOT_HEIGHT,
                        }}
                      />
                    )}

                    {visibleBlocks.map((block) => {
                      const blockStart = new Date(block.start_time);
                      const blockEnd = new Date(block.end_time);
                      const dayStart = startOfDay(day);
                      const dayEnd = addDays(dayStart, 1);

                      if (!(blockStart < dayEnd && blockEnd > dayStart)) {
                        return null;
                      }

                      const segmentStart = maxDate([blockStart, dayStart]);
                      const segmentEnd = minDate([blockEnd, dayEnd]);
                      const startMinute = differenceInMinutes(segmentStart, dayStart);
                      const endMinute = differenceInMinutes(segmentEnd, dayStart);
                      const top = (startMinute / SLOT_MINUTES) * SLOT_HEIGHT;
                      const rawHeight = ((endMinute - startMinute) / SLOT_MINUTES) * SLOT_HEIGHT;
                      const height = Math.max(rawHeight, mode === 'week' ? 36 : 68);
                      const isSelected = selectedBlockId === block.id;
                      const isInlineEditing = inlineEditingBlockId === block.id;
                      const isCompactBlock = mode === 'week' || height < 84;
                      const palette = getTimeBlockPalette(block);
                      const project = projects.find((item) => item.id === block.project_id) ?? null;
                      const blockStyle = getBlockStyle(palette, block.completion_status, isSelected);

                      return (
                        <div
                          key={`${block.id}-${dayIndex}`}
                          data-block-id={block.id}
                          draggable={false}
                          className={cn(
                            'group absolute left-2 right-2 z-20 cursor-grab select-none overflow-hidden rounded-2xl border transition-colors active:cursor-grabbing',
                            isCompactBlock ? 'px-2 py-1.5' : 'p-2',
                            getBlockTone(palette, isSelected)
                          )}
                          style={{
                            top,
                            height,
                            ...blockStyle,
                          }}
                          onMouseDown={(event) => {
                            if (inlineEditingBlockId === block.id) {
                              return;
                            }
                            event.stopPropagation();
                            event.preventDefault();

                            setSelectedBlockId(block.id);
                            setPendingMove({
                              block,
                              originClientX: event.clientX,
                              originClientY: event.clientY,
                              originMinute: minuteOfDay(blockStart),
                              dayIndex,
                              minute: minuteOfDay(blockStart),
                            });
                          }}
                          onDragStart={(event) => {
                            event.preventDefault();
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelectedBlockId(block.id);
                            setContextMenu({
                              blockId: block.id,
                              x: event.clientX,
                              y: event.clientY,
                            });
                          }}
                          onDoubleClickCapture={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setPendingMove(null);
                            setActiveInteraction(null);
                            setDragPreview(null);
                            setDragOverState(null);
                          }}
                        >
                          <button
                            type="button"
                            className={cn(
                              'absolute right-2 top-2 inline-flex items-center justify-center rounded-full border transition-colors',
                              isCompactBlock ? 'h-[18px] w-[18px]' : 'h-5 w-5',
                              block.completion_status === 'completed' &&
                                'border-emerald-200 bg-background text-emerald-500 dark:border-emerald-800/70 dark:bg-slate-950 dark:text-emerald-300',
                              block.completion_status === 'incomplete' &&
                                'border-rose-200 bg-background text-rose-400 dark:border-rose-800/70 dark:bg-slate-950 dark:text-rose-300',
                              block.completion_status === null &&
                                'bg-background text-slate-600 hover:bg-muted dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-900'
                            )}
                            style={
                              block.completion_status === null
                                ? { borderColor: hexToRgba(palette.accent, 0.24) }
                                : undefined
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCycleBlockCompletion(block);
                            }}
                            aria-label="切换完成状态"
                            title={
                              block.completion_status === 'completed'
                                ? '已完成，点击切换为未完成'
                                : block.completion_status === 'incomplete'
                                  ? '未完成，点击重置状态'
                                  : '待处理，点击标记为已完成'
                            }
                          >
                            {block.completion_status === 'completed' ? (
                              <Check size={isCompactBlock ? 10 : 11} />
                            ) : block.completion_status === 'incomplete' ? (
                              <Frown size={isCompactBlock ? 10 : 11} />
                            ) : (
                              <Circle size={isCompactBlock ? 9 : 10} />
                            )}
                          </button>

                          <button
                            type="button"
                            className="absolute left-1/2 top-0 flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-all cursor-ns-resize group-hover:opacity-100"
                            onMouseDown={(event) => {
                              event.stopPropagation();
                              setSelectedBlockId(block.id);
                              setActiveInteraction({
                                type: 'resize-start',
                                block,
                                dayIndex,
                                minute: minuteOfDay(blockStart),
                              });
                            }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full border border-white/70 bg-slate-400/45 transition-all hover:scale-110 hover:bg-slate-500/55 dark:border-slate-200/60 dark:bg-slate-300/45" />
                          </button>
                          <button
                            type="button"
                            className="absolute bottom-0 left-1/2 flex h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-all cursor-ns-resize group-hover:opacity-100"
                            onMouseDown={(event) => {
                              event.stopPropagation();
                              setSelectedBlockId(block.id);
                              setActiveInteraction({
                                type: 'resize-end',
                                block,
                                dayIndex,
                                minute: minuteOfDay(blockEnd),
                              });
                            }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full border border-white/70 bg-slate-400/45 transition-all hover:scale-110 hover:bg-slate-500/55 dark:border-slate-200/60 dark:bg-slate-300/45" />
                          </button>

                          <div className={cn('flex items-start', isCompactBlock ? 'gap-1.5' : 'gap-2')}>
                            {!isCompactBlock && <GripVertical size={14} className="mt-0.5 shrink-0 opacity-50" />}
                            <div className="min-w-0 flex-1">
                              {isInlineEditing ? (
                                <input
                                  type="text"
                                  value={inlineEditValue}
                                  onChange={(event) => setInlineEditValue(event.target.value)}
                                  onBlur={() => handleSaveInlineEdit(block.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      void handleSaveInlineEdit(block.id);
                                    }

                                    if (event.key === 'Escape') {
                                      event.preventDefault();
                                      setInlineEditingBlockId(null);
                                      setInlineEditValue('');
                                    }
                                  }}
                                  className="w-full rounded-md border border-primary/20 bg-background px-2 py-1 text-sm font-semibold text-foreground outline-none ring-1 ring-primary/10"
                                  autoFocus
                                  onMouseDown={(event) => event.stopPropagation()}
                                />
                              ) : (
                                <div
                                  className={cn(
                                      'truncate font-medium tracking-[-0.01em]',
                                    block.completion_status === 'completed' &&
                                      'line-through decoration-2 decoration-current/70',
                                    isCompactBlock ? 'pr-5 text-xs leading-4' : 'pr-6 text-sm'
                                  )}
                                  style={{ color: palette.text }}
                                >
                                  {block.title}
                                </div>
                              )}
                              <div
                                className={cn(
                                    'flex items-center gap-1 text-slate-500/80 dark:text-slate-400',
                                  isCompactBlock ? 'mt-0.5 text-[10px] leading-4' : 'mt-1 text-[11px]'
                                )}
                                style={{ color: palette.mutedText }}
                              >
                                <Clock3 size={isCompactBlock ? 10 : 11} />
                                <span className="truncate">
                                  {format(segmentStart, 'HH:mm')} - {format(segmentEnd, 'HH:mm')}
                                </span>
                              </div>
                              {project || (isSelected && !isCompactBlock) ? (
                                <button
                                  type="button"
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setProjectPickerBlockId(block.id);
                                  }}
                                  className={cn(
                                     'mt-2 inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                                     project
                                       ? 'bg-background hover:bg-muted'
                                       : 'border-dashed bg-transparent hover:bg-muted/40'
                                  )}
                                  style={{
                                    borderColor: project
                                      ? hexToRgba(project.color ?? palette.accent, 0.34)
                                      : hexToRgba(palette.accent, 0.24),
                                    color: project ? project.color ?? palette.text : palette.mutedText,
                                  }}
                                  aria-label={project ? `项目 ${project.name}` : '绑定项目'}
                                  title={project ? project.path ?? project.name : '绑定项目'}
                                >
                                  <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: project?.color ?? palette.accent }}
                                  />
                                  <span className="truncate">{project?.name ?? '关联项目'}</span>
                                </button>
                              ) : null}
                              {isCompactBlock && (
                                <div
                                  className="mt-0.5 truncate text-[10px] leading-4 text-muted-foreground"
                                  style={{ color: palette.mutedText }}
                                >
                                  {formatDurationLabel(differenceInMinutes(segmentEnd, segmentStart))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {renderCurrentTimeLine(day)}
                  </div>
                ))}
              </div>
            </div>
          </div>

            {mode === 'day' ? (
              <div className="relative hidden w-6 shrink-0 xl:flex xl:items-center xl:justify-center">
                <button
                  type="button"
                  className={cn(
                    'group flex h-full w-full cursor-col-resize items-center justify-center',
                    isResizingDayPanels && 'cursor-col-resize'
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setIsResizingDayPanels(true);
                  }}
                  aria-label="调整时间块和番茄钟区域宽度"
                  title="拖动调整时间块和番茄钟区域宽度"
                >
                  <span className="absolute inset-y-6 left-1/2 w-px -translate-x-1/2 bg-slate-200/90 dark:bg-white/10" />
                  <span className="relative inline-flex h-14 w-4 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-all group-hover:border-slate-300 group-hover:shadow dark:border-white/10 dark:bg-slate-950 dark:group-hover:border-white/20">
                    <span className="h-6 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                  </span>
                </button>
              </div>
            ) : null}

            {mode === 'day' ? (
              <PomodoroPanel
                selectedBlock={selectedBlock}
                className="shrink-0"
                style={
                  isWideDayLayout ? { width: `calc(${100 - dayCalendarWidth}% - 12px)` } : undefined
                }
              />
            ) : null}
          </div>
        </div>

        {contextMenu && (
          <div
            data-context-menu
            className="fixed z-50 min-w-[180px] rounded-xl border border-border bg-background p-1 shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
              onClick={() => {
                const block = timeBlocks.find((item) => item.id === contextMenu.blockId) ?? null;
                if (!block) {
                  return;
                }
                setClipboardBlock(block);
                setContextMenu(null);
                setMessage({ tone: 'success', text: '已复制时间块。' });
              }}
            >
              <Copy size={14} />
              复制
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
              onClick={async () => {
                const block = timeBlocks.find((item) => item.id === contextMenu.blockId) ?? null;
                if (!block) {
                  return;
                }
                setClipboardBlock(block);
                setContextMenu(null);
                await handlePasteBlock();
              }}
            >
              <CalendarDays size={14} />
              复制并粘贴
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
              onClick={() => handleContextCompletion(contextMenu.blockId, 'completed')}
            >
              <Check size={14} />
              标记已完成
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
              onClick={() => handleContextCompletion(contextMenu.blockId, 'incomplete')}
            >
              <X size={14} />
              标记未完成
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
              onClick={() => handleContextCompletion(contextMenu.blockId, null)}
            >
              <RotateCcw size={14} />
              重置状态
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              onClick={() => handleDeleteBlock(contextMenu.blockId)}
            >
              <Trash2 size={14} />
              删除
            </button>
          </div>
        )}

        {draggingTask && dragPointer && (
          <div
            className="pointer-events-none fixed z-[60] w-56 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-primary/30 bg-background/95 px-4 py-3 shadow-2xl backdrop-blur"
            style={{ left: dragPointer.x, top: dragPointer.y }}
          >
            <div className="text-sm font-semibold text-foreground">{draggingTask.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              拖到日历时间网格里松手即可创建时间块
            </div>
          </div>
        )}

        <ProjectPickerDialog
          open={projectPickerBlock !== null}
          onOpenChange={(open) => {
            if (!open) {
              setProjectPickerBlockId(null);
            }
          }}
          projects={projects}
          selectedProjectId={projectPickerBlock?.project_id ?? null}
          onSelectProject={async (projectId) => {
            if (!projectPickerBlock) {
              return;
            }

            await handleAssignProject(projectPickerBlock.id, projectId);
            setProjectPickerBlockId(null);
          }}
          onCreateProject={handleCreateProject}
        />
      </section>

      {isTaskSidebarOpen ? (
        <div className="hidden shrink-0 lg:flex" style={{ width: taskSidebarWidth }}>
          <button
            type="button"
            className={cn(
              'group relative flex w-4 shrink-0 cursor-col-resize items-center justify-center bg-transparent',
              isResizingTaskSidebar && 'cursor-col-resize'
            )}
            onMouseDown={(event) => {
              event.preventDefault();
              setIsResizingTaskSidebar(true);
            }}
            aria-label="调整任务栏宽度"
            title="拖动调整任务栏宽度"
          >
            <span className="absolute inset-y-8 left-1/2 w-px -translate-x-1/2 bg-slate-200/80 dark:bg-white/10" />
            <span className="relative inline-flex h-10 w-3 items-center justify-center rounded-full border border-slate-200 bg-white/96 transition-all group-hover:border-slate-300 group-hover:bg-white dark:border-white/10 dark:bg-slate-950 dark:group-hover:border-white/20">
              <span className="h-4 w-[3px] rounded-full bg-slate-300 dark:bg-slate-600" />
            </span>
          </button>

          <div className="flex h-full min-w-0 flex-1 flex-col border-l border-border bg-background">
            <TaskList onCollapse={() => setIsTaskSidebarOpen(false)} />
          </div>
        </div>
      ) : (
        <div className="hidden h-full w-[56px] shrink-0 flex-col items-center gap-4 border-l border-border bg-background px-2 py-5 lg:flex">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={() => setIsTaskSidebarOpen(true)}
            aria-label="展开任务栏"
            title="展开任务栏"
          >
            <PanelLeftOpen size={17} />
          </Button>
          <div className="h-10 w-px bg-border/80" />
          <div className="-rotate-90 text-[10px] font-medium tracking-[0.24em] text-muted-foreground">
            TODAY
          </div>
        </div>
      )}
    </div>
  );
}
