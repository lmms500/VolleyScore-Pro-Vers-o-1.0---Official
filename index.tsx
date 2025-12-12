
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Capacitor } from '@capacitor/core';

// --- SECURITY CONTEXT INITIALIZATION ---
// Strip console logs in production/native environments to prevent sensitive data leakage.
// This is critical for avoiding PII leaks via logcat/xcode logs.
if (process.env.NODE_ENV === 'production' || (Capacitor.isNativePlatform() && !(import.meta as any).env.DEV)) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  // We keep console.error and console.warn for critical crash reporting integration if needed
}

// Only register Service Worker if NOT native
// Wrapped in try-catch to prevent crashing app if CSP blocks dynamic import or script loading
if (!Capacitor.isNativePlatform()) {
  try {
    import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({ immediate: true });
    }).catch(e => {
      // Console debug is stripped in prod, so this is safe
      console.warn("PWA registration failed:", e);
    });
  } catch (e) {
    console.warn("PWA module import failed:", e);
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
