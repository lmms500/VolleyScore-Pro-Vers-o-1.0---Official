
// import { initializeApp } from 'firebase/app';
// import { getAuth, GoogleAuthProvider } from 'firebase/auth';
// import { getFunctions } from 'firebase/functions';

// ------------------------------------------------------------------
// INSTRUCTIONS:
// 1. Go to console.firebase.google.com
// 2. Create a new project "VolleyScore Pro"
// 3. Add a Web App to the project
// 4. Copy the config object below
// ------------------------------------------------------------------

const firebaseConfig = {
  // REPLACE THIS WITH YOUR FIREBASE CONFIG
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSy...",
  authDomain: "volleyscore-pro.firebaseapp.com",
  projectId: "volleyscore-pro",
  storageBucket: "volleyscore-pro.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// Initialize Firebase
// const app = initializeApp(firebaseConfig);

// Export Services
// export const auth = getAuth(app);
// export const googleProvider = new GoogleAuthProvider();
// export const functions = getFunctions(app, 'us-central1'); // Region must match your deployment

// --- MOCKED EXPORTS (Fallback for when Firebase is not configured) ---
// This ensures the app builds and runs locally without crashing on missing Firebase imports.
export const auth: any = {
    currentUser: null,
    onAuthStateChanged: (cb: any) => { cb(null); return () => {}; },
    signOut: async () => {},
    signInWithPopup: async () => {},
    signInWithRedirect: async () => {}
};
export const googleProvider: any = {};
export const functions: any = {};
