import { createContext, useContext, useEffect, useState } from 'react';
import { loginUser, logoutUser, getCurrentUser, createNewUser, updateUserPassword } from '../appwrite/auth';
import { getUserProfile, addDocumentWithId, updateDocument, getAll, getById } from '../appwrite/database';
import { supabase } from '../supabase/config';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const usnToEmail = (usn) => `${usn.toLowerCase()}@campustwin.edu`;

// Helper function to resolve branch code from a user profile
export const getBranchFromProfile = (profile, branchesList) => {
  if (!profile) return null;
  if (profile.branch_id) return profile.branch_id;
  if (profile.department) return profile.department;
  
  if (profile.role === 'student') {
    // 1. Try USN
    if (profile.usn) {
      const upperUsn = profile.usn.toUpperCase();
      const sortedBranches = [...(branchesList || [])].sort((a, b) => b.code.length - a.code.length);
      for (const b of sortedBranches) {
        if (upperUsn.includes(b.code.toUpperCase())) {
          return b.code;
        }
      }
      
      const staticDepts = ['CSE', 'ISE', 'ECE', 'EEE', 'ME', 'CE', 'AIDS', 'AIML', 'CS', 'IS', 'EC', 'EE'];
      const sortedStatic = [...staticDepts].sort((a, b) => b.length - a.length);
      for (const dept of sortedStatic) {
        if (upperUsn.includes(dept)) {
          return dept;
        }
      }
    }
    
    // 2. Try Class ID or Class Label
    const classStr = profile.class_label || profile.class_id;
    if (classStr) {
      const upperClass = classStr.toUpperCase();
      const sortedBranches = [...(branchesList || [])].sort((a, b) => b.code.length - a.code.length);
      for (const b of sortedBranches) {
        if (upperClass.includes(b.code.toUpperCase())) {
          return b.code;
        }
      }
    }
  }
  return null;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [branches, setBranches] = useState([]);
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

    // Resolve class_label, mentor_id, and branch_id dynamically for students if not explicitly set
    if (profile && profile.role === 'student') {
      if (profile.class_id) {
        try {
          const cls = await getById('classes', profile.class_id);
          if (cls) {
            if (!profile.class_label) {
              profile.class_label = cls.label || cls.name || profile.class_id;
            }
            if (!profile.mentor_id && cls.mentor_id) {
              profile.mentor_id = cls.mentor_id;
            }
            if (cls.semester) {
              profile.class_semester = cls.semester;
            }
            if (!profile.branch_id) {
              profile.branch_id = cls.branch || cls.branch_id;
            }
          }
        } catch (err) {
          console.error('Failed to resolve dynamic class/mentor details:', err);
        }
      }

      // Fallback: resolve branch_id from USN
      if (!profile.branch_id && profile.usn) {
        const upperUsn = profile.usn.toUpperCase();
        const staticDepts = ['CSE', 'ISE', 'ECE', 'EEE', 'ME', 'CE', 'AIDS', 'AIML', 'CS', 'IS', 'EC', 'EE'];
        const sortedStatic = [...staticDepts].sort((a, b) => b.length - a.length);
        for (const dept of sortedStatic) {
          if (upperUsn.includes(dept)) {
            profile.branch_id = dept;
            break;
          }
        }
      }
    }

    return profile;
  };

  const applyMaintenanceMode = (profile, branchesList) => {
    if (!profile || profile.role === 'admin') return profile;
    const branchCode = getBranchFromProfile(profile, branchesList);
    if (!branchCode) return profile;

    const branchInfo = branchesList.find(b => b.code === branchCode);
    if (branchInfo) {
      const isStudent = profile.role === 'student';
      const isTeacher = profile.role === 'teacher' || profile.role === 'mentor';
      const blockedByRole = 
        (isStudent && branchInfo.maintenance_students) ||
        (isTeacher && branchInfo.maintenance_teachers);
      const blockedByLegacy = branchInfo.maintenance_mode && !branchInfo.maintenance_students && !branchInfo.maintenance_teachers;

      if (blockedByRole || blockedByLegacy) {
        return {
          ...profile,
          branch_id: profile.branch_id || branchCode,
          maintenance: true,
          maintenance_message: branchInfo.maintenance_message || 'The platform is under maintenance.',
          maintenance_eta: branchInfo.maintenance_eta || ''
        };
      }
    }
    
    // Ensure branch_id is set if resolved
    if (!profile.branch_id && branchCode) {
      return {
        ...profile,
        branch_id: branchCode
      };
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
      if (profile) {
        // Enforce role selection
        const expectedRoles = role === 'teacher' ? ['teacher', 'mentor'] : [role];
        if (!expectedRoles.includes(profile.role)) {
          await logoutUser();
          setCurrentUser(null);
          const error = new Error(`Access denied. Please select the correct login role (you are registered as a ${profile.role}).`);
          error.isRoleMismatch = true;
          throw error;
        }
      } else {
        // Fallback if DB document is missing
        profile = { uid: user.uid, role, name: user.name || usn };
      }
      
      // Check maintenance mode on login
      const branchesData = await getAll('branches');
      setBranches(branchesData);
      profile = applyMaintenanceMode(profile, branchesData);
      
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
    delete docData.phone;

    if (profileData.role !== 'admin') {
      delete docData.role;
    }
    
    if (profileData.role === 'teacher' || profileData.role === 'mentor') {
      delete docData.usn;
      delete docData.branch_id;
    }
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
      branch_id: profileData.branch_id || '',
      is_super_admin: !!profileData.is_super_admin,
      must_change_password: profileData.role === 'admin' ? false : (profileData.must_change_password !== undefined ? !!profileData.must_change_password : true),
      phone: profileData.phone || '',
      email: profileData.personalEmail || profileData.email || '',
      initial_password: password,
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
      let profile = null;
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
        if (user) {
          profile = await getMergedProfile(user);
          if (!profile) {
            // Determine role from email or default to student
            const role = user.email.includes('admin') ? 'admin' : user.email.includes('teacher') ? 'teacher' : 'student';
            profile = { uid: user.uid, role, name: user.name || user.email };
          }
        }
        
        const branchesData = await getAll('branches');
        setBranches(branchesData);
        
        if (profile) {
          profile = applyMaintenanceMode(profile, branchesData);
          setUserProfile(profile);
        }
      } catch (err) {
        console.warn("Not logged in");
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  // Re-check maintenance status periodically so changes take effect without re-login
  useEffect(() => {
    if (!currentUser || !userProfile) return;
    const interval = setInterval(async () => {
      try {
        const branchesData = await getAll('branches');
        setBranches(branchesData);
        setUserProfile(prev => {
          if (!prev) return prev;
          // Strip old maintenance fields before re-applying
          const { maintenance, maintenance_message, maintenance_eta, ...cleanProfile } = prev;
          return applyMaintenanceMode(cleanProfile, branchesData);
        });
      } catch (err) {
        // Silently ignore — will retry on next interval
      }
    }, 300000); // every 5 minutes – prevents aggressive re-renders that reset UI state
    return () => clearInterval(interval);
  }, [currentUser, userProfile?.role, userProfile?.branch_id]);

  const value = {
    currentUser,
    userProfile,
    setUserProfile,
    branches,
    loading,
    login,
    logout,
    createUser,
    changeUserPassword: updateUserPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
