import { useState, useEffect, useRef } from 'react';
import type { TimeBlock } from '@/types';

interface TimeBlockEditorProps {
  timeBlock: TimeBlock;
  onSave: (timeBlock: TimeBlock) => void;
  onCancel: () => void;
  position: { top: number; left: number };
}

export function TimeBlockEditor({
  timeBlock,
  onSave,
  onCancel,
  position,
}: TimeBlockEditorProps) {
  const [title, setTitle] = useState(timeBlock.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when the component mounts
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }

    // Add event listener to handle clicks outside the editor
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = () => {
    onSave({
      ...timeBlock,
      title,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="absolute z-50 bg-background shadow-md rounded border border-border p-2"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        className="w-full p-1 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-background"
      />
    </div>
  );
}