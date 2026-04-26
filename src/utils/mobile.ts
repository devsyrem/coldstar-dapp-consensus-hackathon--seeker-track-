import { Capacitor } from '@capacitor/core';

// Lazy load plugins only when needed to avoid import errors in web mode
let Haptics: any;
let StatusBar: any;
let SplashScreen: any;

const loadHaptics = async () => {
  if (!Haptics && isNativeMobile()) {
    const module = await import('@capacitor/haptics');
    Haptics = module.Haptics;
  }
};

const loadStatusBar = async () => {
  if (!StatusBar && isNativeMobile()) {
    const module = await import('@capacitor/status-bar');
    StatusBar = module.StatusBar;
  }
};

const loadSplashScreen = async () => {
  if (!SplashScreen && isNativeMobile()) {
    const module = await import('@capacitor/splash-screen');
    SplashScreen = module.SplashScreen;
  }
};

/**
 * Mobile platform utilities for Capacitor integration
 */

// Check if running as native mobile app
export const isNativeMobile = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

// Get current platform
export const getPlatform = () => {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
};

// Haptic feedback functions
export const hapticLight = async () => {
  if (isNativeMobile()) {
    try {
      await loadHaptics();
      if (Haptics) {
        const { ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch (e) {
      console.warn('Haptics not available:', e);
    }
  }
};

export const hapticMedium = async () => {
  if (isNativeMobile()) {
    try {
      await loadHaptics();
      if (Haptics) {
        const { ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Medium });
      }
    } catch (e) {
      console.warn('Haptics not available:', e);
    }
  }
};

export const hapticHeavy = async () => {
  if (isNativeMobile()) {
    try {
      await loadHaptics();
      if (Haptics) {
        const { ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Heavy });
      }
    } catch (e) {
      console.warn('Haptics not available:', e);
    }
  }
};

export const hapticSuccess = async () => {
  if (isNativeMobile()) {
    try {
      await loadHaptics();
      if (Haptics) {
        await Haptics.notification({ type: 'SUCCESS' });
      }
    } catch (e) {
      console.warn('Haptics not available:', e);
    }
  }
};

export const hapticWarning = async () => {
  if (isNativeMobile()) {
    try {
      await loadHaptics();
      if (Haptics) {
        await Haptics.notification({ type: 'WARNING' });
      }
    } catch (e) {
      console.warn('Haptics not available:', e);
    }
  }
};

export const hapticError = async () => {
  if (isNativeMobile()) {
    try {
      await loadHaptics();
      if (Haptics) {
        await Haptics.notification({ type: 'ERROR' });
      }
    } catch (e) {
      console.warn('Haptics not available:', e);
    }
  }
};

// Status bar functions
export const initializeStatusBar = async () => {
  if (isNativeMobile()) {
    try {
      await loadStatusBar();
      if (StatusBar) {
        const { Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#000000' });
      }
    } catch (e) {
      console.warn('StatusBar not available:', e);
    }
  }
};

export const hideStatusBar = async () => {
  if (isNativeMobile()) {
    try {
      await loadStatusBar();
      if (StatusBar) {
        await StatusBar.hide();
      }
    } catch (e) {
      console.warn('StatusBar not available:', e);
    }
  }
};

export const showStatusBar = async () => {
  if (isNativeMobile()) {
    try {
      await loadStatusBar();
      if (StatusBar) {
        await StatusBar.show();
      }
    } catch (e) {
      console.warn('StatusBar not available:', e);
    }
  }
};

// Splash screen functions
export const hideSplashScreen = async () => {
  if (isNativeMobile()) {
    try {
      await loadSplashScreen();
      if (SplashScreen) {
        await SplashScreen.hide();
      }
    } catch (e) {
      console.warn('SplashScreen not available:', e);
    }
  }
};

// Safe area utilities for iOS notch/dynamic island
export const getSafeAreaInsets = () => {
  if (typeof window !== 'undefined' && isNativeMobile() && getPlatform() === 'ios') {
    const style = getComputedStyle(document.documentElement);
    return {
      top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
      bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
      left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0'),
      right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
    };
  }
  return { top: 0, bottom: 0, left: 0, right: 0 };
};