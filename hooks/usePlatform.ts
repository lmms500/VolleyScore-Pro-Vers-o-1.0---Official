
import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export interface PlatformState {
  isNative: boolean;      // True if Android/iOS App (Capacitor)
  isPWA: boolean;         // True if Standalone Web App (Home Screen)
  isWeb: boolean;         // True if Browser Tab
  isIOS: boolean;
  isAndroid: boolean;
  platform: 'ios' | 'android' | 'web';
}

export const usePlatform = (): PlatformState => {
  const [state, setState] = useState<PlatformState>({
    isNative: false,
    isPWA: false,
    isWeb: true,
    isIOS: false,
    isAndroid: false,
    platform: 'web'
  });

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform(); // 'web', 'ios', 'android'
    
    // Detect PWA Standalone Mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;

    setState({
      isNative,
      isPWA: isStandalone && !isNative, // PWA is standalone ONLY if not native wrapper
      isWeb: !isNative && !isStandalone,
      isIOS: platform === 'ios',
      isAndroid: platform === 'android',
      platform: platform as 'ios' | 'android' | 'web'
    });
  }, []);

  return state;
};
