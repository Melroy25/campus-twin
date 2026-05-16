import { createContext, useContext, useEffect, useState } from 'react';
import { loginUser, logoutUser, getCurrentUser, createNewUser } from '../appwrite/auth';
import { getUserProfile, addDocumentWithId } from '../appwrite/database';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const usnToEmail = (usn) => `${usn.toLowerCase()}@campustwin.edu`;

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (usn, password, role = 'student') => {
    const email = usnToEmail(usn);
    const result = await loginUser(email, password);
    
    // Refresh user state after login
    const user = await getCurrentUser();
    setCurrentUser(user);
    if (user) {
      const profile = await getUserProfile(user.uid);
      setUserProfile(profile);
    }
    return result;
  };

  const logout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setUserProfile(null);
  };

  const createUser = async (usn, password, profileData) => {
    const email = usnToEmail(usn);
    // Note: This relies on the Netlify lambda function to avoid logging out the admin
    const result = await createNewUser(email, password, profileData.name || usn);
    const uid = result.user.uid;

    const collectionName =
      profileData.role === 'student' ? 'students' :
      profileData.role === 'teacher' ? 'teachers' :
      profileData.role === 'mentor' ? 'teachers' :
      'admins';

    const docData = {
      ...profileData,
      usn,
      email,
      uid,
      createdAt: new Date().toISOString(),
    };
    
    delete docData.class_assignments;
    if (profileData.role === 'teacher' || profileData.role === 'mentor') {
      docData.class_assignments = profileData.class_assignments || [];
    }

    // Ensure documents get created matching Auth User ID
    await addDocumentWithId(collectionName, uid, docData);
    await addDocumentWithId('userRoles', uid, {
      role: profileData.role,
      usn,
      name: profileData.name,
      uid,
    });
    
    return result;
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
        if (user) {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
        }
      } catch (err) {
        console.warn("Not logged in");
      }
      setLoading(false);
    };
    initAuth();
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
