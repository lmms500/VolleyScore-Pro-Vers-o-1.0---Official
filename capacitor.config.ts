
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.volleyscore.pro2',
  appName: 'VolleyScore Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  backgroundColor: "#020617", 
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: "#020617",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK", 
      backgroundColor: "#00000000",
      overlaysWebView: true,
    },
    Keyboard: {
      resize: "none",
      style: "dark"
    }
  }
};

export default config;
