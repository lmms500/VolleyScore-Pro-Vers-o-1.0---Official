
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

interface TimerContextType {
  seconds: number;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
  setSeconds: (s: number) => void;
  getTime: () => number; // Non-reactive getter for logic/storage
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [seconds, setSecondsState] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<any>(null);
  const secondsRef = useRef(0);

  // Sync ref with state for non-reactive access
  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  const tick = useCallback(() => {
    setSecondsState(prev => prev + 1);
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    setIsRunning(true);
    intervalRef.current = setInterval(tick, 1000);
  }, [tick]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setSecondsState(0);
    secondsRef.current = 0;
  }, [stop]);

  const setSeconds = useCallback((s: number) => {
    setSecondsState(s);
    secondsRef.current = s;
  }, []);

  const getTime = useCallback(() => secondsRef.current, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <TimerContext.Provider value={{ seconds, isRunning, start, stop, reset, setSeconds, getTime }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};
