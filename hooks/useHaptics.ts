
import { useCallback } from 'react';
import { Haptics, ImpactStyle as CapImpactStyle, NotificationType as CapNotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

type ImpactStyle = 'light' | 'medium' | 'heavy';
type NotificationType = 'success' | 'warning' | 'error';

export const useHaptics = (enabled: boolean = true) => {
  const isNative = Capacitor.isNativePlatform();

  const trigger = useCallback(async (pattern: number | number[]) => {
    if (!enabled) return;
    
    try {
        if (isNative) {
            // Capacitor generic vibrate only takes duration (not pattern)
            // For native patterns, we rely on impact/notification methods below
            await Haptics.vibrate({ duration: Array.isArray(pattern) ? pattern[0] : pattern });
        } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
            // Web Vibration API
            navigator.vibrate(pattern);
        }
    } catch (e) {
        // Ignore errors
    }
  }, [enabled, isNative]);

  // Mimic iOS UIImpactFeedbackGenerator styles
  const impact = useCallback(async (style: ImpactStyle) => {
    if (!enabled) return;

    try {
        if (isNative) {
            let capStyle = CapImpactStyle.Medium;
            if (style === 'light') capStyle = CapImpactStyle.Light;
            if (style === 'heavy') capStyle = CapImpactStyle.Heavy;
            
            await Haptics.impact({ style: capStyle });
        } else {
            // Web Fallback
            switch (style) {
              case 'light': trigger(10); break;
              case 'medium': trigger(20); break;
              case 'heavy': trigger(40); break;
            }
        }
    } catch (e) {
        // Ignore
    }
  }, [trigger, enabled, isNative]);

  // Mimic iOS UINotificationFeedbackGenerator styles
  const notification = useCallback(async (type: NotificationType) => {
    if (!enabled) return;

    try {
        if (isNative) {
            let capType = CapNotificationType.Success;
            if (type === 'warning') capType = CapNotificationType.Warning;
            if (type === 'error') capType = CapNotificationType.Error;

            await Haptics.notification({ type: capType });
        } else {
            // Web Fallback
            switch (type) {
              case 'success': trigger([10, 50, 20]); break;
              case 'warning': trigger([30, 50, 30]); break;
              case 'error': trigger([50, 100, 50, 100, 50]); break;
            }
        }
    } catch (e) {
        // Ignore
    }
  }, [trigger, enabled, isNative]);

  return { impact, notification, trigger };
};
