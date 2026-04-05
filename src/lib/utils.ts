import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function hashString(value: string) {
  return Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getStartOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getEndOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day;
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const result = new Date(start);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// 检查时间块是否冲突
export function checkTimeConflict(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1;
}

// 颜色列表
export const COLORS = [
  '#334EAC', // royal
  '#F7F2EB', // moon
  '#7096D1', // china
  '#F2F0DE', // asian pear
  '#081F5C', // midnight
  '#D0E3FF', // dawn
  '#FFF9F0', // jicama
  '#EDF1F6', // porcelain
  '#BAD6EB', // sky
] as const;

export type TimeBlockPalette = {
  accent: string;
  surface: string;
  border: string;
  text: string;
  mutedText: string;
  glow: string;
};

export const TIME_BLOCK_PALETTES: readonly TimeBlockPalette[] = [
  {
    accent: '#4F7CFF',
    surface: 'rgba(79, 124, 255, 0.22)',
    border: 'rgba(79, 124, 255, 0.44)',
    text: '#173272',
    mutedText: '#31509A',
    glow: 'rgba(79, 124, 255, 0.16)',
  },
  {
    accent: '#FF8FA3',
    surface: 'rgba(255, 143, 163, 0.22)',
    border: 'rgba(255, 143, 163, 0.42)',
    text: '#7B2640',
    mutedText: '#9B4860',
    glow: 'rgba(255, 143, 163, 0.15)',
  },
  {
    accent: '#49B6A5',
    surface: 'rgba(73, 182, 165, 0.22)',
    border: 'rgba(73, 182, 165, 0.40)',
    text: '#0F5C53',
    mutedText: '#2B7D73',
    glow: 'rgba(73, 182, 165, 0.14)',
  },
  {
    accent: '#FFC85C',
    surface: 'rgba(255, 200, 92, 0.24)',
    border: 'rgba(255, 200, 92, 0.44)',
    text: '#7A4A00',
    mutedText: '#9B6712',
    glow: 'rgba(255, 200, 92, 0.16)',
  },
  {
    accent: '#8C6BFF',
    surface: 'rgba(140, 107, 255, 0.22)',
    border: 'rgba(140, 107, 255, 0.42)',
    text: '#40278E',
    mutedText: '#5B43AC',
    glow: 'rgba(140, 107, 255, 0.16)',
  },
  {
    accent: '#63C7FF',
    surface: 'rgba(99, 199, 255, 0.22)',
    border: 'rgba(99, 199, 255, 0.42)',
    text: '#0C5B86',
    mutedText: '#2E7DA8',
    glow: 'rgba(99, 199, 255, 0.16)',
  },
  {
    accent: '#FF9E7A',
    surface: 'rgba(255, 158, 122, 0.22)',
    border: 'rgba(255, 158, 122, 0.42)',
    text: '#7A3820',
    mutedText: '#9A553A',
    glow: 'rgba(255, 158, 122, 0.15)',
  },
  {
    accent: '#7CD992',
    surface: 'rgba(124, 217, 146, 0.22)',
    border: 'rgba(124, 217, 146, 0.40)',
    text: '#1F6B34',
    mutedText: '#3C8A50',
    glow: 'rgba(124, 217, 146, 0.15)',
  },
  {
    accent: '#5FD6C2',
    surface: 'rgba(95, 214, 194, 0.22)',
    border: 'rgba(95, 214, 194, 0.40)',
    text: '#0F6158',
    mutedText: '#2E8076',
    glow: 'rgba(95, 214, 194, 0.15)',
  },
] as const;

export function getTimeBlockPalette(seed: { id?: string | null; title?: string | null; color?: string | null }) {
  if (seed.color) {
    return {
      accent: seed.color,
      surface: hexToRgba(seed.color, 0.22),
      border: hexToRgba(seed.color, 0.42),
      text: '#1f2937',
      mutedText: '#475569',
      glow: hexToRgba(seed.color, 0.14),
    } satisfies TimeBlockPalette;
  }

  const hashSeed = `${seed.id ?? ''}-${seed.title ?? ''}`;
  const index = hashString(hashSeed) % TIME_BLOCK_PALETTES.length;
  return TIME_BLOCK_PALETTES[index];
}
