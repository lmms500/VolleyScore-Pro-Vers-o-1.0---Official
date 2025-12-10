import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state lazily, checking what is ALREADY in the DOM (from head script) or localStorage
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
       // Check class list first (set by index.html script)
       if (document.documentElement.classList.contains('dark')) return 'dark';
       
       // Fallback checks
       const saved = localStorage.getItem('appTheme') as Theme;
       if (saved === 'dark') return 'dark';
       if (saved === 'light') return 'light';
       
       if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }
    return 'light'; // Default
  });

  const applyThemeToDOM = useCallback((newTheme: Theme) => {
    const root = window.document.documentElement;
    const isDark = newTheme === 'dark';

    // Apply Class
    if (isDark) {
        root.classList.add('dark');
        root.classList.remove('light');
    } else {
        root.classList.add('light');
        root.classList.remove('dark');
    }

    // Apply Meta Theme Color (for mobile browser chrome)
    const metaThemeColor = document.querySelector("meta[name=theme-color]");
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", isDark ? "#020617" : "#f1f5f9");
    }
  }, []);

  // Sync state changes to DOM & Storage
  useEffect(() => {
    applyThemeToDOM(theme);
    localStorage.setItem('appTheme', theme);
  }, [theme, applyThemeToDOM]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  // OPTIMIZATION: Memoize the context value
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};