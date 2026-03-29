import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth, db, firebaseConfig } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Convert USN to email format
export const usnToEmail = (usn) => `${usn.toLowerCase()}@campustwin.edu`;

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Login with USN + password
  const login = async (usn, password, role = 'student') => {
    if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
      const mockUid = `mock-${role}-${Date.now()}`;
      const mockProfile = {
        id: mockUid,
        name: usn === '4S024CS128' ? 'Melroy' : `${role.charAt(0).toUpperCase() + role.slice(1)} User`,
        role: role,
        class_id: role === 'student' ? 'CS-A-2024' : (role === 'teacher' ? 'class-1' : undefined),
        usn: usn,
      };
      sessionStorage.setItem('mockProfile', JSON.stringify(mockProfile));
      setCurrentUser({ uid: mockUid, email: usnToEmail(usn) });
      setUserProfile(mockProfile);
      return { user: { uid: mockUid } };
    }
    const email = usnToEmail(usn);
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result;
  };

  // Logout
  const logout = () => {
    if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
      sessionStorage.removeItem('mockProfile');
      setCurrentUser(null);
      setUserProfile(null);
      return;
    }
    return signOut(auth);
  };

  // Admin: create a new user account
  const createUser = async (usn, password, profileData) => {
    const email = usnToEmail(usn);
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const uid = result.user.uid;
    // Store profile in Firestore with the appropriate collection based on role
    const collectionName = profileData.role === 'student'
      ? 'students'
      : profileData.role === 'teacher'
      ? 'teachers'
      : profileData.role === 'mentor'
      ? 'teachers'
      : 'admins';
    await setDoc(doc(db, collectionName, uid), {
      ...profileData,
      usn,
      email,
      uid,
      createdAt: new Date(),
    });
    // Also store a quick-lookup role doc
    await setDoc(doc(db, 'userRoles', uid), {
      role: profileData.role,
      usn,
      name: profileData.name,
      uid,
    });
    return result;
  };

  // Fetch user profile from Firestore
  const fetchUserProfile = async (uid) => {
    const roleDoc = await getDoc(doc(db, 'userRoles', uid));
    if (!roleDoc.exists()) return null;
    const { role } = roleDoc.data();
    const collectionName =
      role === 'student' ? 'students' :
      role === 'teacher' || role === 'mentor' ? 'teachers' :
      'admins';
    const profileDoc = await getDoc(doc(db, collectionName, uid));
    if (!profileDoc.exists()) return roleDoc.data();
    return { id: profileDoc.id, ...roleDoc.data(), ...profileDoc.data() };
  };

  useEffect(() => {
    if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
      const savedMock = sessionStorage.getItem('mockProfile');
      if (savedMock) {
        const p = JSON.parse(savedMock);
        setCurrentUser({ uid: p.id, email: usnToEmail(p.usn) });
        setUserProfile(p);
      }
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const profile = await fetchUserProfile(user.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    login,
    logout,
    createUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
