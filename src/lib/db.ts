import { invoke } from '@tauri-apps/api/core';
import type {
  Task,
  TimeBlock,
  Project,
  CreateTaskInput,
  UpdateTaskInput,
  CreateTimeBlockInput,
  UpdateTimeBlockInput,
  CreateProjectInput,
} from '@/types';

// ==================== Task API ====================

export const taskApi = {
  async getAll(): Promise<Task[]> {
    return invoke<Task[]>('get_tasks');
  },

  async getDeleted(): Promise<Task[]> {
    return invoke<Task[]>('get_deleted_tasks');
  },

  async getById(id: string): Promise<Task | null> {
    return invoke<Task | null>('get_task', { id });
  },

  async create(input: CreateTaskInput): Promise<Task> {
    return invoke<Task>('create_task', { input });
  },

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    return invoke<Task>('update_task', { id, input });
  },

  async softDelete(id: string): Promise<void> {
    return invoke('soft_delete_task', { id });
  },

  async restore(id: string): Promise<void> {
    return invoke('restore_task', { id });
  },

  async permanentDelete(id: string): Promise<void> {
    return invoke('permanent_delete_task', { id });
  },

  async delete(id: string): Promise<void> {
    return invoke('soft_delete_task', { id });
  },
};

// ==================== TimeBlock API ====================

export const timeBlockApi = {
  async getAll(startDate?: string, endDate?: string): Promise<TimeBlock[]> {
    return invoke<TimeBlock[]>('get_time_blocks', {
      start_date: startDate,
      end_date: endDate,
    });
  },

  async getById(id: string): Promise<TimeBlock | null> {
    return invoke<TimeBlock | null>('get_time_block', { id });
  },

  async create(input: CreateTimeBlockInput): Promise<TimeBlock> {
    return invoke<TimeBlock>('create_time_block', { input });
  },

  async update(id: string, input: UpdateTimeBlockInput): Promise<TimeBlock> {
    return invoke<TimeBlock>('update_time_block', { id, input });
  },

  async delete(id: string): Promise<void> {
    return invoke('delete_time_block', { id });
  },
};

export const projectApi = {
  async getAll(): Promise<Project[]> {
    return invoke<Project[]>('get_projects');
  },

  async create(input: CreateProjectInput): Promise<Project> {
    return invoke<Project>('create_project', { input });
  },
};

// ==================== Notification API ====================

export const notificationApi = {
  async show(title: string, body: string): Promise<void> {
    return invoke('show_notification', { title, body });
  },
};
