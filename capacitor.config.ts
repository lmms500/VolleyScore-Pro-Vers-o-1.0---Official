
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.volleyscore.pro2',
  appName: 'VolleyScore Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  // CRITICAL: Matches the dark theme background to prevent white flashes during native boot
  backgroundColor: "#020617", 
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#020617",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK", // Light text for dark background
      backgroundColor: "#00000000", // Fully Transparent
      overlaysWebView: true, // CRITICAL: Allows app to draw behind status bar for glass effect
    },
    Keyboard: {
      resize: "body", // Resizes the webview when keyboard appears
      style: "DARK",
      resizeOnFullScreen: true,
    }
  }
};

export default config;
