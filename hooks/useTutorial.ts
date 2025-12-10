import { useState, useEffect, useCallback } from 'react';

const TUTORIAL_KEY = 'vs_pro_tutorial_seen_v2';
const REMINDER_INTERVAL = 5 * 60 * 1000; // 5 Minutes

export const useTutorial = (isStandalone: boolean) => {
  const [showTutorial, setShowTutorial] = useState(false);
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    // Check if tutorial has been seen
    const seen = localStorage.getItem(TUTORIAL_KEY);
    if (!seen) {
      // Small delay to ensure app is loaded visually
      setTimeout(() => setShowTutorial(true), 1000);
    }
  }, []);

  useEffect(() => {
    // Periodic Reminder Logic
    if (isStandalone) return; // Don't remind if already installed

    const interval = setInterval(() => {
      // Only show if tutorial is not currently open
      if (!localStorage.getItem(TUTORIAL_KEY)) return; // Don't show reminder if tutorial hasn't finished (though logic implies it runs after)
      
      setShowReminder(prev => {
        if (!prev) return true; // Show if not showing
        return prev;
      });
    }, REMINDER_INTERVAL);

    return () => clearInterval(interval);
  }, [isStandalone]);

  const completeTutorial = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    setShowTutorial(false);
  }, []);

  const dismissReminder = useCallback(() => {
    setShowReminder(false);
  }, []);

  return {
    showTutorial,
    completeTutorial,
    showReminder,
    dismissReminder
  };
};