import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { listenClasses, queryDocuments, deleteDocument, getAll, updateDocument } from '../../appwrite/database';
import { supabase } from '../../supabase/config';
import { sendCredentialsEmail } from '../../utils/email';
import { toast } from 'react-hot-toast';
import { MdAdd, MdDelete, MdPerson, MdClose, MdGroup, MdSearch, MdFileUpload, MdEdit, MdSave } from 'react-icons/md';
import * as XLSX from 'xlsx';

const ROLES = ['student', 'teacher', 'admin'];
const DEPARTMENTS = ['CSE', 'ISE', 'ECE', 'EEE', 'ME', 'CE', 'AIDS', 'AIML'];

export default function AdminManageUsers() {
  const { createUser } = useAuth();
  const [form, setForm] = useState({
    name: '', usn: '', password: '', role: 'student',
    class_id: '', mentor_id: '',
    class_assignments: [],
    personalEmail: '',
    isHostelite: false,
    department: 'CSE',
  });
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'list' | 'bulk'

  // For editing
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});

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

  useEffect(() => {
    if (!emailClassId) {
      setEmailStudents([]);
      setSelectedStudentIds([]);
      return;
    }
    const fetchStudentsForEmail = async () => {
      const { data, error } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('class_id', emailClassId);
      if (error) {
        toast.error('Failed to load students for email');
      } else {
        setEmailStudents(data || []);
        setSelectedStudentIds((data || []).map(s => s.id));
      }
    };
    fetchStudentsForEmail();
  }, [emailClassId]);

  const handleSendEmails = async () => {
    const studentsToSend = emailStudents.filter(s => selectedStudentIds.includes(s.id));
    if (studentsToSend.length === 0) return toast.error('No students selected');
    if (!emailPassword) return toast.error('Please enter a password to send');

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

      try {
        await sendCredentialsEmail(student.name, student.email, student.usn, emailPassword);
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
    const unsub = listenClasses(setClasses);
    loadAllUsers();
    return unsub;
  }, []);

  const loadAllUsers = async () => {
    const [students, teachers, admins, roles] = await Promise.all([
      getAll('students'),
      getAll('teachers'),
      getAll('admins'),
      getAll('userRoles'),
    ]);
    const roleMap = {};
    roles.forEach((r) => {
      roleMap[r.uid] = r.role;
    });

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
      };
    });

    setAllUsers([
      ...students.map((u) => ({ ...u, _collection: 'students', role: roleMap[u.uid] || 'student' })),
      ...parsedTeachers,
      ...admins.map((u) => ({ ...u, _collection: 'admins', role: roleMap[u.uid] || 'admin' })),
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
        ...(form.role === 'student' ? {
          class_id: form.class_id,
          class_label: classObj?.label || form.class_id,
          mentor_id: form.mentor_id,
          personalEmail: form.personalEmail,
          isHostelite: form.isHostelite,
        } : {}),
        ...(form.role === 'teacher' || form.role === 'mentor' ? {
          class_assignments: form.class_assignments,
          department: form.role === 'teacher' ? (form.department || 'CSE') : undefined,
        } : {}),
      };
      await createUser(form.usn, form.password, profileData);
      toast.success(`${form.role} account created for ${form.name}!`);
      setForm({ name: '', usn: '', password: '', role: 'student', class_id: '', mentor_id: '', class_assignments: [], personalEmail: '', isHostelite: false, department: 'CSE' });
      setAssignRow({ class_id: '', subject: '' });
      loadAllUsers();
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'USN already registered' : err.message;
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setEditForm({ ...user });
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
      const isTeacherOrMentor = editingUser.role === 'teacher' || editingUser.role === 'mentor';
      const updateData = {
        name: editForm.name,
        ...(editingUser.role === 'student' ? {
          class_id: editForm.class_id,
          class_label: classObj?.label || editForm.class_id,
          mentor_id: editForm.mentor_id,
          personalEmail: editForm.personalEmail || '',
          isHostelite: editForm.isHostelite || false,
        } : {}),
        ...(isTeacherOrMentor ? {
          class_assignments: JSON.stringify(editForm.class_assignments || []),
          department: editForm.department || 'CSE',
        } : {}),
      };
      await updateDocument(editingUser._collection, editingUser.id, updateData);
      
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

      // Sync mentor assignments with classes collection
      if (editingUser.role === 'mentor') {
        const oldAssignments = editingUser.class_assignments || [];
        const newAssignments = editForm.class_assignments || [];
        const oldClassIds = oldAssignments.map(a => a.class_id).filter(Boolean);
        const newClassIds = newAssignments.map(a => a.class_id).filter(Boolean);
        
        // Remove mentor from unassigned classes
        for (const classId of oldClassIds) {
          if (!newClassIds.includes(classId)) {
            try {
              const currentClass = classes.find(c => c.id === classId);
              if (currentClass && (currentClass.mentor_id === editingUser.uid || currentClass.mentor_id === editingUser.id)) {
                await updateDocument('classes', classId, { mentor_id: '' });
              }
            } catch (err) {
              console.error(`Failed to clear mentor from class ${classId}:`, err);
            }
          }
        }
        
        // Add mentor to new classes
        for (const classId of newClassIds) {
          try {
            await updateDocument('classes', classId, { mentor_id: editingUser.uid || editingUser.id });
          } catch (err) {
            console.error(`Failed to assign mentor to class ${classId}:`, err);
          }
        }
      }

      toast.success('User updated successfully!');
      setEditingUser(null);
      loadAllUsers();
    } catch (err) {
      toast.error('Failed to update user');
    } finally { setLoading(false); }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Delete user "${user.name}" (${user.usn})?`)) return;
    try {
      await deleteDocument(user._collection, user.id);
      await deleteDocument('userRoles', user.id);
      
      if (user.role === 'student') {
        const { error } = await supabase
          .from('student_profiles')
          .delete()
          .eq('id', user.id);
        if (error) console.error('Failed to delete from Supabase SQL:', error);
      }

      if (user.role === 'mentor') {
        const assignments = user.class_assignments || [];
        for (const a of assignments) {
          if (a.class_id) {
            try {
              const currentClass = classes.find(c => c.id === a.class_id);
              if (currentClass && (currentClass.mentor_id === user.uid || currentClass.mentor_id === user.id)) {
                await updateDocument('classes', a.class_id, { mentor_id: '' });
              }
            } catch (err) {
              console.error(`Failed to clear mentor from class ${a.class_id}:`, err);
            }
          }
        }
      }

      toast.success('User deleted from database');
      loadAllUsers();
    } catch (err) {
      toast.error('Failed to delete user');
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
          const password = String(row.password || row.PASSWORD || '123456');
          const emailVal = row.email || row.Email || row.EMAIL || '';
          
          let hosteliteVal = false;
          const hosteliteKey = Object.keys(row).find(k => k.toLowerCase() === 'hostelite');
          if (hosteliteKey) {
            const h = String(row[hosteliteKey]).toLowerCase().trim();
            hosteliteVal = h === 'true' || h === 'yes' || h === '1' || row[hosteliteKey] === true;
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
            });
            setBulkStatus(prev => ({ ...prev, current: i + 1, logs: [...prev.logs, `✅ ${name} (${usn}) created`] }));
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

  const mentors = allUsers.filter((u) => u.role === 'teacher' || u.role === 'mentor');
  const filteredUsers = allUsers.filter((u) =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.usn || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout pageTitle="Manage Users">
      <h1 className="page-title">Manage Users</h1>
      <p className="page-subtitle">Create and manage all user accounts</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { id: 'create', label: '➕ Create Account' },
          { id: 'bulk', label: '📁 Bulk Upload' },
          { id: 'list', label: `👥 All Users (${allUsers.length})` },
          { id: 'email', label: '✉️ Send Credentials' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'create' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Form */}
          <div className="card card-lg">
            <h3 className="mb-16"><MdAdd style={{ verticalAlign: 'middle' }} /> Create New Account</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-control" placeholder="e.g. John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">USN / Username *</label>
                <input className="form-control" placeholder="e.g. 4SF21CS001" value={form.usn} onChange={(e) => setForm({ ...form, usn: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input type="password" className="form-control" placeholder="Min 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>

              {/* Student fields */}
              {form.role === 'student' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Class Section *</label>
                    <select className="form-control" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                      <option value="">— Select Class —</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assign Mentor</label>
                    <select className="form-control" value={form.mentor_id} onChange={(e) => setForm({ ...form, mentor_id: e.target.value })}>
                      <option value="">— Select Mentor —</option>
                      {mentors.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.usn})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Personal Email</label>
                    <input type="email" className="form-control" placeholder="student@example.com" value={form.personalEmail} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <input type="checkbox" id="isHostelite" checked={form.isHostelite} onChange={(e) => setForm({ ...form, isHostelite: e.target.checked })} />
                    <label htmlFor="isHostelite" style={{ cursor: 'pointer', fontSize: '0.88rem' }}>Is Student Hostelite?</label>
                  </div>
                </>
              )}

              {/* Teacher / Mentor fields */}
              {(form.role === 'teacher' || form.role === 'mentor') && (
                <>
                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <select className="form-control" value={form.department || 'CSE'} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{form.role === 'teacher' ? 'Class & Subject Assignments' : 'Class Assignments'}</label>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 8 }}>
                    {form.class_assignments.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--primary-light)', borderRadius: 6, fontSize: '0.82rem', marginBottom: 6 }}>
                        <span style={{ flex: 1 }}><strong>{classes.find(c => c.id === a.class_id)?.label || a.class_id}</strong> {a.subject && `— ${a.subject}`}</span>
                        <button type="button" className="btn btn-sm btn-danger" style={{ padding: '2px 6px' }} onClick={() => removeAssignment(i)}><MdClose /></button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <select className="form-control" style={{ flex: 2, minWidth: 140 }} value={assignRow.class_id} onChange={(e) => setAssignRow({ ...assignRow, class_id: e.target.value })}>
                        <option value="">Class…</option>
                        {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      {form.role === 'teacher' && <input className="form-control" style={{ flex: 2, minWidth: 120 }} placeholder="Subject" value={assignRow.subject} onChange={(e) => setAssignRow({ ...assignRow, subject: e.target.value })} />}
                      <button type="button" className="btn btn-sm btn-primary" onClick={addAssignment}><MdAdd /> Add</button>
                    </div>
                  </div>
                </div>
              </>
              )}

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</button>
            </form>
          </div>

          <div className="card">
            <h3 className="mb-16">ℹ️ Account Setup Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ROLES.map(r => (
                <div key={r} style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                  <div className="flex-between"><span className="font-semibold">{r.charAt(0).toUpperCase() + r.slice(1)}</span><span className="badge badge-primary">{r}</span></div>
                  <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                    {r === 'student' ? 'Assigned to a class section and mentor' : r === 'teacher' ? 'Can mark attendance, manage marks, and act as class advisor/mentor to approve AICTE points' : 'Full system access'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bulk' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card card-lg">
            <h3 className="mb-16"><MdFileUpload style={{ verticalAlign: 'middle' }} /> Excel Bulk Upload</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              Upload an <code>.xlsx</code> file with columns: <strong>Name</strong>, <strong>usn</strong>, <strong>password</strong>.
            </p>
            <form onSubmit={handleBulkUpload}>
              <div className="form-group">
                <label className="form-label">Select Target Class *</label>
                <select className="form-control" value={bulkClassId} onChange={(e) => setBulkClassId(e.target.value)}>
                  <option value="">— Select Class —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Excel File (.xlsx) *</label>
                <input type="file" className="form-control" accept=".xlsx, .xls" onChange={(e) => setBulkFile(e.target.files[0])} />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading || !bulkFile || !bulkClassId}>
                {loading ? 'Processing...' : 'Start Bulk Upload'}
              </button>
            </form>

            {bulkStatus.total > 0 && (
              <div style={{ marginTop: 24 }}>
                <div className="flex-between mb-8">
                  <span className="font-semibold">Progress: {bulkStatus.current} / {bulkStatus.total}</span>
                  <span className="text-muted">{Math.round((bulkStatus.current / bulkStatus.total) * 100)}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--primary)', width: `${(bulkStatus.current / bulkStatus.total) * 100}%`, transition: 'width 0.3s' }} />
                </div>
                <div style={{ marginTop: 16, maxHeight: 150, overflowY: 'auto', background: 'var(--surface-2)', padding: 10, borderRadius: 8, fontSize: '0.78rem', fontFamily: 'monospace' }}>
                  {bulkStatus.logs.map((log, i) => <div key={i} style={{ marginBottom: 4 }}>{log}</div>)}
                </div>
              </div>
            )}
          </div>
          
          <div className="card">
            <h3>📖 Instructions</h3>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: 20, marginTop: 12 }}>
              <li style={{ marginBottom: 8 }}>Prepare an Excel file with headers <strong>Name</strong> and <strong>usn</strong>.</li>
              <li style={{ marginBottom: 8 }}>Column <strong>password</strong> is optional (defaults to 123456).</li>
              <li style={{ marginBottom: 8 }}>All students in the file will be assigned to the class you select.</li>
              <li>Existing USNs will be skipped with an error message.</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="card">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <MdSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-control" style={{ paddingLeft: 38 }} placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={loadAllUsers}>↺ Refresh</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>USN</th>
                  <th>Role</th>
                  <th>Class / Assignment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{u.usn}</td>
                    <td>
                      <span className={`badge badge-${u.role === 'admin' ? 'absent' : u.role === 'teacher' ? 'primary' : u.role === 'mentor' ? 'pending' : 'approved'}`}>{u.role}</span>
                      {u.department && <span className="badge badge-ghost" style={{ marginLeft: 6 }}>{u.department}</span>}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {u.role === 'student' && (u.class_label || u.class_id || '—')}
                      {(u.role === 'teacher' || u.role === 'mentor') && (u.class_assignments?.length > 0 ? u.class_assignments.map((a, i) => <div key={i}>{classes.find(c => c.id === a.class_id)?.label || a.class_id} {a.subject ? `— ${a.subject}` : ''}</div>) : '—')}
                      {u.role === 'admin' && '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(u)} title="Edit user"><MdEdit /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u)} title="Delete user"><MdDelete /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card card-lg">
            <h3 className="mb-16">✉️ Send Credentials to Section</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              Select a class section to email the login credentials (USN & Password) to all selected students.
            </p>
            <div className="form-group">
              <label className="form-label">Select Class Section *</label>
              <select className="form-control" value={emailClassId} onChange={(e) => setEmailClassId(e.target.value)}>
                <option value="">— Select Class —</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            {emailStudents.length > 0 && (
              <>
                <div className="form-group">
                  <label className="form-label">Password to Send (Default is 123456)</label>
                  <input className="form-control" placeholder="123456" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
                </div>

                <div className="flex-between mb-8">
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Students ({selectedStudentIds.length} selected)</span>
                  <button 
                    type="button"
                    className="btn btn-ghost btn-sm" 
                    onClick={() => {
                      if (selectedStudentIds.length === emailStudents.length) setSelectedStudentIds([]);
                      else setSelectedStudentIds(emailStudents.map(s => s.id));
                    }}
                  >
                    {selectedStudentIds.length === emailStudents.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 16 }}>
                  {emailStudents.map(student => (
                    <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedStudentIds.includes(student.id)} 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedStudentIds(prev => [...prev, student.id]);
                          else setSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                        }} 
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{student.name} ({student.usn})</div>
                        <div style={{ fontSize: '0.75rem', color: student.email ? 'var(--text-muted)' : 'var(--danger)' }}>
                          {student.email || '⚠️ No email registered'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  type="button"
                  className="btn btn-primary btn-block" 
                  onClick={handleSendEmails} 
                  disabled={emailStatus.sending || selectedStudentIds.length === 0}
                >
                  {emailStatus.sending ? 'Sending...' : 'Send Login Details'}
                </button>
              </>
            )}

            {emailStatus.total > 0 && (
              <div style={{ marginTop: 24 }}>
                <div className="flex-between mb-8">
                  <span className="font-semibold">Progress: {emailStatus.current} / {emailStatus.total}</span>
                  <span className="text-muted">{Math.round((emailStatus.current / emailStatus.total) * 100)}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--primary)', width: `${(emailStatus.current / emailStatus.total) * 100}%`, transition: 'width 0.3s' }} />
                </div>
                <div style={{ marginTop: 16, maxHeight: 150, overflowY: 'auto', background: 'var(--surface-2)', padding: 10, borderRadius: 8, fontSize: '0.78rem', fontFamily: 'monospace' }}>
                  {emailStatus.logs.map((log, i) => <div key={i} style={{ marginBottom: 4 }}>{log}</div>)}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3>✉️ Email Setup Notice</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5 }}>
              By default, this feature will run in <strong>Developer Mock Mode</strong> (it simulates sending and logs details in the progress output).
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5 }}>
              To connect it to your actual email server, you can set up a free account at <strong>EmailJS.com</strong> and add these variables to your <code>.env</code> file:
            </p>
            <ul style={{ fontSize: '0.82rem', fontFamily: 'monospace', paddingLeft: 20, marginTop: 8, color: 'var(--primary)' }}>
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
          <div className="card" style={{ width: '100%', maxWidth: 500, animation: 'slideUp 0.3s ease-out' }}>
            <div className="flex-between mb-20">
              <h3><MdEdit /> Edit User: {editingUser.name}</h3>
              <button className="btn btn-ghost" onClick={() => setEditingUser(null)}><MdClose /></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-control" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">USN (Cannot change)</label>
                <input className="form-control" value={editingUser.usn} disabled />
              </div>
              
              {editingUser.role === 'student' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Class Section</label>
                    <select className="form-control" value={editForm.class_id} onChange={(e) => setEditForm({ ...editForm, class_id: e.target.value })}>
                      <option value="">— Select Class —</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assign Mentor</label>
                    <select className="form-control" value={editForm.mentor_id || ''} onChange={(e) => setEditForm({ ...editForm, mentor_id: e.target.value })}>
                      <option value="">— Select Mentor —</option>
                      {mentors.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.usn})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Personal Email</label>
                    <input type="email" className="form-control" value={editForm.personalEmail || ''} onChange={(e) => setEditForm({ ...editForm, personalEmail: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <input type="checkbox" id="editIsHostelite" checked={editForm.isHostelite || false} onChange={(e) => setEditForm({ ...editForm, isHostelite: e.target.checked })} />
                    <label htmlFor="editIsHostelite" style={{ cursor: 'pointer', fontSize: '0.88rem' }}>Is Student Hostelite?</label>
                  </div>
                </>
              )}

              {(editingUser.role === 'teacher' || editingUser.role === 'mentor') && (
                <>
                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <select className="form-control" value={editForm.department || 'CSE'} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                      <label className="form-label">Class & Subject Assignments</label>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 8 }}>
                      {(editForm.class_assignments || []).map((a, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--primary-light)', borderRadius: 6, fontSize: '0.82rem', marginBottom: 6 }}>
                          <span style={{ flex: 1 }}><strong>{classes.find(c => c.id === a.class_id)?.label || a.class_id}</strong> {a.subject && `— ${a.subject}`}</span>
                          <button type="button" className="btn btn-sm btn-danger" style={{ padding: '2px 6px' }} onClick={() => removeEditAssignment(i)}><MdClose /></button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <select className="form-control" style={{ flex: 2, minWidth: 140 }} value={editAssignRow.class_id} onChange={(e) => setEditAssignRow({ ...editAssignRow, class_id: e.target.value })}>
                          <option value="">Class…</option>
                          {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                                                <input className="form-control" style={{ flex: 2, minWidth: 120 }} placeholder="Subject (optional)" value={editAssignRow.subject} onChange={(e) => setEditAssignRow({ ...editAssignRow, subject: e.target.value })} />
                        <button type="button" className="btn btn-sm btn-primary" onClick={addEditAssignment}><MdAdd /> Add</button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={loading}><MdSave /> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
