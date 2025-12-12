
import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export interface PlatformState {
  isNative: boolean;      // True ONLY if running in Capacitor (Android/iOS app)
  isPWA: boolean;         // True ONLY if running in Browser AND Installed (Standalone)
  isBrowser: boolean;     // True ONLY if running in Browser AND Not Installed (Regular Tab)
  isIOS: boolean;
  isAndroid: boolean;
  platform: 'ios' | 'android' | 'web';
}

export const usePlatform = (): PlatformState => {
  const [state, setState] = useState<PlatformState>({
    isNative: false,
    isPWA: false,
    isBrowser: true,
    isIOS: false,
    isAndroid: false,
    platform: 'web'
  });

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform(); // 'web', 'ios', 'android'
    
    // Robust PWA Detection
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true || 
      document.referrer.includes('android-app://');

    // Platform Specifics
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    setState({
      isNative,
      // A PWA is only a PWA if it's NOT native wrapping content
      isPWA: isStandalone && !isNative,
      // A Browser is only a Browser if it's NOT native and NOT standalone
      isBrowser: !isNative && !isStandalone,
      isIOS: isIOS, // Keeps UA detection for styling quirks, but use isNative for logic
      isAndroid: isAndroid,
      platform: platform as 'ios' | 'android' | 'web'
    });
  }, []);

  return state;
};
