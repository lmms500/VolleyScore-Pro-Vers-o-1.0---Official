
import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

interface IBeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<IBeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  
  // Guard: Check Native Environment immediately
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    // 🛡️ CRITICAL: If Native, strictly disable all PWA prompt logic
    if (isNative) {
        setIsIOS(false);
        setIsStandalone(true); // Treat as "already installed" to suppress prompts
        return;
    }

    // Detect iOS (Only relevant if Web)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIPad = navigator.maxTouchPoints > 0 && /macintosh/.test(userAgent);
    setIsIOS(/iphone|ipad|ipod/.test(userAgent) || isIPad);

    // Detect Standalone Mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isStandaloneMode);

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as IBeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [isNative]);

  const promptInstall = useCallback(async () => {
    // Safety check
    if (isNative || !deferredPrompt) return;

    await deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setDeferredPrompt(null);
    } else {
      console.log('User dismissed the install prompt');
    }
  }, [deferredPrompt, isNative]);

  return {
    isInstallable: !!deferredPrompt && !isStandalone && !isNative,
    isIOS: isIOS && !isStandalone && !isNative,
    isStandalone: isStandalone || isNative, // Native apps consider themselves "installed"
    promptInstall
  };
};
