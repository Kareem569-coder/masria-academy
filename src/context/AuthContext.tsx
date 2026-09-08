'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { isTeacherEmail } from '@/lib/authorization';
import { createStudentLinkCode, linkStudentToParent } from '@/lib/firestore/parentLinking';
import type { UserProfile } from '@/types/models';

interface AuthContextType {
  user: User | null;
  role: 'student' | 'parent' | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ role: 'student' | 'parent' }>;
  signup: (name: string, email: string, password: string, role: 'student' | 'parent', gradeLevel?: string) => Promise<{ role: 'student' | 'parent' }>;
  logout: () => Promise<void>;
  linkStudent: (parentUid: string, linkCode: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'student' | 'parent' | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSignupInProgress, setIsSignupInProgress] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Skip auth state processing during signup to prevent race conditions
      if (isSignupInProgress) {
        console.log('Skipping auth state listener during signup');
        return;
      }

      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const isTeacher = isTeacherEmail(currentUser.email);

          // إذا كان طالباً وحالته pending، نمنع دخوله بتسجيل الخروج بهدوء
          if (!isTeacher && userData.role === 'student' && userData.status === 'pending') {
            await signOut(auth);
            setUser(null);
            setRole(null);
            setLoading(false);
            return;
          }

          setUser(currentUser);
          setRole(userData.role as 'student' | 'parent');
        } else {
          setUser(currentUser);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [isSignupInProgress]);

  const login = async (email: string, password: string) => {
    const isTeacher = isTeacherEmail(email);

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      if (!isTeacher && userData.role === 'student' && userData.status === 'pending') {
        await signOut(auth);
        throw new Error('حسابك قيد المراجعة في انتظار موافقة إدارة MASRIA.');
      }

      return { role: userData.role as 'student' | 'parent' };
    }
    
    return { role: 'student' as const };
  };

  const signup = async (name: string, email: string, password: string, role: 'student' | 'parent', gradeLevel?: string) => {
    const isTeacher = isTeacherEmail(email);

    // Set flag to prevent auth state listener from interfering
    setIsSignupInProgress(true);

    try {
      console.log("Starting signup process...");
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("Auth user created:", user.uid);

      let linkCode: string | undefined;
      if (role === 'student') {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'NUC-';
        for (let i = 0; i < 4; i++) {
          code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        linkCode = code;
      }

      // Add timeout for Firestore operations
      const firestoreTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore operation timeout after 30 seconds')), 30000)
      );

      let userData: UserProfile;
      if (isTeacher) {
        userData = {
          name,
          email,
          role: 'student',
          status: 'active',
          createdAt: new Date().toISOString()
        };
      } else if (role === 'student') {
        userData = {
          name,
          email,
          role,
          gradeLevel: gradeLevel || 'Grade 4',
          status: 'pending', 
          linkCode,
          createdAt: new Date().toISOString()
        };
      } else {
        userData = {
          name,
          email,
          role,
          status: 'active',
          linkedStudents: [],
          linkedStudentIds: [],
          createdAt: new Date().toISOString()
        };
      }

      console.log("Saving user data to Firestore:", userData);
      
      // Race setDoc with timeout
      await Promise.race([
        setDoc(doc(db, 'users', user.uid), userData),
        firestoreTimeout
      ]);

      if (role === 'student' && linkCode) {
        await createStudentLinkCode(linkCode, user.uid, userData.createdAt || new Date().toISOString());
      }
      
      console.log("User data saved successfully");

      return { role };
    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    } finally {
      // Clear flag after signup completes (or fails)
      setIsSignupInProgress(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const linkStudent = async (parentUid: string, linkCode: string) => {
    await linkStudentToParent(parentUid, linkCode);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, signup, logout, linkStudent }}>
      {children}
    </AuthContext.Provider>
  );
};