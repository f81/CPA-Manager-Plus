import type { ResolvedTheme } from '@/types';

export type DataPalette = {
  blue: string;
  emerald: string;
  green: string;
  amber: string;
  red: string;
  violet: string;
  cyan: string;
  teal: string;
  slate: string;
  slateMuted: string;
  healthWarn: string;
  surface: {
    axisLabel: string;
    axisLine: string;
    axisPointer: string;
    splitLine: string;
    tooltipBackground: string;
    tooltipBorder: string;
    tooltipMuted: string;
    tooltipShadow: string;
    tooltipText: string;
  };
};

// Canvas charts cannot read CSS variables, so these mirror themes.scss literally.
// `blue` is the cool end of the data palette (an indigo, not the former UI blue);
// the brand accent is intentionally not part of the categorical data palette.
export const lightDataPalette: DataPalette = {
  blue: '#6366f1',
  emerald: '#10b981',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  teal: '#14b8a6',
  slate: '#64748b',
  slateMuted: '#94a3b8',
  healthWarn: '#65a30d',
  surface: {
    axisLabel: '#737373',
    axisLine: '#e5e5e5',
    axisPointer: '#a3a3a3',
    splitLine: '#f0f0f0',
    tooltipBackground: 'rgba(255,255,255,0.98)',
    tooltipBorder: '#e5e5e5',
    tooltipMuted: '#737373',
    tooltipShadow: 'box-shadow: 0 8px 24px rgba(10,10,10,0.1);',
    tooltipText: '#0a0a0a',
  },
};

export const darkDataPalette: DataPalette = {
  blue: '#818cf8',
  emerald: '#34d399',
  green: '#4ade80',
  amber: '#fbbf24',
  red: '#f87171',
  violet: '#a78bfa',
  cyan: '#22d3ee',
  teal: '#2dd4bf',
  slate: '#94a3b8',
  slateMuted: '#64748b',
  healthWarn: '#bef264',
  surface: {
    axisLabel: '#a3a3a3',
    axisLine: 'rgba(255,255,255,0.1)',
    axisPointer: '#8a8a8a',
    splitLine: 'rgba(255,255,255,0.08)',
    tooltipBackground: 'rgba(20,20,20,0.98)',
    tooltipBorder: 'rgba(255,255,255,0.12)',
    tooltipMuted: '#a3a3a3',
    tooltipShadow: 'box-shadow: 0 8px 24px rgba(0,0,0,0.5);',
    tooltipText: '#fafafa',
  },
};

export const getDataPalette = (resolvedTheme: ResolvedTheme): DataPalette =>
  resolvedTheme === 'dark' ? darkDataPalette : lightDataPalette;

export const hexToRgba = (color: string, alpha: number): string => {
  const match = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!match) return color;
  const [, r, g, b] = match;
  return `rgba(${Number.parseInt(r, 16)},${Number.parseInt(g, 16)},${Number.parseInt(b, 16)},${alpha})`;
};
