import { createContext, useContext, useEffect, useState } from 'react';
import { loginUser, logoutUser, getCurrentUser, createNewUser } from '../appwrite/auth';
import { getUserProfile, addDocumentWithId, updateDocument } from '../appwrite/database';
import { supabase } from '../supabase/config';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const usnToEmail = (usn) => `${usn.toLowerCase()}@campustwin.edu`;

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const getMergedProfile = async (user) => {
    if (!user) return null;
    let profile = await getUserProfile(user.uid);
    if (profile && (profile.role === 'student' || profile.role === 'mentor')) {
      try {
        const { data, error } = await supabase
          .from('student_profiles')
          .select('*')
          .eq('id', user.uid)
          .maybeSingle();
        if (data && !error) {
          profile = {
            ...profile,
            personalEmail: data.email,
            isHostelite: data.is_hostelite
          };
        }
      } catch (err) {
        console.error('Failed to merge Supabase profile:', err);
      }
    }
    return profile;
  };

  const login = async (usn, password, role = 'student') => {
    const email = usnToEmail(usn);
    const result = await loginUser(email, password);
    
    // Refresh user state after login
    const user = await getCurrentUser();
    setCurrentUser(user);
    if (user) {
      let profile = await getMergedProfile(user);
      if (!profile) {
        // Fallback if DB document is missing
        profile = { uid: user.uid, role, name: user.name || usn };
      }
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
    // Attempt to create the auth user; if it already exists, fetch the existing uid.
    let result;
    let uid;
    try {
      result = await createNewUser(email, password, profileData.name || usn);
      uid = result.user.uid;
    } catch (err) {
      if (err.code === 'auth/user-already-exists' || err.message?.includes('already exists')) {
        // Try to log in to retrieve uid (admin may know password)
        const loginRes = await loginUser(email, password).catch(() => null);
        if (loginRes && loginRes.user) {
          uid = loginRes.user.uid;
          result = loginRes;
        } else {
          console.error('Unable to obtain UID for existing user', email);
          throw err;
        }
      } else {
        throw err;
      }
    }

    const collectionName =
      profileData.role === 'student' ? 'students' :
      profileData.role === 'teacher' ? 'teachers' :
      profileData.role === 'mentor' ? 'teachers' :
      'admins';

    const now = new Date().toISOString();
    const docData = {
      ...profileData,
      usn,
      email,
      uid,
      createdAt: now,
    };

    // Clean up fields not suitable for Appwrite collections
    delete docData.personalEmail;
    delete docData.isHostelite;
    delete docData.role;
    // Preserve createdAt for student collection (required by schema)
    if (profileData.role !== 'student') delete docData.usn;
    delete docData.class_assignments;
    if (profileData.role === 'teacher' || profileData.role === 'mentor') {
      docData.class_assignments = JSON.stringify(profileData.class_assignments || []);
    }

    await addDocumentWithId(collectionName, uid, docData);

    // Sync role and timestamp to userRoles collection
    await addDocumentWithId('userRoles', uid, {
      name: profileData.name || usn,
      role: profileData.role,
      usn,
      uid,
      createdAt: now,
    });

    // If mentor, update the mentor_id on the assigned classes
    if (profileData.role === 'mentor' && profileData.class_assignments?.length > 0) {
      for (const assignment of profileData.class_assignments) {
        if (assignment.class_id) {
          try {
            await updateDocument('classes', assignment.class_id, { mentor_id: uid });
          } catch (e) {
            console.error(`Failed to assign mentor to class ${assignment.class_id}:`, e);
          }
        }
      }
    }

    // Sync to Supabase if student (upsert to avoid duplicate errors)
    if (profileData.role === 'student') {
      const { error } = await supabase.from('student_profiles').upsert([
        {
          id: uid,
          name: profileData.name,
          usn,
          email: profileData.personalEmail || null,
          class_id: profileData.class_id || null,
          class_label: profileData.class_label || null,
          mentor_id: profileData.mentor_id || null,
          is_hostelite: profileData.isHostelite || false,
          created_at: now,
        },
      ]);
      if (error) {
        console.error('Failed to sync to Supabase SQL:', error);
        throw error;
      }
    }

    return result;
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
        if (user) {
          let profile = await getMergedProfile(user);
          if (!profile) {
            // Determine role from email or default to student
            const role = user.email.includes('admin') ? 'admin' : user.email.includes('teacher') ? 'teacher' : 'student';
            profile = { uid: user.uid, role, name: user.name || user.email };
          }
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
