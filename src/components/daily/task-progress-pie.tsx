import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChevronDown, ChevronUp, ListTodo } from 'lucide-react';
import type { Task } from '@/types';

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

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.1) return null;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
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
    <div className="border-t border-border/60">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-5 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/20"
        aria-label={isExpanded ? '收起进度统计' : '展开进度统计'}
      >
        <div className="flex items-center gap-2">
          <ListTodo size={14} />
          <span className="font-medium text-foreground">任务进度</span>
          <span className="text-xs">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: COLORS.completed }}>
            {completionRate}%
          </span>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </button>

      {isExpanded ? (
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="h-20 w-20">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={progressData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={35}
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
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.completed }} />
                <span className="text-muted-foreground">
                  已完成: <span className="font-medium text-foreground">{completedCount}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.incomplete }} />
                <span className="text-muted-foreground">
                  未完成: <span className="font-medium text-foreground">{totalCount - completedCount}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: COLORS.incomplete }}>
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
