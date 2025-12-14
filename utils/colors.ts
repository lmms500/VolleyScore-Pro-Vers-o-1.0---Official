
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

// Helper to generate theme objects consistent with Tailwind classes
const createTheme = (color: string, baseIntensity: number = 500, textIntensity: number = 800, darkTextIntensity: number = 300): ColorTheme => ({
    text: `text-${color}-${textIntensity}`,
    textDark: `dark:text-${color}-${darkTextIntensity}`,
    bg: `bg-${color}-${baseIntensity}/20`,
    bgDark: `dark:bg-${color}-${baseIntensity}/20`,
    border: `border-${color}-${baseIntensity}/40`,
    halo: `bg-${color}-${baseIntensity}`,
    glow: `shadow-[0_0_15px_rgba(var(--color-${color}-${baseIntensity}),0.5)]`, // Relies on Tailwind var or approximation
    crown: `text-${color}-${baseIntensity}`,
    ring: `ring-${color}-${baseIntensity}`,
    gradient: `from-${color}-${baseIntensity}/15 to-transparent`,
    solid: `bg-${color}-${baseIntensity}`
});

export const TEAM_COLORS: Record<string, ColorTheme> = {
    // REDS & PINKS
    red: createTheme('red', 600, 800, 200),
    rose: createTheme('rose', 500, 800, 300),
    pink: createTheme('pink', 500, 800, 300),
    fuchsia: createTheme('fuchsia', 500, 800, 300),
    
    // PURPLES & VIOLETS
    purple: createTheme('purple', 600, 800, 300),
    violet: createTheme('violet', 500, 800, 300),
    indigo: createTheme('indigo', 500, 800, 300),
    
    // BLUES
    blue: createTheme('blue', 600, 800, 300),
    sky: createTheme('sky', 500, 800, 300),
    cyan: createTheme('cyan', 500, 800, 300),
    
    // TEALS & GREENS
    teal: createTheme('teal', 500, 800, 300),
    emerald: createTheme('emerald', 500, 800, 300),
    green: createTheme('green', 600, 800, 300),
    lime: createTheme('lime', 500, 800, 300),
    
    // YELLOWS & ORANGES
    yellow: createTheme('yellow', 400, 800, 200), // Slightly lighter base for visibility
    amber: createTheme('amber', 500, 800, 300),
    orange: createTheme('orange', 500, 800, 300),
    
    // NEUTRALS / GRAYS
    slate: createTheme('slate', 500, 800, 300),
    zinc: createTheme('zinc', 500, 800, 300),
    stone: createTheme('stone', 500, 800, 300),
};

const HEX_MAP: Record<string, string> = {
    red: '#dc2626',
    rose: '#f43f5e',
    pink: '#ec4899',
    fuchsia: '#d946ef',
    purple: '#9333ea',
    violet: '#8b5cf6',
    indigo: '#6366f1',
    blue: '#2563eb',
    sky: '#0ea5e9',
    cyan: '#06b6d4',
    teal: '#14b8a6',
    emerald: '#10b981',
    green: '#16a34a',
    lime: '#84cc16',
    yellow: '#facc15',
    amber: '#f59e0b',
    orange: '#f97316',
    slate: '#64748b',
    zinc: '#71717a',
    stone: '#78716c',
};

export const COLOR_KEYS = Object.keys(TEAM_COLORS);

/**
 * Resolves a color string (preset key or hex code) into a full theme object.
 */
export const resolveTheme = (color: TeamColor | undefined): ColorTheme => {
    if (!color) return TEAM_COLORS['slate'];
    
    // 1. Check if it is a preset
    if (TEAM_COLORS[color]) {
        return TEAM_COLORS[color];
    }

    // 2. Assume it is a Hex Code (Legacy fallback)
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
    return HEX_MAP['slate'];
};
