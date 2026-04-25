import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChevronDown, ChevronUp, ListTodo } from 'lucide-react';
import type { Task } from '@/types';
import { cn } from '@/lib/utils';

export type TaskProgressDimension = 'all' | 'today' | 'week' | 'byColor';

type TaskProgressData = {
  name: string;
  value: number;
  color: string;
};

type TaskProgressPieProps = {
  tasks: Task[];
  dimension?: TaskProgressDimension;
  onDimensionChange?: (dimension: TaskProgressDimension) => void;
};

const COLORS = {
  completed: 'hsl(221.2 83.2% 53.3%)',
  incomplete: 'hsl(210 40% 96.1%)',
  completedDark: 'hsl(217.2 91.2% 59.8%)',
  incompleteDark: 'hsl(217.2 32.6% 17.5%)',
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }> }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-md">
        <p className="font-medium text-foreground">
          {payload[0].name}: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

export function TaskProgressPie({ tasks, dimension = 'all' }: TaskProgressPieProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const progressData = useMemo<TaskProgressData[]>(() => {
    if (tasks.length === 0) {
      return [];
    }

    switch (dimension) {
      case 'all':
      default: {
        const completed = tasks.filter((t) => t.completed).length;
        const incomplete = tasks.length - completed;

        const data: TaskProgressData[] = [];
        if (completed > 0) {
          data.push({ name: '已完成', value: completed, color: COLORS.completed });
        }
        if (incomplete > 0) {
          data.push({ name: '未完成', value: incomplete, color: COLORS.incomplete });
        }
        return data;
      }
    }
  }, [tasks, dimension]);

  const completionRate = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter((t) => t.completed).length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border/30">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-6 py-3 text-xs text-muted-foreground/70 transition-colors hover:bg-muted/10"
        aria-label={isExpanded ? '收起进度统计' : '展开进度统计'}
      >
        <div className="flex items-center gap-2">
          <ListTodo size={12} />
          <span className="font-medium text-foreground/80">任务进度</span>
          <span className="text-[11px] text-muted-foreground/50">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-primary">
            {completionRate}%
          </span>
          {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </div>
      </button>

      {isExpanded ? (
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="relative h-16 w-16">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={progressData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={28}
                    innerRadius={20}
                    paddingAngle={1}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {progressData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span
                  className={cn(
                    'text-xs font-semibold',
                    completionRate >= 80 ? 'text-emerald-500' : completionRate >= 50 ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {completionRate}%
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: COLORS.completed }} />
                <span className="text-muted-foreground/70">
                  已完成: <span className="font-medium text-foreground/70">{completedCount}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: COLORS.incomplete }} />
                <span className="text-muted-foreground/70">
                  未完成: <span className="font-medium text-foreground/70">{totalCount - completedCount}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${completionRate}%`,
                  backgroundColor: COLORS.completed,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
