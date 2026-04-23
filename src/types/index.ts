// 任务类型
export interface Task {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  color: string | null;
  tags?: string[];
  estimated_duration: number | null;
  deleted?: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  path: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

// 时间块类型
export interface TimeBlock {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  color: string | null;
  editable: boolean;
  completion_status: 'completed' | 'incomplete' | null;
  is_pomodoro: boolean;
  task_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

// 视图类型
export type ViewType = 'day' | 'week' | 'month';

// 主题类型
export type Theme = 'light' | 'dark' | 'system';

// 创建任务输入
export interface CreateTaskInput {
  title: string;
  description?: string;
  color?: string;
  tags?: string[];
  estimated_duration?: number;
}

// 更新任务输入
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  completed?: boolean;
  color?: string;
  tags?: string[];
  estimated_duration?: number;
}

// 创建时间块输入
export interface CreateTimeBlockInput {
  title: string;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  color?: string;
  task_id?: string;
  project_id?: string;
  is_pomodoro?: boolean;
}

// 更新时间块输入
export interface UpdateTimeBlockInput {
  title?: string;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  color?: string;
  completion_status?: 'completed' | 'incomplete' | null;
  clear_completion_status?: boolean;
  task_id?: string | null;
  project_id?: string | null;
}

export interface CreateProjectInput {
  name: string;
  path?: string;
  color?: string;
}

export interface UpdateProjectInput {
  name?: string;
  path?: string | null;
  color?: string | null;
}
