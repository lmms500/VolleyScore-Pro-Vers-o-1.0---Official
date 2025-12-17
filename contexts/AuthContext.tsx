
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider, isFirebaseInitialized } from '../services/firebase';
import { Capacitor } from '@capacitor/core';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseInitialized || !auth) {
        setLoading(false);
        return;
    }

    // 1. Handle Redirect Result (Crucial for Native/Mobile Chrome flows)
    getRedirectResult(auth).then((result) => {
        if (result?.user) {
            console.log("[Auth] Redirect sign-in success:", result.user.displayName);
            setUser(result.user);
        }
    }).catch((error) => {
        console.error("[Auth] Redirect error:", error);
    });

    // 2. Main Observer
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!isFirebaseInitialized || !auth || !googleProvider) {
        console.warn("[Auth] Firebase not initialized. Login unavailable.");
        return;
    }

    try {
      setLoading(true);
      // Native platforms or small screens prefer redirect for better UX and reliability
      if (Capacitor.isNativePlatform() || window.innerWidth < 768) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        setUser(result.user);
      }
    } catch (error) {
      console.error("[Auth] Google Sign-In Failed:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!isFirebaseInitialized || !auth) return;
    try {
        await signOut(auth);
        setUser(null);
    } catch (e) {
        console.error("[Auth] Logout error:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
