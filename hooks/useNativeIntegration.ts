import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { KeepAwake } from '@capacitor-community/keep-awake';

export const useNativeIntegration = (
    isMatchActive: boolean,
    isFullscreen: boolean,
    onBackAction: () => void,
    modalsOpen: boolean
) => {
    // 1. Initial Native Setup
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            const initNative = async () => {
                try {
                    await StatusBar.setStyle({ style: Style.Dark });
                    await StatusBar.setBackgroundColor({ color: '#00000000' }); 
                    await StatusBar.setOverlaysWebView({ overlay: true });
                    setTimeout(async () => {
                        await SplashScreen.hide();
                    }, 500);
                } catch (e) {
                    console.error("Native init error:", e);
                }
            };
            initNative();
        }
    }, []);

    // 2. Keep Awake Logic (Screen Control)
    useEffect(() => {
        const manageScreenSleep = async () => {
            if (!Capacitor.isNativePlatform()) return; // Optional: Could use WakeLock API for Web here too

            try {
                if (isMatchActive) {
                    await KeepAwake.keepAwake();
                    console.debug('[Native] KeepAwake Enabled');
                } else {
                    await KeepAwake.allowSleep();
                    console.debug('[Native] KeepAwake Disabled');
                }
            } catch (e) {
                console.warn('[Native] KeepAwake error:', e);
            }
        };
        manageScreenSleep();
        
        // Cleanup on unmount
        return () => {
            if (Capacitor.isNativePlatform()) {
                KeepAwake.allowSleep().catch(() => {});
            }
        };
    }, [isMatchActive]);

    // 3. Reactive Orientation Locking (Native + PWA Support)
    useEffect(() => {
        const lockOrientation = async () => {
            const targetOrientation = isFullscreen ? 'landscape' : 'portrait';
            
            // A. Native Capacitor
            if (Capacitor.isNativePlatform()) {
                try {
                    await ScreenOrientation.lock({ orientation: targetOrientation });
                } catch (e) {
                    console.warn('Native orientation lock failed:', e);
                }
            } 
            // B. PWA / Web API
            else if (typeof screen !== 'undefined' && 'orientation' in screen && typeof (screen.orientation as any).lock === 'function') {
                try {
                    // Note: Browsers may reject lock if not in fullscreen, but we attempt it anyway
                    // for environments like Android AI Studio wrapper or PWA standalone.
                    await (screen.orientation as any).lock(targetOrientation);
                } catch (e) {
                    // Expected in standard browser tabs without fullscreen interaction
                    console.debug('Web orientation lock failed (requires fullscreen/user interaction):', e);
                }
            }
        };
        lockOrientation();
    }, [isFullscreen]);

    // 4. Lifecycle Robustness (App Background/Resume)
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const listener = CapApp.addListener('appStateChange', async ({ isActive }) => {
            if (isActive) {
                // Re-enforce orientation lock on resume based on current state
                try {
                    const target = isFullscreen ? 'landscape' : 'portrait';
                    await ScreenOrientation.lock({ orientation: target });
                    
                    // Re-enforce Keep Awake if match is active
                    if (isMatchActive) {
                        await KeepAwake.keepAwake();
                    }
                } catch (e) {
                    console.warn('Resume native state sync failed', e);
                }
            }
        });

        return () => {
            listener.then(l => l.remove());
        };
    }, [isFullscreen, isMatchActive]);

    // 5. Hardware Back Button Handling (Android)
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let lastBackPress = 0;

        const handleBackButton = async () => {
            const now = Date.now();
            
            // If match is active and no modals are open, prevent accidental exit
            if (isMatchActive && !modalsOpen) {
                // Require double press to exit/minimize
                if (now - lastBackPress < 2000) {
                    CapApp.minimizeApp();
                } else {
                    lastBackPress = now;
                }
            } else {
                if (!modalsOpen) {
                     CapApp.minimizeApp();
                }
            }
        };

        const listener = CapApp.addListener('backButton', () => {
            if (modalsOpen) {
                onBackAction(); 
            } else {
                handleBackButton();
            }
        });

        return () => {
            listener.then(l => l.remove());
        };
    }, [isMatchActive, modalsOpen, onBackAction]);
};