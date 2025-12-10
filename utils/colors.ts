
import { TeamColor } from '../types';

interface ColorTheme {
    text: string;           // Base text color
    textDark: string;       // Dark mode text color
    bg: string;             // Light background (pills, badges)
    bgDark: string;         // Dark mode background
    border: string;         // Border color
    halo: string;           // The blurred circle behind numbers
    glow: string;           // Text/Box shadow glow
    crown: string;          // Icon color (Winner crown)
    ring: string;           // Focus rings
    gradient: string;       // Subtle gradient for cards
    solid: string;          // Solid color for pickers/dots
}

export const TEAM_COLORS: Record<string, ColorTheme> = {
    indigo: {
        text: 'text-indigo-800',
        textDark: 'dark:text-indigo-300',
        bg: 'bg-indigo-500/20',
        bgDark: 'dark:bg-indigo-500/20',
        border: 'border-indigo-500/40',
        halo: 'bg-indigo-500',
        glow: 'shadow-[0_0_15px_rgba(99,102,241,0.5)]',
        crown: 'text-indigo-500',
        ring: 'ring-indigo-500',
        gradient: 'from-indigo-500/15 to-transparent',
        solid: 'bg-indigo-500'
    },
    rose: {
        text: 'text-rose-800',
        textDark: 'dark:text-rose-300',
        bg: 'bg-rose-500/20',
        bgDark: 'dark:bg-rose-500/20',
        border: 'border-rose-500/40',
        halo: 'bg-rose-500',
        glow: 'shadow-[0_0_15px_rgba(244,63,94,0.5)]',
        crown: 'text-rose-500',
        ring: 'ring-rose-500',
        gradient: 'from-rose-500/15 to-transparent',
        solid: 'bg-rose-500'
    },
    emerald: {
        text: 'text-emerald-800',
        textDark: 'dark:text-emerald-300',
        bg: 'bg-emerald-500/20',
        bgDark: 'dark:bg-emerald-500/20',
        border: 'border-emerald-500/40',
        halo: 'bg-emerald-500',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.5)]',
        crown: 'text-emerald-500',
        ring: 'ring-emerald-500',
        gradient: 'from-emerald-500/15 to-transparent',
        solid: 'bg-emerald-500'
    },
    sky: {
        text: 'text-sky-800',
        textDark: 'dark:text-sky-300',
        bg: 'bg-sky-500/20',
        bgDark: 'dark:bg-sky-500/20',
        border: 'border-sky-500/40',
        halo: 'bg-sky-500',
        glow: 'shadow-[0_0_15px_rgba(14,165,233,0.5)]',
        crown: 'text-sky-500',
        ring: 'ring-sky-500',
        gradient: 'from-sky-500/15 to-transparent',
        solid: 'bg-sky-500'
    },
    violet: {
        text: 'text-violet-800',
        textDark: 'dark:text-violet-300',
        bg: 'bg-violet-500/20',
        bgDark: 'dark:bg-violet-500/20',
        border: 'border-violet-500/40',
        halo: 'bg-violet-500',
        glow: 'shadow-[0_0_15px_rgba(139,92,246,0.5)]',
        crown: 'text-violet-500',
        ring: 'ring-violet-500',
        gradient: 'from-violet-500/15 to-transparent',
        solid: 'bg-violet-500'
    },
    slate: {
        text: 'text-slate-800',
        textDark: 'dark:text-slate-300',
        bg: 'bg-slate-500/20',
        bgDark: 'dark:bg-slate-500/20',
        border: 'border-slate-500/40',
        halo: 'bg-slate-500',
        glow: 'shadow-[0_0_15px_rgba(100,116,139,0.5)]',
        crown: 'text-slate-500',
        ring: 'ring-slate-500',
        gradient: 'from-slate-500/15 to-transparent',
        solid: 'bg-slate-500'
    },
    fuchsia: {
        text: 'text-fuchsia-800',
        textDark: 'dark:text-fuchsia-300',
        bg: 'bg-fuchsia-500/20',
        bgDark: 'dark:bg-fuchsia-500/20',
        border: 'border-fuchsia-500/40',
        halo: 'bg-fuchsia-500',
        glow: 'shadow-[0_0_15px_rgba(217,70,239,0.5)]',
        crown: 'text-fuchsia-500',
        ring: 'ring-fuchsia-500',
        gradient: 'from-fuchsia-500/15 to-transparent',
        solid: 'bg-fuchsia-500'
    },
    orange: {
        text: 'text-orange-800',
        textDark: 'dark:text-orange-300',
        bg: 'bg-orange-500/20',
        bgDark: 'dark:bg-orange-500/20',
        border: 'border-orange-500/40',
        halo: 'bg-orange-500',
        glow: 'shadow-[0_0_15px_rgba(249,115,22,0.5)]',
        crown: 'text-orange-500',
        ring: 'ring-orange-500',
        gradient: 'from-orange-500/15 to-transparent',
        solid: 'bg-orange-500'
    },
    teal: {
        text: 'text-teal-800',
        textDark: 'dark:text-teal-300',
        bg: 'bg-teal-500/20',
        bgDark: 'dark:bg-teal-500/20',
        border: 'border-teal-500/40',
        halo: 'bg-teal-500',
        glow: 'shadow-[0_0_15px_rgba(20,184,166,0.5)]',
        crown: 'text-teal-500',
        ring: 'ring-teal-500',
        gradient: 'from-teal-500/15 to-transparent',
        solid: 'bg-teal-500'
    },
    cyan: {
        text: 'text-cyan-800',
        textDark: 'dark:text-cyan-300',
        bg: 'bg-cyan-500/20',
        bgDark: 'dark:bg-cyan-500/20',
        border: 'border-cyan-500/40',
        halo: 'bg-cyan-500',
        glow: 'shadow-[0_0_15px_rgba(6,182,212,0.5)]',
        crown: 'text-cyan-500',
        ring: 'ring-cyan-500',
        gradient: 'from-cyan-500/15 to-transparent',
        solid: 'bg-cyan-500'
    },
    lime: {
        text: 'text-lime-800',
        textDark: 'dark:text-lime-300',
        bg: 'bg-lime-500/20',
        bgDark: 'dark:bg-lime-500/20',
        border: 'border-lime-500/40',
        halo: 'bg-lime-500',
        glow: 'shadow-[0_0_15px_rgba(132,204,22,0.5)]',
        crown: 'text-lime-500',
        ring: 'ring-lime-500',
        gradient: 'from-lime-500/15 to-transparent',
        solid: 'bg-lime-500'
    },
    pink: {
        text: 'text-pink-800',
        textDark: 'dark:text-pink-300',
        bg: 'bg-pink-500/20',
        bgDark: 'dark:bg-pink-500/20',
        border: 'border-pink-500/40',
        halo: 'bg-pink-500',
        glow: 'shadow-[0_0_15px_rgba(236,72,153,0.5)]',
        crown: 'text-pink-500',
        ring: 'ring-pink-500',
        gradient: 'from-pink-500/15 to-transparent',
        solid: 'bg-pink-500'
    }
};

const HEX_MAP: Record<string, string> = {
    indigo: '#6366f1',
    rose: '#f43f5e',
    emerald: '#10b981',
    sky: '#0ea5e9',
    violet: '#8b5cf6',
    slate: '#64748b',
    fuchsia: '#d946ef',
    orange: '#f97316',
    teal: '#14b8a6',
    cyan: '#06b6d4',
    lime: '#84cc16',
    pink: '#ec4899'
};

export const COLOR_KEYS = Object.keys(TEAM_COLORS);

/**
 * Resolves a color string (preset key or hex code) into a full theme object.
 * Supports Tailwind Arbitrary Values for Hex codes.
 */
export const resolveTheme = (color: TeamColor | undefined): ColorTheme => {
    if (!color) return TEAM_COLORS['slate'];
    
    // 1. Check if it is a preset
    if (TEAM_COLORS[color]) {
        return TEAM_COLORS[color];
    }

    // 2. Assume it is a Hex Code (or any valid CSS color string)
    const safeColor = color.trim();
    
    return {
        text: `text-[${safeColor}]`,
        textDark: `dark:text-[${safeColor}]`,
        bg: `bg-[${safeColor}]/20`,
        bgDark: `dark:bg-[${safeColor}]/20`,
        border: `border-[${safeColor}]/40`,
        halo: `bg-[${safeColor}]`,
        glow: `shadow-[0_0_15px_${safeColor}80]`,
        crown: `text-[${safeColor}]`,
        ring: `ring-[${safeColor}]`,
        gradient: `from-[${safeColor}]/15 to-transparent`,
        solid: `bg-[${safeColor}]`
    };
};

/**
 * Returns a valid HEX code for Canvas/SVG usage.
 */
export const getHexFromColor = (color: TeamColor | undefined): string => {
    if (!color) return HEX_MAP['slate'];
    if (HEX_MAP[color]) return HEX_MAP[color];
    if (color.startsWith('#')) return color;
    return HEX_MAP['slate']; // Fallback
};
