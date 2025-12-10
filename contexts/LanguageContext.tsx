import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';

type Language = 'en' | 'pt' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Helper to get nested properties from an object
const getNested = (obj: any, path: string) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [translations, setTranslations] = useState<Record<Language, any> | null>(null);

  useEffect(() => {
    const savedLang = localStorage.getItem('volleyscore-lang') as Language;
    const browserLang = navigator.language.split('-')[0];
    if (savedLang && ['en', 'pt', 'es'].includes(savedLang)) {
      setLanguageState(savedLang);
    } else if (['pt', 'es'].includes(browserLang)) {
        setLanguageState(browserLang as Language);
    }
  }, []);

  useEffect(() => {
    const fetchTranslations = async () => {
        try {
            const [en, pt, es] = await Promise.all([
                fetch('/locales/en.json').then(res => res.json()),
                fetch('/locales/pt.json').then(res => res.json()),
                fetch('/locales/es.json').then(res => res.json())
            ]);
            setTranslations({ en, pt, es });
        } catch (error) {
            console.error("Failed to load translations:", error);
            setTranslations({ en: {}, pt: {}, es: {} }); 
        }
    };
    fetchTranslations();
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('volleyscore-lang', lang);
  }, []);

  const t = useCallback((key: string, options?: Record<string, string | number>): string => {
    if (!translations) {
      return key; // Return key as fallback while loading
    }
    
    let translation = getNested(translations[language], key);

    // Fallback to English if translation is not found
    if (translation === undefined) {
      translation = getNested(translations.en, key);
    }
    
    // Fallback to the key itself if still not found
    if (translation === undefined) {
      return key;
    }

    // Replace placeholders
    if (options && typeof translation === 'string') {
      return Object.entries(options).reduce((acc, [optKey, optVal]) => {
        return acc.replace(`{${optKey}}`, String(optVal));
      }, translation);
    }

    return translation;
  }, [language, translations]);

  // OPTIMIZATION: Memoize value to prevent consumer re-renders
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};