
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, terminate } from 'firebase/firestore';

// ------------------------------------------------------------------
// FIREBASE CONFIGURATION ENGINE
// ------------------------------------------------------------------

const getEnv = (key: string) => {
  const meta = import.meta as any;
  if (typeof meta !== 'undefined' && meta.env) {
    return meta.env[key] || meta.env[`VITE_${key}`];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || process.env[`VITE_${key}`];
  }
  return undefined;
};

const apiKey = getEnv('FIREBASE_API_KEY');

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: "volleyscore-pro.firebaseapp.com",
  projectId: "volleyscore-pro",
  storageBucket: "volleyscore-pro.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

export let isFirebaseInitialized = false;

let app;
let authExport: any = null;
let googleProviderExport: any = null;
let dbExport: any = null;

const initialize = async () => {
    try {
        if (apiKey && !apiKey.startsWith('AIzaSy') && apiKey !== 'undefined') {
            if (!getApps().length) {
                app = initializeApp(firebaseConfig);
            } else {
                app = getApp();
            }
            
            authExport = getAuth(app);
            googleProviderExport = new GoogleAuthProvider();
            dbExport = getFirestore(app);
            
            // Enable Offline Persistence for Firestore (Crucial for high-performance mobile apps)
            if (typeof window !== 'undefined') {
                enableIndexedDbPersistence(dbExport).catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn("[Firebase] Multiple tabs open, persistence can only be enabled in one tab.");
                    } else if (err.code === 'unimplemented') {
                        console.warn("[Firebase] The current browser doesn't support persistence.");
                    }
                });
            }

            isFirebaseInitialized = true;
            console.log("[Firebase] 100% Operational.");
        } else {
            console.warn("[Firebase] Configuration missing or invalid key.");
        }
    } catch (e) {
        console.error("[Firebase] Fatal Initialization Error:", e);
    }
};

// Immediate invocation
initialize();

export const auth = authExport;
export const googleProvider = googleProviderExport;
export const db = dbExport;
