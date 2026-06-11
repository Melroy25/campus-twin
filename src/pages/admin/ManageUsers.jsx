import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { deleteUserFromAuth } from '../../appwrite/auth';
import { listenClasses, queryDocuments, deleteDocument, getAll, updateDocument } from '../../appwrite/database';
import { supabase } from '../../supabase/config';
import { sendCredentialsEmail } from '../../utils/email';
import { toast } from 'react-hot-toast';
import { MdAdd, MdDelete, MdPerson, MdClose, MdGroup, MdSearch, MdFileUpload, MdEdit, MdSave, MdLockReset, MdVpnKey, MdLock } from 'react-icons/md';
import { decryptPasswordWithSystemKey, decryptText, encryptText, hashPassword } from '../../utils/crypto';
import { Query } from 'appwrite';
import * as XLSX from 'xlsx';

const ROLES = ['student', 'teacher', 'admin'];
const DEPARTMENTS = ['CSE', 'ISE', 'ECE', 'EEE', 'ME', 'CE', 'AIDS', 'AIML'];

export default function AdminManageUsers() {
  const { createUser, userProfile, branches, changeUserPassword } = useAuth();
  const [form, setForm] = useState({
    name: '', usn: '', password: '', role: 'student',
    class_id: '', mentor_id: '',
    class_assignments: [],
    personalEmail: '',
    isHostelite: false,
    hostel_type: '',
    department: 'CSE',
    is_super_admin: false,
    phone: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userProfile && !userProfile.is_super_admin) {
      setForm(prev => ({
        ...prev,
        department: userProfile.branch_id || 'CSE'
      }));
    }
  }, [userProfile]);

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'list' | 'bulk' | 'email'

  // For editing
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});

  // For changing password
  const [changingPasswordUser, setChangingPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // For bulk upload
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkClassId, setBulkClassId] = useState('');
  const [bulkStatus, setBulkStatus] = useState({ total: 0, current: 0, logs: [] });

  // For teacher multi-class entry
  const [assignRow, setAssignRow] = useState({ class_id: '', subject: '' });
  const [editAssignRow, setEditAssignRow] = useState({ class_id: '', subject: '' });

  // For credentials email
  const [emailClassId, setEmailClassId] = useState('');
  const [emailStudents, setEmailStudents] = useState([]);
  const [emailPassword, setEmailPassword] = useState('123456');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [emailStatus, setEmailStatus] = useState({ total: 0, current: 0, logs: [], sending: false });
  const [cabinetSettings, setCabinetSettings] = useState([]);

  // Cabinet modal states
  const [activeCabinetUser, setActiveCabinetUser] = useState(null);
  const [activeCabinetDoc, setActiveCabinetDoc] = useState(null);
  const [decryptedCabinetPass, setDecryptedCabinetPass] = useState('');
  const [newCabinetPass, setNewCabinetPass] = useState('');
  const [cabinetResetting, setCabinetResetting] = useState(false);

  useEffect(() => {
    if (!emailClassId) {
      setEmailStudents([]);
      setSelectedStudentIds([]);
      return;
    }
    const fetchStudentsForEmail = async () => {
      try {
        const [supabaseRes, appwriteRoles] = await Promise.all([
          supabase.from('student_profiles').select('*').eq('class_id', emailClassId),
          getAll('userRoles')
        ]);

        if (supabaseRes.error) throw supabaseRes.error;

        const rawStudents = supabaseRes.data || [];
        
        // Filter rawStudents to only those who have must_change_password === true in userRoles
        const rolesMap = {};
        appwriteRoles.forEach(r => {
          rolesMap[r.usn] = r;
        });

        const filtered = rawStudents.filter(student => {
          const roleInfo = rolesMap[student.usn];
          // Only include if they have a role, their role is student, and must_change_password is true
          return roleInfo && roleInfo.role === 'student' && roleInfo.must_change_password === true;
        }).map(student => {
          const roleInfo = rolesMap[student.usn];
          return {
            ...student,
            initialPassword: roleInfo.initial_password || ''
          };
        });

        setEmailStudents(filtered);
        setSelectedStudentIds(filtered.map(s => s.id));
      } catch (err) {
        console.error(err);
        toast.error('Failed to load students for email');
      }
    };
    fetchStudentsForEmail();
  }, [emailClassId]);

  const handleSendEmails = async () => {
    const studentsToSend = emailStudents.filter(s => selectedStudentIds.includes(s.id));
    if (studentsToSend.length === 0) return toast.error('No students selected');

    setEmailStatus({ total: studentsToSend.length, current: 0, logs: [], sending: true });
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < studentsToSend.length; i++) {
      const student = studentsToSend[i];
      if (!student.email) {
        setEmailStatus(prev => ({
          ...prev,
          current: i + 1,
          logs: [...prev.logs, `⚠️ ${student.name} (${student.usn}) skipped (No email ID)`]
        }));
        failCount++;
        continue;
      }

      // Determine password to send: use student's stored initialPassword, fallback to UI field, fallback to default
      const pwd = student.initialPassword || emailPassword || 'CampusTwin123';

      try {
        await sendCredentialsEmail(student.name, student.email, student.usn, pwd, 'student');
        setEmailStatus(prev => ({
          ...prev,
          current: i + 1,
          logs: [...prev.logs, `✅ Credentials sent to ${student.name} (${student.email})`]
        }));
        successCount++;
      } catch (err) {
        setEmailStatus(prev => ({
          ...prev,
          current: i + 1,
          logs: [...prev.logs, `❌ Failed for ${student.name}: ${err.message}`]
        }));
        failCount++;
      }
    }

    setEmailStatus(prev => ({ ...prev, sending: false }));
    toast.success(`Emailing completed! Sent: ${successCount}, Failed/Skipped: ${failCount}`);
  };

  useEffect(() => {
    const unsub = listenClasses((allClasses) => {
      if (userProfile?.is_super_admin) {
        setClasses(allClasses);
      } else {
        const filtered = allClasses.filter(c => c.branch === userProfile?.branch_id || c.branch_id === userProfile?.branch_id);
        setClasses(filtered);
      }
    });
    loadAllUsers();
    return unsub;
  }, [userProfile]);

  const loadAllUsers = async () => {
    const [students, teachers, admins, roles, subjectsData, cabinetData] = await Promise.all([
      getAll('students'),
      getAll('teachers'),
      getAll('admins'),
      getAll('userRoles'),
      getAll('subjects'),
      getAll('cabinetSettings'),
    ]);
    setSubjects(subjectsData);
    setCabinetSettings(cabinetData || []);
    const roleMap = {};
    const usnMap = {};
    const phoneMap = {};
    const emailMap = {};
    roles.forEach((r) => {
      roleMap[r.uid] = r.role;
      usnMap[r.uid] = r.usn;
      phoneMap[r.uid] = r.phone || '';
      emailMap[r.uid] = r.email || '';
    });

    const isSuper = userProfile?.is_super_admin === true;
    const adminBranch = userProfile?.branch_id;

    const parsedTeachers = teachers.map((u) => {
      let class_assignments = [];
      if (u.class_assignments) {
        if (typeof u.class_assignments === 'string') {
          try {
            class_assignments = JSON.parse(u.class_assignments);
          } catch (e) {
            class_assignments = [];
          }
        } else if (Array.isArray(u.class_assignments)) {
          class_assignments = u.class_assignments;
        }
      }
      return {
        ...u,
        class_assignments,
        _collection: 'teachers',
        role: roleMap[u.uid] || 'teacher',
        usn: usnMap[u.uid] || '—',
        phone: phoneMap[u.uid] || '',
        personalEmail: emailMap[u.uid] || '',
      };
    });

    const studentList = students.map((u) => ({
      ...u,
      isHostelite: u.hostel_type === 'boys' || u.hostel_type === 'girls',
      _collection: 'students',
      role: roleMap[u.uid] || 'student',
      usn: u.usn || usnMap[u.uid] || '—',
      phone: phoneMap[u.uid] || '',
      personalEmail: emailMap[u.uid] || '',
    }));
    const teacherList = parsedTeachers;
    const adminList = admins.map((u) => ({
      ...u,
      _collection: 'admins',
      role: roleMap[u.uid] || 'admin',
      usn: u.usn || usnMap[u.uid] || '—',
      phone: phoneMap[u.uid] || '',
      personalEmail: emailMap[u.uid] || '',
    }));

    let filteredStudents = studentList;
    let filteredTeachers = teacherList;
    let filteredAdmins = adminList;

    if (!isSuper) {
      filteredStudents = studentList.filter(s => s.branch_id === adminBranch);
      filteredTeachers = teacherList.filter(t => t.branch_id === adminBranch || t.department === adminBranch);
      filteredAdmins = [];
    }

    setAllUsers([
      ...filteredStudents,
      ...filteredTeachers,
      ...filteredAdmins,
    ]);
  };

  const addAssignment = () => {
    if (!assignRow.class_id || !assignRow.subject.trim()) return toast.error('Select class and enter subject');
    const already = form.class_assignments.find((a) => a.class_id === assignRow.class_id && a.subject === assignRow.subject);
    if (already) return toast.error('Already added');
    setForm((prev) => ({
      ...prev,
      class_assignments: [...prev.class_assignments, { ...assignRow }],
    }));
    setAssignRow({ class_id: '', subject: '' });
  };

  const removeAssignment = (idx) => {
    setForm((prev) => ({
      ...prev,
      class_assignments: prev.class_assignments.filter((_, i) => i !== idx),
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.usn || !form.password || !form.role) return toast.error('Fill all required fields');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      const classObj = classes.find((c) => c.id === form.class_id);
      const profileData = {
        name: form.name,
        role: form.role,
        phone: form.phone || '',
        personalEmail: form.personalEmail || '',
        branch_id: form.role === 'student'
          ? (classObj?.branch || classObj?.branch_id || userProfile?.branch_id)
          : form.role === 'admin'
            ? (form.is_super_admin ? '' : form.department)
            : (form.department || userProfile?.branch_id),
        ...(form.role === 'admin' ? { is_super_admin: !!form.is_super_admin } : {}),
        ...(form.role === 'student' ? {
          class_id: form.class_id,
          class_label: classObj?.label || form.class_id,
          mentor_id: form.mentor_id,
          personalEmail: form.personalEmail,
          isHostelite: form.isHostelite,
          hostel_type: form.hostel_type || '',
          gender: form.hostel_type === 'boys' ? 'male' : form.hostel_type === 'girls' ? 'female' : 'male',
        } : {}),
        ...(form.role === 'teacher' ? {
          class_assignments: form.class_assignments,
          department: form.department || 'CSE',
        } : {}),
      };
      await createUser(form.usn, form.password, profileData);
      toast.success(`${form.role} account created for ${form.name}!`);
      setForm({ name: '', usn: '', password: '', role: 'student', class_id: '', mentor_id: '', class_assignments: [], personalEmail: '', isHostelite: false, hostel_type: '', department: 'CSE', is_super_admin: false, phone: '' });
      setAssignRow({ class_id: '', subject: '' });
      loadAllUsers();
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'USN already registered' : err.message;
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setEditForm({ 
      ...user,
      department: user.branch_id || user.department || 'CSE'
    });
  };

  const addEditAssignment = () => {
    if (!editAssignRow.class_id || (editingUser?.role === 'teacher' && !editAssignRow.subject.trim())) {
      return toast.error('Select class and enter subject');
    }
    const assignments = editForm.class_assignments || [];
    const already = assignments.find((a) => a.class_id === editAssignRow.class_id && a.subject === editAssignRow.subject);
    if (already) return toast.error('Already added');
    setEditForm((prev) => ({
      ...prev,
      class_assignments: [...assignments, { ...editAssignRow }],
    }));
    setEditAssignRow({ class_id: '', subject: '' });
  };

  const removeEditAssignment = (idx) => {
    setEditForm((prev) => ({
      ...prev,
      class_assignments: (prev.class_assignments || []).filter((_, i) => i !== idx),
    }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const classObj = classes.find((c) => c.id === editForm.class_id);
      const isTeacher = editingUser.role === 'teacher';
      
      let finalAssignments = editForm.class_assignments || [];
      // Proactively capture pending selection in dropdowns if user forgot to click "+ Add"
      if (isTeacher && editAssignRow.class_id) {
        const hasSubject = editAssignRow.subject && editAssignRow.subject.trim();
        if (hasSubject) {
          const already = finalAssignments.find(
            (a) => a.class_id === editAssignRow.class_id && a.subject === editAssignRow.subject
          );
          if (!already) {
            finalAssignments = [...finalAssignments, { ...editAssignRow }];
          }
        }
      }

      let updateData = {};
      if (editingUser.role === 'student') {
        updateData = {
          name: editForm.name,
          branch_id: classObj?.branch || classObj?.branch_id || editingUser.branch_id || userProfile?.branch_id || '',
          class_id: editForm.class_id || '',
          class_label: classObj?.label || editForm.class_id || '',
          mentor_id: editForm.mentor_id || '',
          hostel_type: editForm.hostel_type || '',
          gender: editForm.hostel_type === 'boys' ? 'male' : editForm.hostel_type === 'girls' ? 'female' : (editForm.gender || 'male'),
        };
      } else if (editingUser.role === 'admin') {
        updateData = {
          name: editForm.name,
          branch_id: editForm.is_super_admin ? '' : (editForm.department || ''),
          is_super_admin: !!editForm.is_super_admin,
        };
      } else {
        updateData = {
          name: editForm.name,
          department: editForm.department || editingUser.department || editingUser.branch_id || userProfile?.branch_id || '',
          class_assignments: JSON.stringify(finalAssignments),
        };
      }
      
      await updateDocument(editingUser._collection, editingUser.id, updateData);
      
      // Sync user details to central userRoles collection
      const rolesDocs = await queryDocuments('userRoles', [Query.equal('uid', editingUser.uid || editingUser.id)]);
      if (rolesDocs.length > 0) {
        await updateDocument('userRoles', rolesDocs[0].$id, {
          name: editForm.name,
          branch_id: (editingUser.role === 'admin' ? (editForm.is_super_admin ? '' : (editForm.department || '')) : (updateData.branch_id || updateData.department || '')),
          is_super_admin: !!updateData.is_super_admin,
          phone: editForm.phone || '',
          email: editForm.personalEmail || '',
        });
      } else {
        await updateDocument('userRoles', editingUser.id, {
          name: editForm.name,
          branch_id: (editingUser.role === 'admin' ? (editForm.is_super_admin ? '' : (editForm.department || '')) : (updateData.branch_id || updateData.department || '')),
          is_super_admin: !!updateData.is_super_admin,
          phone: editForm.phone || '',
          email: editForm.personalEmail || '',
        });
      }

      if (editingUser.role === 'student') {
        const { error } = await supabase
          .from('student_profiles')
          .update({
            name: editForm.name,
            class_id: editForm.class_id || null,
            class_label: classObj?.label || editForm.class_id || null,
            mentor_id: editForm.mentor_id || null,
            email: editForm.personalEmail || null,
            is_hostelite: editForm.isHostelite || false,
          })
          .eq('id', editingUser.id);
        if (error) console.error('Failed to sync update to Supabase SQL:', error);
      }



      toast.success('User updated successfully!');
      setEditingUser(null);
      loadAllUsers();
    } catch (err) {
      toast.error('Failed to update user');
    } finally { setLoading(false); }
  };

  const handleDeleteUser = async (user) => {
    if (user.is_super_admin || user.usn === 'admin' || (user.uid || user.id) === '6a0e19cb002f44b57eef') {
      toast.error('The primary Super Admin account cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete user "${user.name}" (${user.usn})?`)) return;
    try {
      // 1. Delete database documents
      await deleteDocument(user._collection, user.id);
      const rolesDocs = await queryDocuments('userRoles', [Query.equal('uid', user.uid || user.id)]);
      if (rolesDocs.length > 0) {
        await deleteDocument('userRoles', rolesDocs[0].$id);
      } else {
        await deleteDocument('userRoles', user.id).catch(() => {});
      }
      
      if (user.role === 'student') {
        const { error } = await supabase
          .from('student_profiles')
          .delete()
          .eq('id', user.id);
        if (error) console.error('Failed to delete from Supabase SQL:', error);
      }



      // 2. Delete Auth account using serverless cleanup function
      try {
        await deleteUserFromAuth(user.id || user.uid);
        toast.success('User successfully deleted from database & auth!');
      } catch (authErr) {
        console.warn('Auth cleanup failed, database record was deleted:', authErr);
        toast.success('User deleted from database (auth account needs direct console cleanup).');
      }

      loadAllUsers();
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  const handleRevealCabinetPassword = (user, cabinetDoc) => {
    setActiveCabinetUser(user);
    setActiveCabinetDoc(cabinetDoc);
    setDecryptedCabinetPass('');
    setNewCabinetPass('');
  };

  const revealPassword = async () => {
    try {
      const raw = await decryptPasswordWithSystemKey(activeCabinetDoc.encrypted_password);
      setDecryptedCabinetPass(raw);
      toast.success("Cabinet password decrypted!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to decrypt password.");
    }
  };

  const reencryptCabinet = async () => {
    if (newCabinetPass.length < 6) {
      return toast.error("Password must be at least 6 characters.");
    }
    setCabinetResetting(true);
    const loadToast = toast.loading("Fetching files...");
    try {
      // 1. Get old password
      const oldPass = await decryptPasswordWithSystemKey(activeCabinetDoc.encrypted_password);
      const uid = activeCabinetUser.uid || activeCabinetUser.id;

      // 2. Fetch all folders and files for user
      const rawFolders = await queryDocuments('documentFolders', [Query.equal('uid', uid)]);
      const rawDocs = await queryDocuments('userDocuments', [Query.equal('uid', uid)]);

      toast.loading("Re-encrypting folders...", { id: loadToast });

      // 3. Re-encrypt folders
      for (const folder of rawFolders) {
        let decName;
        try {
          decName = await decryptText(folder.name, oldPass);
        } catch (e) {
          continue; // Skip corrupt
        }
        const encName = await encryptText(decName, newCabinetPass);
        await updateDocument('documentFolders', folder.$id || folder.id, {
          name: encName
        });
      }

      toast.loading("Re-encrypting documents...", { id: loadToast });

      // 4. Re-encrypt documents
      for (const doc of rawDocs) {
        let decName, decUrl;
        try {
          decName = await decryptText(doc.name, oldPass);
          decUrl = await decryptText(doc.url, oldPass);
        } catch (e) {
          continue; // Skip corrupt
        }
        const encName = await encryptText(decName, newCabinetPass);
        const encUrl = await encryptText(decUrl, newCabinetPass);
        await updateDocument('userDocuments', doc.$id || doc.id, {
          name: encName,
          url: encUrl
        });
      }

      toast.loading("Saving new credentials...", { id: loadToast });

      // 5. Save settings with new hash and encrypted key
      const newHash = await hashPassword(newCabinetPass);
      const newEncrypted = await encryptPasswordWithSystemKey(newCabinetPass);

      await updateDocument('cabinetSettings', activeCabinetDoc.id || activeCabinetDoc.$id, {
        password_hash: newHash,
        encrypted_password: newEncrypted,
        reset_requested: false
      });

      toast.success("Password updated and documents re-encrypted successfully!", { id: loadToast });
      setActiveCabinetUser(null);
      loadAllUsers();
    } catch (err) {
      console.error(err);
      toast.error("Re-encryption failed: " + err.message, { id: loadToast });
    } finally {
      setCabinetResetting(false);
    }
  };

  const wipeUserCabinet = async () => {
    if (!window.confirm(`⚠️ DANGER: This will permanently wipe all folders and files for ${activeCabinetUser.name}. This is irreversible. Confirm wipe?`)) return;
    setCabinetResetting(true);
    const loadToast = toast.loading("Wiping cabinet contents...");
    try {
      const uid = activeCabinetUser.uid || activeCabinetUser.id;
      
      const rawFolders = await queryDocuments('documentFolders', [Query.equal('uid', uid)]);
      for (const folder of rawFolders) {
        await deleteDocument('documentFolders', folder.$id);
      }

      const rawDocs = await queryDocuments('userDocuments', [Query.equal('uid', uid)]);
      for (const doc of rawDocs) {
        await deleteDocument('userDocuments', doc.$id);
      }

      await deleteDocument('cabinetSettings', activeCabinetDoc.id || activeCabinetDoc.$id);

      toast.success("Cabinet wiped clean successfully!", { id: loadToast });
      setActiveCabinetUser(null);
      loadAllUsers();
    } catch (err) {
      console.error(err);
      toast.error("Wipe failed.", { id: loadToast });
    } finally {
      setCabinetResetting(false);
    }
  };

  const handleOpenChangePasswordModal = (user) => {
    if (user.is_super_admin || user.usn === 'admin' || (user.uid || user.id) === '6a0e19cb002f44b57eef') {
      toast.error('The Super Admin password cannot be changed from here.');
      return;
    }
    setChangingPasswordUser(user);
    setNewPassword('');
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setUpdatingPassword(true);
    try {
      await changeUserPassword(changingPasswordUser.uid || changingPasswordUser.id, newPassword);
      toast.success(`Password updated successfully for ${changingPasswordUser.name}!`);
      setChangingPasswordUser(null);
      setNewPassword('');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleResetRegistration = async (user) => {
    if (!window.confirm(`Reset course registration for "${user.name}" (${user.usn})? This will clear their registered subjects and allow them to register again (one-time).`)) return;
    try {
      await updateDocument('students', user.id, {
        registered_subjects: '[]'
      });
      toast.success(`Course registration reset for ${user.name}. They can now register again.`);
      loadAllUsers();
    } catch (err) {
      console.error('Failed to reset registration:', err);
      toast.error('Failed to reset registration');
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile || !bulkClassId) return toast.error('Select file and target class');
    
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) throw new Error('Excel sheet is empty');
        
        const classObj = classes.find(c => c.id === bulkClassId);
        setBulkStatus({ total: data.length, current: 0, logs: [] });

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const name = row.Name || row.name || row.NAME;
          const usn = row.usn || row.USN || row.Usn;
          const password = String(row.password || row.PASSWORD || row.Password || 'CampusTwin123');
          const emailVal = row.email || row.Email || row.EMAIL || '';
          const phoneVal = String(row.phone || row.Phone || row.PHONE || row.mobile || row.Mobile || row.MOBILE || '').trim();
          
          // Parse hostelite column — accepts "boys", "girls", "yes"/"true" (defaults to boys), or "no"/"none"
          let hosteliteVal = false;
          let hostelType = '';
          const hosteliteKey = Object.keys(row).find(k => k.toLowerCase() === 'hostelite');
          if (hosteliteKey) {
            const h = String(row[hosteliteKey]).toLowerCase().trim();
            if (h === 'boys' || h === 'boy') {
              hosteliteVal = true;
              hostelType = 'boys';
            } else if (h === 'girls' || h === 'girl') {
              hosteliteVal = true;
              hostelType = 'girls';
            } else if (h === 'true' || h === 'yes' || h === '1') {
              hosteliteVal = true;
              hostelType = 'boys'; // default to boys if just "yes"
            }
          }
          
          if (!name || !usn) {
            setBulkStatus(prev => ({ ...prev, logs: [...prev.logs, `Row ${i+1}: Missing Name or USN (Skipped)`] }));
            continue;
          }

          try {
            await createUser(usn, password, {
              name,
              role: 'student',
              class_id: bulkClassId,
              class_label: classObj?.label || bulkClassId,
              personalEmail: emailVal,
              isHostelite: hosteliteVal,
              hostel_type: hostelType,
              gender: hostelType === 'boys' ? 'male' : hostelType === 'girls' ? 'female' : 'male',
              phone: phoneVal,
              must_change_password: true,
            });
            const hostelTag = hostelType ? ` [${hostelType} hostel]` : '';
            setBulkStatus(prev => ({ ...prev, current: i + 1, logs: [...prev.logs, `✅ ${name} (${usn}) created${hostelTag}`] }));
          } catch (err) {
            setBulkStatus(prev => ({ ...prev, current: i + 1, logs: [...prev.logs, `❌ ${name}: ${err.message}`] }));
          }
        }
        toast.success('Bulk upload complete!');
        loadAllUsers();
      } catch (err) {
        toast.error('Error reading Excel file: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(bulkFile);
  };

  const mentors = allUsers.filter((u) => u.role === 'teacher');
  
  const filteredUsers = allUsers.filter((u) => {
    const matchesSearch = 
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.usn || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.role || '').toLowerCase().includes(search.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesBranch = branchFilter === 'all' || u.branch_id === branchFilter || u.department === branchFilter;
    
    return matchesSearch && matchesRole && matchesBranch;
  });

  return (
    <Layout pageTitle="Manage Users">
      <h1 className="page-title">Manage Users</h1>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>Create and manage all system user credentials</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'create', label: '➕ Create Account' },
          { id: 'bulk', label: '📁 Bulk Import' },
          { id: 'list', label: `👥 User Directory (${allUsers.length})` },
          { id: 'email', label: '✉️ Send Credentials' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
            style={activeTab === tab.id ? {
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
              border: 'none',
              boxShadow: 'var(--shadow-sm)'
            } : {}}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Collapsible Info / User Role Framework */}
          <details style={{ background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
            <summary style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', outline: 'none', userSelect: 'none' }}>
              💡 View User Role Framework Guide (Click to show/hide details)
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              {[
                { r: 'student', title: 'Student', desc: 'Assigned to a specific class section and academic advisor (mentor). Accesses attendance, marks, and updates personal profiles.', color: 'var(--success)' },
                { r: 'teacher', title: 'Teacher / Mentor', desc: 'Act as instructors or mentors. Manage classes, mark attendance, record internal grades, and approve student AICTE points.', color: 'var(--primary)' },
                { r: 'admin', title: 'Administrator', desc: 'Manage users, branches, schedules. Can be elevated to Super Admin (global scope) or Branch Admin (scope restricted to their branch).', color: 'var(--danger)' },
              ].map(role => (
                <div key={role.r} style={{ padding: 12, background: 'var(--surface)', borderLeft: `3px solid ${role.color}`, borderRadius: '4px', boxShadow: 'var(--shadow-sm)', cursor: 'default' }}>
                  <div className="flex-between" style={{ marginBottom: 4 }}>
                    <span className="font-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{role.title}</span>
                    <span className="badge badge-sm" style={{ background: `${role.color}15`, color: role.color, fontSize: '0.7rem' }}>{role.r}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {role.desc}
                  </div>
                </div>
              ))}
            </div>
          </details>

          {/* Form Card (takes full 100% width for spacious fields) */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 20 }}><MdAdd /> Create User Profile</h3>
            <form onSubmit={handleCreate}>
              {/* Row 1: Core Credentials (spacious 5-column responsive layout) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Full Name *</label>
                  <input className="form-control" placeholder="e.g. John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Role *</label>
                  <select className="form-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {ROLES.filter(r => userProfile?.is_super_admin || r !== 'admin').map((r) => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">USN / Username *</label>
                  <input className="form-control" placeholder="e.g. 4SF21CS001" value={form.usn} onChange={(e) => setForm({ ...form, usn: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Password *</label>
                  <input type="password" className="form-control" placeholder="Min 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Phone Number *</label>
                  <input className="form-control" placeholder="e.g. +91 9988776655" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Personal Email</label>
                  <input type="email" className="form-control" placeholder="student@example.com" value={form.personalEmail} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} />
                </div>
              </div>

              {/* Row 2: Student fields (spacious 4-column responsive layout) */}
              {form.role === 'student' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: 16, alignItems: 'end', marginTop: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Class Section *</label>
                    <select className="form-control" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                      <option value="">— Select Class —</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Assign Mentor</label>
                    <select className="form-control" value={form.mentor_id} onChange={(e) => setForm({ ...form, mentor_id: e.target.value })}>
                      <option value="">— Select Mentor —</option>
                      {mentors.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.usn})</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Hostel Portal Access</label>
                    <select
                      className="form-control"
                      value={form.hostel_type || (form.isHostelite ? 'boys' : 'none')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'none') {
                          setForm({ ...form, isHostelite: false, hostel_type: '' });
                        } else {
                          setForm({ ...form, isHostelite: true, hostel_type: val });
                        }
                      }}
                    >
                      <option value="none">Not a Hostelite (No Access)</option>
                      <option value="boys">Boys Hostel Block</option>
                      <option value="girls">Girls Hostel Block</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Row 2: Teacher fields */}
              {form.role === 'teacher' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: 16, marginTop: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Department *</label>
                    <select 
                      className="form-control" 
                      value={form.department || 'CSE'} 
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      disabled={!userProfile?.is_super_admin}
                    >
                      {userProfile?.is_super_admin ? (
                        branches.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)
                      ) : (
                        <option value={userProfile?.branch_id}>{userProfile?.branch_id}</option>
                      )}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{form.role === 'teacher' ? 'Class & Subject Assignments' : 'Class Assignments'}</label>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', background: 'var(--surface-2)' }}>
                      {form.class_assignments.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, maxHeight: 80, overflowY: 'auto' }}>
                          {form.class_assignments.map((a, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--primary-light)', color: 'var(--primary-dark)', borderRadius: 4, fontSize: '0.8rem' }}>
                              <span><strong>{classes.find(c => c.id === a.class_id)?.label || a.class_id}</strong> {a.subject && `(${a.subject})`}</span>
                              <button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }} onClick={() => removeAssignment(i)}><MdClose size={16} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select className="form-control" style={{ flex: 1, padding: '8px 12px', fontSize: '0.88rem' }} value={assignRow.class_id} onChange={(e) => setAssignRow({ class_id: e.target.value, subject: '' })}>
                          <option value="">Select Class Section…</option>
                          {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        {form.role === 'teacher' && (
                          <select 
                            className="form-control" 
                            style={{ flex: 1, padding: '8px 12px', fontSize: '0.88rem' }} 
                            value={assignRow.subject} 
                            onChange={(e) => setAssignRow({ ...assignRow, subject: e.target.value })}
                            disabled={!assignRow.class_id}
                          >
                            <option value="">Select Subject…</option>
                            {(() => {
                              const targetClass = classes.find(c => c.id === assignRow.class_id);
                              let allocatedIds = [];
                              if (targetClass && targetClass.subject_ids) {
                                try {
                                  allocatedIds = typeof targetClass.subject_ids === 'string'
                                    ? JSON.parse(targetClass.subject_ids)
                                    : targetClass.subject_ids;
                                } catch (e) {
                                  allocatedIds = [];
                                }
                              }
                              const filtered = subjects.filter(sub => allocatedIds.includes(sub.id || sub.$id));
                              return filtered.map(sub => (
                                <option key={sub.id || sub.$id} value={sub.courseName}>{sub.courseName} ({sub.courseCode})</option>
                              ));
                            })()}
                          </select>
                        )}
                        <button type="button" className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={addAssignment}><MdAdd /> Add Assignment</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 2: Admin fields */}
              {form.role === 'admin' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 16, alignItems: 'center', marginTop: 8 }}>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, marginBottom: 0 }}>
                    <input 
                      type="checkbox" 
                      id="isSuperAdmin" 
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                      checked={form.is_super_admin} 
                      onChange={(e) => setForm({ 
                        ...form, 
                        is_super_admin: e.target.checked,
                        department: e.target.checked ? '' : 'CSE'
                      })} 
                    />
                    <label htmlFor="isSuperAdmin" style={{ cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, userSelect: 'none' }}>Is Super Admin? (Full Scope Access)</label>
                  </div>
                  
                  {!form.is_super_admin && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Branch / Department *</label>
                      <select 
                        className="form-control" 
                        value={form.department || 'CSE'} 
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                      >
                        {branches.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 16, padding: '12px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', fontWeight: 600, fontSize: '0.95rem' }} disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'bulk' && (
        <>
          <div className="card" style={{ padding: 18 }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}><MdFileUpload /> Excel Bulk Import</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ padding: '5px 14px', fontSize: '0.78rem', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                onClick={() => {
                  const templateData = [
                    { 'Sl No': 1, Name: 'John Doe', USN: '4SO24CS001', Password: 'CampusTwin123', Email: 'john@example.com', Hostelite: 'boys', Phone: '+919988776655' },
                    { 'Sl No': 2, Name: 'Jane Smith', USN: '4SO24CS002', Password: 'CampusTwin123', Email: 'jane@example.com', Hostelite: 'girls', Phone: '+919988776656' },
                    { 'Sl No': 3, Name: 'Alex Kumar', USN: '4SO24CS003', Password: 'CampusTwin123', Email: '', Hostelite: 'no', Phone: '+919988776657' },
                  ];
                  const ws = XLSX.utils.json_to_sheet(templateData);
                  ws['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 10 }, { wch: 16 }];
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Students');
                  XLSX.writeFile(wb, 'student_import_template.xlsx');
                  toast.success('Template downloaded!');
                }}
              >
                ⬇ Download Template
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Upload an Excel spreadsheet with columns: <strong>Sl No</strong>, <strong>Name</strong>, <strong>USN</strong>, <strong>Password</strong>, <strong>Email</strong>, <strong>Hostelite</strong>, and <strong>Phone</strong>.
            </p>
            <form onSubmit={handleBulkUpload}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ marginBottom: 4 }}>Target Class *</label>
                  <select className="form-control" style={{ padding: '8px 12px' }} value={bulkClassId} onChange={(e) => setBulkClassId(e.target.value)}>
                    <option value="">— Select Class —</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ marginBottom: 4 }}>Excel File (.xlsx) *</label>
                  <input type="file" className="form-control" style={{ padding: '6px 12px', fontSize: '0.85rem' }} accept=".xlsx, .xls" onChange={(e) => setBulkFile(e.target.files[0])} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-block" style={{ padding: '10px', marginTop: 12 }} disabled={loading || !bulkFile || !bulkClassId}>
                {loading ? 'Processing...' : 'Start Import'}
              </button>
            </form>

            {bulkStatus.total > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="flex-between mb-4">
                  <span className="font-semibold" style={{ fontSize: '0.8rem' }}>Progress: {bulkStatus.current} / {bulkStatus.total}</span>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>{Math.round((bulkStatus.current / bulkStatus.total) * 100)}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', width: `${(bulkStatus.current / bulkStatus.total) * 100}%`, transition: 'width 0.3s' }} />
                </div>
                <div style={{ marginTop: 10, maxHeight: 110, overflowY: 'auto', background: 'var(--surface-2)', padding: 8, borderRadius: 6, fontSize: '0.75rem', fontFamily: 'monospace', border: '1px solid var(--border)' }}>
                  {bulkStatus.logs.map((log, i) => <div key={i} style={{ marginBottom: 2 }}>{log}</div>)}
                </div>
              </div>
            )}
          </div>
          
          <div className="card" style={{ padding: 18, background: 'var(--surface-2)' }}>
            <h3 style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>📖 Upload Guide</h3>
            <div style={{ overflowX: 'auto', marginTop: 12, marginBottom: 14 }}>
              <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-1)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Column</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Required</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '5px 10px', fontWeight: 600 }}>Sl No</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>Optional</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>Serial number (auto-ignored, for reference only)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '5px 10px', fontWeight: 600 }}>Name</td>
                    <td style={{ padding: '5px 10px', color: 'var(--success, green)' }}>✅ Yes</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>Full name of the student</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '5px 10px', fontWeight: 600 }}>USN</td>
                    <td style={{ padding: '5px 10px', color: 'var(--success, green)' }}>✅ Yes</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>University Seat Number (used as login ID)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '5px 10px', fontWeight: 600 }}>Password</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>Optional</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>Login password (defaults to <code>CampusTwin123</code> if empty. Forced change on first login)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '5px 10px', fontWeight: 600 }}>Email</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>Optional</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>Personal email address of the student</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '5px 10px', fontWeight: 600 }}>Hostelite</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>Optional</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>Enter <strong>boys</strong>, <strong>girls</strong>, or <strong>no</strong>. Assigns hostel portal access and gender automatically.</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5px 10px', fontWeight: 600 }}>Phone</td>
                    <td style={{ padding: '5px 10px', color: 'var(--success, green)' }}>✅ Yes</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>Registered phone number used for first login SMS OTP verification (e.g. <code>+919988776655</code>)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul style={{ fontSize: '0.78rem', color: 'var(--text-muted)', paddingLeft: 16, marginTop: 0, lineHeight: 1.6 }}>
              <li style={{ marginBottom: 4 }}>All accounts are assigned as <strong>Students</strong> to the selected target class/section.</li>
              <li style={{ marginBottom: 4 }}>Duplicate USNs are automatically skipped to protect existing accounts.</li>
              <li>Click <strong>"Download Template"</strong> above to get a ready-to-fill Excel file.</li>
            </ul>
          </div>
        </>
      )}

      {activeTab === 'list' && (
        <div className="card" style={{ padding: 16 }}>
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <MdSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                className="form-control" 
                style={{ paddingLeft: 36, paddingRight: 12, paddingVertical: 8, fontSize: '0.88rem' }} 
                placeholder="Search name, USN, or role..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
            
            {/* Role Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Role:</span>
              <select 
                className="form-control" 
                style={{ width: 110, padding: '6px 10px', fontSize: '0.85rem' }} 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Branch Filter (only visible for super admins) */}
            {userProfile?.is_super_admin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Branch:</span>
                <select 
                  className="form-control" 
                  style={{ width: 110, padding: '6px 10px', fontSize: '0.85rem' }} 
                  value={branchFilter} 
                  onChange={(e) => setBranchFilter(e.target.value)}
                >
                  <option value="all">All Branches</option>
                  {branches.map(b => (
                    <option key={b.code} value={b.code}>{b.code}</option>
                  ))}
                </select>
              </div>
            )}

            <button 
              className="btn btn-ghost btn-sm" 
              style={{ padding: '7px 12px', fontSize: '0.82rem', height: 36 }} 
              onClick={() => { setSearch(''); setRoleFilter('all'); setBranchFilter('all'); loadAllUsers(); }}
            >
              ↺ Reset
            </button>
          </div>

          {/* Table Container with fixed height and sticky header */}
          <div 
            className="table-wrapper" 
            style={{ 
              overflowY: 'auto', 
              maxHeight: 'calc(100vh - 280px)',
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-sm)',
              position: 'relative'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '12px 16px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '12px 16px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>USN / Username</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '12px 16px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role / Scope</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '12px 16px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Class / Assignment</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '12px 16px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                      No users found matching your search and filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} style={{ transition: 'background 0.2s' }}>
                      <td className="font-semibold" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{u.name}</span>
                          {(() => {
                            const userCabinet = cabinetSettings.find(c => c.uid === (u.uid || u.id));
                            return userCabinet?.reset_requested && (
                              <span 
                                className="badge" 
                                style={{ 
                                  background: '#ef4444', 
                                  color: 'white', 
                                  fontSize: '0.65rem', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
                                }}
                                title="User requested cabinet password recovery"
                              >
                                Cabinet Reset Req.
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.usn}</td>
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)' }}>
                        {u.role === 'admin' ? (
                          u.is_super_admin ? (
                            <span className="badge" style={{ background: 'linear-gradient(135deg, #4f6ef7 0%, #a855f7 100%)', color: 'white', fontWeight: 600, padding: '2px 8px', fontSize: '0.72rem', borderRadius: 4 }}>Super Admin</span>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span className="badge badge-primary" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '2px 6px', fontSize: '0.72rem', borderRadius: 4 }}>Branch Admin</span>
                              {u.branch_id && <span className="badge badge-ghost" style={{ padding: '2px 6px', fontSize: '0.72rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4 }}>{u.branch_id}</span>}
                            </div>
                          )
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span className={`badge badge-${u.role === 'teacher' ? 'primary' : 'approved'}`} style={{ padding: '2px 6px', fontSize: '0.72rem', borderRadius: 4 }}>{u.role}</span>
                            {(u.department || u.branch_id) && <span className="badge badge-ghost" style={{ padding: '2px 6px', fontSize: '0.72rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4 }}>{u.department || u.branch_id}</span>}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {u.role === 'student' && (u.class_label || u.class_id || '—')}
                        {u.role === 'teacher' && (
                          u.class_assignments?.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {u.class_assignments.map((a, i) => (
                                <div key={i} style={{ fontSize: '0.75rem' }}>
                                  <strong>{classes.find(c => c.id === a.class_id)?.label || a.class_id}</strong> {a.subject && `— ${a.subject}`}
                                </div>
                              ))}
                            </div>
                          ) : '—'
                        )}
                        {u.role === 'admin' && <span style={{ color: 'var(--text-muted)' }}>Global College Control</span>}
                      </td>
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(() => {
                            const userCabinet = cabinetSettings.find(c => c.uid === (u.uid || u.id));
                            return userCabinet && (
                              <button 
                                className="btn btn-sm btn-ghost" 
                                style={{ padding: '4px 8px', height: 28, color: userCabinet.reset_requested ? '#ef4444' : 'var(--text-muted)' }} 
                                onClick={() => handleRevealCabinetPassword(u, userCabinet)} 
                                title={userCabinet.reset_requested ? "REVEAL FORGOTTEN CABINET PASSWORD" : "View Cabinet status / Reveal Password"}
                              >
                                <MdVpnKey size={16} />
                              </button>
                            );
                          })()}

                          <button className="btn btn-sm btn-ghost" style={{ padding: '4px 8px', height: 28 }} onClick={() => handleEdit(u)} title="Edit user"><MdEdit size={16} /></button>
                          {u.role === 'student' && (
                            <button className="btn btn-sm btn-ghost" style={{ padding: '4px 8px', height: 28, color: 'var(--warning, #f59e0b)' }} onClick={() => handleResetRegistration(u)} title="Reset Course Registration"><MdLockReset size={16} /></button>
                          )}
                          <button className="btn btn-sm btn-danger" style={{ padding: '4px 8px', height: 28 }} onClick={() => handleDeleteUser(u)} title="Delete user"><MdDelete size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div>
          <div className="card" style={{ padding: 18 }}>
            <h3 className="mb-12" style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>✉  Dispatch Student Credentials</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Email login details (USN & Temp Password) to all selected students of a section.
            </p>
            <div style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Target Section *</label>
                <select className="form-control" style={{ padding: '8px 12px' }} value={emailClassId} onChange={(e) => setEmailClassId(e.target.value)}>
                  <option value="">— Select Class —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>

            {emailClassId && emailStudents.length === 0 && (
              <div style={{
                marginTop: 16,
                padding: '24px 16px',
                textAlign: 'center',
                background: 'rgba(16, 185, 129, 0.04)',
                border: '1px dashed rgba(16, 185, 129, 0.25)',
                borderRadius: '12px',
                color: '#10b981'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>All Caught Up!</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                  All student accounts in this section have already changed their password or have no pending credentials to dispatch.
                </div>
              </div>
            )}

            {emailStudents.length > 0 && (
              <>
                <div className="flex-between mb-6" style={{ marginTop: 14 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Students ({selectedStudentIds.length} / {emailStudents.length} selected)</span>
                  <button 
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 8px', fontSize: '0.75rem', border: 'none', background: 'var(--surface-2)' }}
                    onClick={() => {
                      if (selectedStudentIds.length === emailStudents.length) setSelectedStudentIds([]);
                      else setSelectedStudentIds(emailStudents.map(s => s.id));
                    }}
                  >
                    {selectedStudentIds.length === emailStudents.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', marginBottom: 12, background: 'var(--surface)' }}>
                  {emailStudents.map(student => (
                    <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedStudentIds.includes(student.id)} 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedStudentIds(prev => [...prev, student.id]);
                          else setSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                        }} 
                      />
                      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {student.name} <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>({student.usn})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            color: '#3b82f6', 
                            background: 'rgba(59, 130, 246, 0.08)', 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontWeight: 600, 
                            fontFamily: 'monospace',
                            border: '1px solid rgba(59, 130, 246, 0.15)'
                          }}>
                            🔑 {student.initialPassword || 'CampusTwin123'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: student.email ? 'var(--text-muted)' : 'var(--danger)', fontWeight: 500 }}>
                            {student.email || '⚠️ Missing email'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  type="button"
                  className="btn btn-primary btn-block" 
                  style={{ padding: '10px' }}
                  onClick={handleSendEmails} 
                  disabled={emailStatus.sending || selectedStudentIds.length === 0}
                >
                  {emailStatus.sending ? 'Sending...' : 'Send Login Details'}
                </button>
              </>
            )}

            {emailStatus.total > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="flex-between mb-4">
                  <span className="font-semibold" style={{ fontSize: '0.8rem' }}>Sending Progress: {emailStatus.current} / {emailStatus.total}</span>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>{Math.round((emailStatus.current / emailStatus.total) * 100)}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', width: `${(emailStatus.current / emailStatus.total) * 100}%`, transition: 'width 0.3s' }} />
                </div>
                <div style={{ marginTop: 10, maxHeight: 110, overflowY: 'auto', background: 'var(--surface-2)', padding: 8, borderRadius: 6, fontSize: '0.75rem', fontFamily: 'monospace', border: '1px solid var(--border)' }}>
                  {emailStatus.logs.map((log, i) => <div key={i} style={{ marginBottom: 2 }}>{log}</div>)}
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 18, background: 'var(--surface-2)' }}>
            <h3 style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>✉️ Dispatch Parameters</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
              By default, this feature will run in <strong>Developer Mock Mode</strong> (it simulates sending and logs details in the progress output).
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
              To connect it to your actual email server, please set up a free account at <strong>EmailJS.com</strong> and add these variables to your <code>.env</code> file:
            </p>
            <ul style={{ fontSize: '0.78rem', fontFamily: 'monospace', paddingLeft: 16, marginTop: 6, color: 'var(--primary)', lineHeight: 1.4 }}>
              <li>VITE_EMAILJS_SERVICE_ID</li>
              <li>VITE_EMAILJS_TEMPLATE_ID</li>
              <li>VITE_EMAILJS_PUBLIC_KEY</li>
            </ul>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, animation: 'slideUp 0.3s ease-out', padding: 20, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <div className="flex-between mb-16" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MdEdit /> Edit Profile: {editingUser.name}</h3>
              <button className="btn btn-ghost" style={{ padding: 4, border: 'none', background: 'none' }} onClick={() => setEditingUser(null)}><MdClose size={20} /></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ marginBottom: 4 }}>Full Name</label>
                  <input className="form-control" style={{ padding: '8px 12px' }} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ marginBottom: 4 }}>USN / Username</label>
                  <input className="form-control" style={{ padding: '8px 12px' }} value={editingUser.usn} disabled />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ marginBottom: 4 }}>Phone Number</label>
                  <input className="form-control" style={{ padding: '8px 12px' }} value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="e.g. +91 9988776655" />
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ marginBottom: 4 }}>Personal Email</label>
                  <input type="email" className="form-control" style={{ padding: '8px 12px' }} value={editForm.personalEmail || ''} onChange={(e) => setEditForm({ ...editForm, personalEmail: e.target.value })} placeholder="e.g. user@example.com" />
                </div>
              </div>
              
              {editingUser.role === 'student' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label" style={{ marginBottom: 4 }}>Class Section</label>
                      <select className="form-control" style={{ padding: '8px 12px' }} value={editForm.class_id} onChange={(e) => setEditForm({ ...editForm, class_id: e.target.value })}>
                        <option value="">— Select Class —</option>
                        {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label" style={{ marginBottom: 4 }}>Assign Mentor</label>
                      <select className="form-control" style={{ padding: '8px 12px' }} value={editForm.mentor_id || ''} onChange={(e) => setEditForm({ ...editForm, mentor_id: e.target.value })}>
                        <option value="">— Select Mentor —</option>
                        {mentors.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.usn})</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label" style={{ marginBottom: 4 }}>Hostel Portal Access</label>
                    <select 
                      className="form-control" 
                      style={{ padding: '8px 12px' }} 
                      value={editForm.hostel_type || (editForm.isHostelite ? 'boys' : 'none')} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'none') {
                          setEditForm({ ...editForm, isHostelite: false, hostel_type: '', gender: editForm.gender || '' });
                        } else {
                          setEditForm({ ...editForm, isHostelite: true, hostel_type: val, gender: val === 'boys' ? 'male' : 'female' });
                        }
                      }}
                    >
                      <option value="none">Not a Hostelite (No Access)</option>
                      <option value="boys">Boys Hostel Block</option>
                      <option value="girls">Girls Hostel Block</option>
                    </select>
                  </div>
                </>
              )}

              {editingUser.role === 'teacher' && (
                <>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label" style={{ marginBottom: 4 }}>Department *</label>
                    <select 
                      className="form-control" 
                      style={{ padding: '8px 12px' }}
                      value={editForm.department || 'CSE'} 
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      disabled={!userProfile?.is_super_admin}
                    >
                      {userProfile?.is_super_admin ? (
                        branches.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)
                      ) : (
                        <option value={userProfile?.branch_id}>{userProfile?.branch_id}</option>
                      )}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label" style={{ marginBottom: 4 }}>Class & Subject Assignments</label>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', background: 'var(--surface-2)' }}>
                      {(editForm.class_assignments || []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, maxHeight: 80, overflowY: 'auto' }}>
                          {(editForm.class_assignments || []).map((a, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--primary-light)', color: 'var(--primary-dark)', borderRadius: 4, fontSize: '0.78rem' }}>
                              <span><strong>{classes.find(c => c.id === a.class_id)?.label || a.class_id}</strong> {a.subject && `(${a.subject})`}</span>
                              <button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }} onClick={() => removeEditAssignment(i)}><MdClose size={14} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select className="form-control" style={{ flex: 1, padding: '6px 10px', fontSize: '0.85rem' }} value={editAssignRow.class_id} onChange={(e) => setEditAssignRow({ class_id: e.target.value, subject: '' })}>
                          <option value="">Class…</option>
                          {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        <select 
                          className="form-control" 
                          style={{ flex: 1, padding: '6px 10px', fontSize: '0.85rem' }} 
                          value={editAssignRow.subject} 
                          onChange={(e) => setEditAssignRow({ ...editAssignRow, subject: e.target.value })}
                          disabled={!editAssignRow.class_id}
                        >
                          <option value="">Subject…</option>
                          {(() => {
                            const targetClass = classes.find(c => c.id === editAssignRow.class_id);
                            let allocatedIds = [];
                            if (targetClass && targetClass.subject_ids) {
                              try {
                                allocatedIds = typeof targetClass.subject_ids === 'string'
                                  ? JSON.parse(targetClass.subject_ids)
                                  : targetClass.subject_ids;
                              } catch (e) {
                                allocatedIds = [];
                              }
                            }
                            const filtered = subjects.filter(sub => allocatedIds.includes(sub.id || sub.$id));
                            return filtered.map(sub => (
                              <option key={sub.id || sub.$id} value={sub.courseName}>{sub.courseName} ({sub.courseCode})</option>
                            ));
                          })()}
                        </select>
                        <button type="button" className="btn btn-sm btn-primary" style={{ padding: '6px 12px' }} onClick={addEditAssignment}><MdAdd /> Add</button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {editingUser.role === 'admin' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center', marginTop: 8 }}>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <input 
                      type="checkbox" 
                      id="editIsSuperAdmin" 
                      checked={!!editForm.is_super_admin} 
                      onChange={(e) => setEditForm({ 
                        ...editForm, 
                        is_super_admin: e.target.checked,
                        department: e.target.checked ? '' : 'CSE',
                        branch_id: e.target.checked ? '' : 'CSE'
                      })} 
                    />
                    <label htmlFor="editIsSuperAdmin" style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>Is Super Admin?</label>
                  </div>
                  
                  {!editForm.is_super_admin && (
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label" style={{ marginBottom: 4 }}>Branch / Department *</label>
                      <select 
                        className="form-control" 
                        style={{ padding: '8px 12px' }}
                        value={editForm.department || editForm.branch_id || 'CSE'} 
                        onChange={(e) => setEditForm({ ...editForm, department: e.target.value, branch_id: e.target.value })}
                      >
                        {branches.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button type="button" className="btn btn-ghost flex-1" style={{ padding: '10px' }} onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" style={{ padding: '10px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }} disabled={loading}><MdSave /> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Cabinet Security Recovery Modal */}
      {activeCabinetUser && activeCabinetDoc && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 460, animation: 'slideUp 0.3s ease-out', padding: 24, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <div className="flex-between mb-16" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MdVpnKey /> Cabinet Security: {activeCabinetUser.name}</h3>
              <button className="btn btn-ghost" style={{ padding: 4, border: 'none', background: 'none' }} onClick={() => setActiveCabinetUser(null)} disabled={cabinetResetting}><MdClose size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Reset request warning */}
              {activeCabinetDoc.reset_requested && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 500 }}>
                  ⚠️ User has submitted a recovery request for their cabinet password.
                </div>
              )}

              {/* Reveal current password */}
              <div className="card" style={{ margin: 0, padding: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Option 1: Retrieve Current password</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Decrypt the user's master key stored with the system-wide key. Share this with the user so they can unlock their files.
                </p>
                {decryptedCabinetPass ? (
                  <div style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--cb-primary)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--cb-primary)', fontSize: '1rem' }}>
                      {decryptedCabinetPass}
                    </span>
                    <button 
                      type="button" className="btn btn-sm btn-outline" style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                      onClick={() => {
                        navigator.clipboard.writeText(decryptedCabinetPass);
                        toast.success("Copied to clipboard!");
                      }}
                    >
                      Copy
                    </button>
                  </div>
                ) : (
                  <button 
                    type="button" className="btn btn-sm btn-outline" style={{ width: '100%' }}
                    onClick={revealPassword} disabled={cabinetResetting}
                  >
                    Decrypt & Reveal Password
                  </button>
                )}
              </div>

              {/* Change / Re-encrypt master password */}
              <div className="card" style={{ margin: 0, padding: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Option 2: Reset Cabinet Password</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Directly set a new password. The panel will decrypt existing documents using the old key and re-encrypt them with the new key automatically.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input 
                    type="text" className="form-control" placeholder="Enter new cabinet password (min 6 chars)..."
                    value={newCabinetPass} onChange={(e) => setNewCabinetPass(e.target.value)} disabled={cabinetResetting}
                    style={{ fontSize: '0.82rem', padding: '8px 12px' }}
                  />
                  <button 
                    type="button" className="btn btn-primary btn-sm" style={{ width: '100%' }}
                    onClick={reencryptCabinet} disabled={cabinetResetting || newCabinetPass.length < 6}
                  >
                    {cabinetResetting ? 'Re-encrypting files...' : 'Change & Re-encrypt'}
                  </button>
                </div>
              </div>

              {/* Wipe Clean */}
              <div className="card" style={{ margin: 0, padding: 14, background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed #ef4444' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>Option 3: Wipe Cabinet Data</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Delete all folders and documents, wiping this user's cabinet clean so they can start fresh.
                </p>
                <button 
                  type="button" className="btn btn-sm" style={{ background: '#ef4444', color: 'white', width: '100%' }}
                  onClick={wipeUserCabinet} disabled={cabinetResetting}
                >
                  Wipe Cabinet Data Completely
                </button>
              </div>

              {/* Close footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <button type="button" className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => setActiveCabinetUser(null)} disabled={cabinetResetting}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Main User Password Modal */}
      {changingPasswordUser && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 400, animation: 'slideUp 0.3s ease-out', padding: 24, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <div className="flex-between mb-16" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MdLock /> Change User Password</h3>
              <button className="btn btn-ghost" style={{ padding: 4, border: 'none', background: 'none' }} onClick={() => setChangingPasswordUser(null)} disabled={updatingPassword}><MdClose size={20} /></button>
            </div>
            
            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                You are updating the login password for <strong>{changingPasswordUser.name}</strong> ({changingPasswordUser.usn || changingPasswordUser.email}).
              </p>
              
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Enter new password (min 6 chars)..."
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  disabled={updatingPassword}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setChangingPasswordUser(null)} disabled={updatingPassword}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={updatingPassword || newPassword.length < 6}>
                  {updatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
