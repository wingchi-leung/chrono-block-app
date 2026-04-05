import { useState, useEffect } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { Clock, Edit, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';
import type { TimeBlock } from '@/types';
import { getTimeBlockPalette } from '@/lib/utils';
import { TimeBlockEditor } from './time-block-editor';

interface TimeBlockListProps {
  selectedDate: Date;
}

export function TimeBlockList({ selectedDate }: TimeBlockListProps) {
  const {
    timeBlocks,
    loadTimeBlocks,
    addTimeBlock,
    updateTimeBlock,
    deleteTimeBlock,
    checkTimeConflict,
  } = useStore();
  const [editingTimeBlock, setEditingTimeBlock] = useState<TimeBlock | null>(null);
  const [editorPosition, setEditorPosition] = useState({ top: 0, left: 0 });
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  useEffect(() => {
    loadTimeBlocks();
  }, [loadTimeBlocks]);

  // Filter time blocks for the selected day
  const dailyTimeBlocks = timeBlocks
    .filter((block) => {
      const blockDate = new Date(block.start_time);
      return (
        blockDate.getFullYear() === selectedDate.getFullYear() &&
        blockDate.getMonth() === selectedDate.getMonth() &&
        blockDate.getDate() === selectedDate.getDate()
      );
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const handleAddTimeBlock = async () => {
    // Create a new time block at 9am on the selected day with 30 minutes duration
    const date = new Date(selectedDate);
    date.setHours(9, 0, 0, 0);

    // Check for conflicts before creating
    const endTime = new Date(date);
    endTime.setMinutes(date.getMinutes() + 30); // 30 minutes default

    if (checkTimeConflict(date, endTime)) {
      setConflictMessage('Cannot create time block: 9:00 AM slot is already occupied');
      setTimeout(() => setConflictMessage(null), 3000);
      return;
    }

    try {
      await addTimeBlock({
        title: 'New Time Block',
        start_time: date.toISOString(),
        end_time: endTime.toISOString(),
      });
    } catch (error) {
      setConflictMessage('Failed to create time block');
      setTimeout(() => setConflictMessage(null), 3000);
    }
  };

  const handleEditTimeBlock = (timeBlock: TimeBlock, e: React.MouseEvent) => {
    setEditingTimeBlock(timeBlock);

    setEditorPosition({
      top: e.clientY,
      left: e.clientX,
    });
  };

  const handleSaveTimeBlock = async (updatedTimeBlock: TimeBlock) => {
    try {
      await updateTimeBlock(updatedTimeBlock.id, {
        title: updatedTimeBlock.title,
      });
      setEditingTimeBlock(null);
    } catch (error) {
      setConflictMessage('Failed to update time block');
      setTimeout(() => setConflictMessage(null), 3000);
    }
  };

  const handleDeleteTimeBlock = async (id: string) => {
    try {
      await deleteTimeBlock(id);
    } catch (error) {
      setConflictMessage('Failed to delete time block');
      setTimeout(() => setConflictMessage(null), 3000);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden border-r border-border">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <Clock size={16} className="text-muted-foreground" />
          Time Blocks
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddTimeBlock}
          className="h-8 px-2 flex items-center gap-1"
        >
          <Plus size={14} />
          <span>Add</span>
        </Button>
      </div>

      {/* Conflict Message */}
      {conflictMessage && (
        <div className="mx-4 mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle size={16} />
          {conflictMessage}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {dailyTimeBlocks.length === 0 ? (
          <div className="h-full flex items-center justify-center flex-col gap-2 p-4 text-muted-foreground">
            <p className="text-center text-sm">No time blocks for this day</p>
            <Button variant="outline" size="sm" onClick={handleAddTimeBlock} className="mt-2">
              Create a Time Block
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {dailyTimeBlocks.map((timeBlock) => {
              const startTime = new Date(timeBlock.start_time);
              const endTime = new Date(timeBlock.end_time);
              const duration = differenceInMinutes(endTime, startTime);
              const palette = getTimeBlockPalette(timeBlock);

              return (
                <div
                  key={timeBlock.id}
                  className="group cursor-pointer rounded-md border p-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
                  style={{
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderLeftColor: palette.accent,
                    borderLeftWidth: '4px',
                    boxShadow: `3px 3px 0 ${palette.glow}`,
                  }}
                  onDoubleClick={(e) => handleEditTimeBlock(timeBlock, e)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold" style={{ color: palette.text }}>{timeBlock.title}</p>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTimeBlock(timeBlock, e);
                        }}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTimeBlock(timeBlock.id);
                        }}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center font-mono text-xs" style={{ color: palette.mutedText }}>
                    <span>{format(startTime, 'HH:mm')}</span>
                    <span className="mx-1">-</span>
                    <span>{format(endTime, 'HH:mm')}</span>
                    <span className="ml-auto">{duration} min</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingTimeBlock && (
        <TimeBlockEditor
          timeBlock={editingTimeBlock}
          onSave={handleSaveTimeBlock}
          onCancel={() => setEditingTimeBlock(null)}
          position={editorPosition}
        />
      )}
    </div>
  );
}
