import { useMemo, useState } from 'react';
import { FolderOpen, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn, COLORS, hexToRgba } from '@/lib/utils';
import type { Project } from '@/types';

type ProjectPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => Promise<void>;
  onCreateProject: (input: { name: string; path?: string; color?: string }) => Promise<void>;
};

export function ProjectPickerDialog({
  open,
  onOpenChange,
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
}: ProjectPickerDialogProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextColor = useMemo(() => COLORS[projects.length % COLORS.length], [projects.length]);

  const handleCreateProject = async () => {
    const normalizedName = name.trim();
    const normalizedPath = path.trim();
    if (!normalizedName) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateProject({
        name: normalizedName,
        path: normalizedPath || undefined,
        color: nextColor,
      });
      setName('');
      setPath('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>绑定项目</DialogTitle>
          <DialogDescription>把这段时间和一个项目绑在一起，切换时更不容易乱。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                void onSelectProject(null);
                onOpenChange(false);
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors',
                selectedProjectId === null
                  ? 'border-slate-300 bg-slate-50'
                  : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <div>
                <div className="text-sm font-medium text-slate-900">不绑定项目</div>
                <div className="mt-1 text-xs text-slate-500">保持这个时间块干净简洁。</div>
              </div>
            </button>

            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  void onSelectProject(project.id);
                  onOpenChange(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors',
                  selectedProjectId === project.id
                    ? 'border-slate-300 bg-slate-50'
                    : 'border-slate-200 hover:bg-slate-50'
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: project.color ?? nextColor }}
                    />
                    <div className="truncate text-sm font-medium text-slate-900">{project.name}</div>
                  </div>
                  {project.path ? (
                    <div className="mt-1 truncate text-xs text-slate-500">{project.path}</div>
                  ) : null}
                </div>
                <FolderOpen size={15} className="shrink-0 text-slate-400" />
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-dashed border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-900">新建项目</div>
            <div className="mt-1 text-xs text-slate-500">只填项目名也可以，路径可以之后再补。</div>
            <div className="mt-3 space-y-2">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如 ChronoBlock"
              />
              <Input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="例如 D:\\timeblock-bolt"
              />
              <Button
                type="button"
                onClick={() => void handleCreateProject()}
                disabled={isSubmitting || !name.trim()}
                className="w-full rounded-xl"
                style={{
                  backgroundColor: nextColor,
                  color: hexToRgba('#0f172a', 0.92),
                }}
              >
                <Plus size={14} className="mr-2" />
                新建并绑定
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
