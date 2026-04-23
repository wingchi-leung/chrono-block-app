import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { projectApi, taskApi, timeBlockApi } from '@/lib/db';
import type {
  Task,
  TimeBlock,
  Project,
  ViewType,
  Theme,
  CreateTaskInput,
  CreateTimeBlockInput,
  CreateProjectInput,
} from '@/types';
import { areIntervalsOverlapping, addMinutes } from 'date-fns';

interface AppState {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;

  theme: Theme;
  setTheme: (theme: Theme) => void;

  selectedDate: Date;
  setSelectedDate: (date: Date) => void;

  tasks: Task[];
  deletedTasks: Task[];
  setTasks: (tasks: Task[]) => void;
  setDeletedTasks: (tasks: Task[]) => void;
  loadTasks: () => Promise<void>;
  loadDeletedTasks: () => Promise<void>;
  addTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  softDeleteTask: (id: string) => Promise<void>;
  restoreTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskCompletion: (id: string) => Promise<void>;

  projects: Project[];
  setProjects: (projects: Project[]) => void;
  loadProjects: () => Promise<void>;
  addProject: (input: CreateProjectInput) => Promise<Project>;

  timeBlocks: TimeBlock[];
  setTimeBlocks: (blocks: TimeBlock[]) => void;
  loadTimeBlocks: (startDate?: string, endDate?: string) => Promise<void>;
  addTimeBlock: (input: CreateTimeBlockInput) => Promise<TimeBlock>;
  updateTimeBlock: (id: string, updates: Partial<TimeBlock>) => Promise<void>;
  deleteTimeBlock: (id: string) => Promise<void>;
  checkTimeConflict: (start: Date, end: Date, excludeId?: string) => boolean;
  convertTaskToTimeBlock: (taskId: string, start: Date) => Promise<TimeBlock | null>;
  setTimeBlockCompletion: (
    id: string,
    status: 'completed' | 'incomplete' | null
  ) => Promise<void>;

  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  draggingTask: Task | null;
  setDraggingTask: (task: Task | null) => void;
  dragPointer: { x: number; y: number } | null;
  setDragPointer: (pointer: { x: number; y: number } | null) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentView: 'day',
      setCurrentView: (currentView) => set({ currentView }),

      theme: 'system',
      setTheme: (theme) => set({ theme }),

      selectedDate: new Date(),
      setSelectedDate: (selectedDate) => set({ selectedDate }),

      tasks: [],
      deletedTasks: [],
      setTasks: (tasks) => set({ tasks }),
      setDeletedTasks: (deletedTasks) => set({ deletedTasks }),
      loadTasks: async () => {
        try {
          set({ isLoading: true, error: null });
          const tasks = await taskApi.getAll();
          set({ tasks, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
        }
      },
      loadDeletedTasks: async () => {
        try {
          set({ isLoading: true, error: null });
          const deletedTasks = await taskApi.getDeleted();
          set({ deletedTasks, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
        }
      },
      addTask: async (input) => {
        const task = await taskApi.create(input);
        set((state) => ({ tasks: [...state.tasks, task] }));
        return task;
      },
      updateTask: async (id, updates) => {
        const updated = await taskApi.update(id, {
          title: updates.title,
          description: updates.description ?? undefined,
          completed: updates.completed,
          color: updates.color ?? undefined,
          tags: updates.tags ?? undefined,
          estimated_duration: updates.estimated_duration ?? undefined,
        });
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
        }));
      },
      softDeleteTask: async (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (task) {
          set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== id),
            deletedTasks: [...state.deletedTasks, { ...task, deleted: true, deleted_at: new Date().toISOString() }],
          }));
        }
        try {
          await taskApi.softDelete(id);
        } catch (error) {
          if (task) {
            set((state) => ({
              tasks: [...state.tasks, task],
              deletedTasks: state.deletedTasks.filter((t) => t.id !== id),
            }));
          }
          throw error;
        }
      },
      restoreTask: async (id) => {
        const task = get().deletedTasks.find((t) => t.id === id);
        if (task) {
          set((state) => ({
            deletedTasks: state.deletedTasks.filter((t) => t.id !== id),
            tasks: [...state.tasks, { ...task, deleted: false, deleted_at: null }],
          }));
        }
        try {
          await taskApi.restore(id);
        } catch (error) {
          if (task) {
            set((state) => ({
              deletedTasks: [...state.deletedTasks, task],
              tasks: state.tasks.filter((t) => t.id !== id),
            }));
          }
          throw error;
        }
      },
      deleteTask: async (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (task) {
          set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== id),
          }));
        }
        try {
          await taskApi.softDelete(id);
        } catch (error) {
          if (task) {
            set((state) => ({
              tasks: [...state.tasks, task],
            }));
          }
          throw error;
        }
      },
      toggleTaskCompletion: async (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;

        const newCompletedStatus = !task.completed;

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, completed: newCompletedStatus } : t
          ),
        }));

        try {
          const updated = await taskApi.update(id, {
            completed: newCompletedStatus,
          });
          set((state) => ({
            tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
          }));
        } catch (error) {
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === id ? { ...t, completed: task.completed } : t
            ),
          }));
          throw error;
        }
      },

      projects: [],
      setProjects: (projects) => set({ projects }),
      loadProjects: async () => {
        try {
          set({ isLoading: true, error: null });
          const projects = await projectApi.getAll();
          set({ projects, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
        }
      },
      addProject: async (input) => {
        const project = await projectApi.create(input);
        set((state) => ({ projects: [project, ...state.projects] }));
        return project;
      },

      timeBlocks: [],
      setTimeBlocks: (timeBlocks) => set({ timeBlocks }),
      loadTimeBlocks: async (startDate, endDate) => {
        try {
          set({ isLoading: true, error: null });
          const blocks = await timeBlockApi.getAll(startDate, endDate);
          set({ timeBlocks: blocks, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
        }
      },
      addTimeBlock: async (input) => {
        const block = await timeBlockApi.create(input);
        set((state) => ({ timeBlocks: [...state.timeBlocks, block] }));
        return block;
      },
      updateTimeBlock: async (id, updates) => {
        const updated = await timeBlockApi.update(id, {
          title: updates.title,
          start_time: updates.start_time,
          end_time: updates.end_time,
          all_day: updates.all_day,
          color: updates.color ?? undefined,
          completion_status: updates.completion_status ?? undefined,
          clear_completion_status: updates.completion_status === null ? true : undefined,
          task_id: updates.task_id ?? undefined,
          project_id: updates.project_id ?? undefined,
        });
        set((state) => ({
          timeBlocks: state.timeBlocks.map((b) => (b.id === id ? updated : b)),
        }));
      },
      deleteTimeBlock: async (id) => {
        await timeBlockApi.delete(id);
        set((state) => ({
          timeBlocks: state.timeBlocks.filter((b) => b.id !== id),
        }));
      },
      checkTimeConflict: (start: Date, end: Date, excludeId?: string) => {
        const { timeBlocks } = get();

        const conflicting = timeBlocks.find((block) => {
          if (excludeId && block.id === excludeId) return false;

          return areIntervalsOverlapping(
            { start: new Date(block.start_time), end: new Date(block.end_time) },
            { start, end },
            { inclusive: false }
          );
        });

        if (conflicting) {
          console.warn('[checkTimeConflict] 冲突块:', {
            conflictingBlock: { id: conflicting.id, title: conflicting.title, start_time: conflicting.start_time, end_time: conflicting.end_time },
            checking: { start: start.toISOString(), end: end.toISOString() },
            totalBlocksInStore: timeBlocks.length,
          });
        }

        return !!conflicting;
      },
      convertTaskToTimeBlock: async (taskId: string, start: Date) => {
        const { tasks, checkTimeConflict } = get();
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return null;

        const duration = task.estimated_duration || 30;
        const end = addMinutes(start, duration);

        if (checkTimeConflict(start, end)) {
          return null;
        }

        try {
          const newBlock = await timeBlockApi.create({
            title: task.title,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            color: task.color || undefined,
            task_id: taskId,
          });

          set((state) => ({
            timeBlocks: [...state.timeBlocks, newBlock],
          }));

          return newBlock;
        } catch (error) {
          console.error('Error converting task to time block:', error);
          return null;
        }
      },
      setTimeBlockCompletion: async (id, status) => {
        const existing = get().timeBlocks.find((block) => block.id === id);
        if (!existing) {
          return;
        }

        set((state) => ({
          timeBlocks: state.timeBlocks.map((block) =>
            block.id === id ? { ...block, completion_status: status } : block
          ),
        }));

        try {
          const updated = await timeBlockApi.update(id, {
            completion_status: status,
            clear_completion_status: status === null ? true : undefined,
          });

          set((state) => ({
            timeBlocks: state.timeBlocks.map((block) =>
              block.id === id ? updated : block
            ),
          }));
        } catch (error) {
          set((state) => ({
            timeBlocks: state.timeBlocks.map((block) =>
              block.id === id ? existing : block
            ),
          }));
          throw error;
        }
      },

      isLoading: false,
      setIsLoading: (isLoading) => set({ isLoading }),
      error: null,
      setError: (error) => set({ error }),
      draggingTask: null,
      setDraggingTask: (draggingTask) => set({ draggingTask }),
      dragPointer: null,
      setDragPointer: (dragPointer) => set({ dragPointer }),
    }),
    {
      name: 'chronoblock-storage',
      partialize: (state) => ({
        theme: state.theme,
        currentView: state.currentView,
      }),
    }
  )
);
