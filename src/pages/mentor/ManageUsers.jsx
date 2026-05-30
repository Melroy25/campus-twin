import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { listenClasses, deleteDocument, getAll, updateDocument, queryDocuments } from '../../appwrite/database';
import { supabase } from '../../supabase/config';
import { toast } from 'react-hot-toast';
import { MdAdd, MdDelete, MdPerson, MdClose, MdGroup, MdSearch, MdFileUpload, MdEdit, MdSave } from 'react-icons/md';
import { Query } from 'appwrite';
import * as XLSX from 'xlsx';

const ROLES = ['student', 'teacher', 'mentor'];

export default function MentorManageUsers() {
  const { createUser, currentUser } = useAuth();
  const [form, setForm] = useState({
    name: '', usn: '', password: '', role: 'student',
    class_id: '', mentor_id: '',
    class_assignments: [],
    personalEmail: '',
    isHostelite: false,
    hostel_type: '',
    phone: '',
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

  useEffect(() => {
    const unsub = listenClasses(setClasses);
    loadAllUsers();
    return unsub;
  }, []);

  const loadAllUsers = async () => {
    setLoading(true);
    try {
      const [students, teachers, roles] = await Promise.all([
        getAll('students'),
        getAll('teachers'),
        getAll('userRoles'),
      ]);
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

      // Filter out admins so mentors only manage teachers/mentors/students
      const filteredStudents = students.map((u) => ({
        ...u,
        isHostelite: u.hostel_type === 'boys' || u.hostel_type === 'girls',
        _collection: 'students',
        role: roleMap[u.uid] || 'student',
        usn: u.usn || usnMap[u.uid] || '—',
        phone: phoneMap[u.uid] || '',
        personalEmail: emailMap[u.uid] || '',
      }));
      const filteredTeachers = teachers.map((u) => ({
        ...u,
        _collection: 'teachers',
        role: roleMap[u.uid] || (u.class_assignments ? 'teacher' : 'mentor'),
        usn: usnMap[u.uid] || '—',
        phone: phoneMap[u.uid] || '',
        personalEmail: emailMap[u.uid] || '',
      }));

      setAllUsers([
        ...filteredStudents,
        ...filteredTeachers,
      ]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
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
        ...(form.role === 'student' ? {
          class_id: form.class_id,
          class_label: classObj?.label || form.class_id,
          mentor_id: form.mentor_id || currentUser.uid, // Default to current mentor
          personalEmail: form.personalEmail,
          isHostelite: form.isHostelite,
          hostel_type: form.hostel_type || '',
          gender: form.hostel_type === 'boys' ? 'male' : form.hostel_type === 'girls' ? 'female' : 'male',
        } : {}),
        ...(form.role === 'teacher' || form.role === 'mentor' ? {
          class_assignments: form.class_assignments,
        } : {}),
      };
      await createUser(form.usn, form.password, profileData);
      toast.success(`${form.role} account created for ${form.name}!`);
      setForm({ name: '', usn: '', password: '', role: 'student', class_id: '', mentor_id: '', class_assignments: [], personalEmail: '', isHostelite: false, hostel_type: '', phone: '' });
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

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const classObj = classes.find((c) => c.id === editForm.class_id);
      const updateData = {
        name: editForm.name,
        ...(editForm.role === 'student' ? {
          class_id: editForm.class_id,
          class_label: classObj?.label || editForm.class_id,
          mentor_id: editForm.mentor_id || currentUser.uid,
          hostel_type: editForm.hostel_type || '',
          gender: editForm.hostel_type === 'boys' ? 'male' : editForm.hostel_type === 'girls' ? 'female' : (editForm.gender || 'male'),
        } : {}),
      };
      await updateDocument(editingUser._collection, editingUser.id, updateData);
      
      // Sync user details to central userRoles collection
      const rolesDocs = await queryDocuments('userRoles', [Query.equal('uid', editingUser.uid || editingUser.id)]);
      if (rolesDocs.length > 0) {
        await updateDocument('userRoles', rolesDocs[0].$id, {
          name: editForm.name,
          phone: editForm.phone || '',
          email: editForm.personalEmail || '',
        });
      } else {
        await updateDocument('userRoles', editingUser.id, {
          name: editForm.name,
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
            mentor_id: editForm.mentor_id || currentUser.uid,
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
    if (!window.confirm(`Delete user "${user.name}" (${user.usn})?`)) return;
    try {
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

      toast.success('User deleted successfully');
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
              mentor_id: currentUser.uid,
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

  const mentors = allUsers.filter((u) => u.role === 'mentor');
  const filteredUsers = allUsers.filter((u) =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.usn || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout pageTitle="Manage Users">
      <h1 className="page-title">Manage Users (Mentor Dashboard)</h1>
      <p className="page-subtitle">Create and manage students and teachers in the system</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { id: 'create', label: '➕ Create Account' },
          { id: 'bulk', label: '📁 Bulk Upload' },
          { id: 'list', label: `👥 All Users (${allUsers.length})` },
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
                <input className="form-control" placeholder="e.g. Jane Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">USN / Username *</label>
                <input className="form-control" placeholder="e.g. 4SF21CS002" value={form.usn} onChange={(e) => setForm({ ...form, usn: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input type="password" className="form-control" placeholder="Min 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input className="form-control" placeholder="e.g. +91 9988776655" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Personal Email</label>
                <input type="email" className="form-control" placeholder="student@example.com" value={form.personalEmail} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} />
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
                    <label className="form-label">Assign Mentor (Defaults to you)</label>
                    <select className="form-control" value={form.mentor_id} onChange={(e) => setForm({ ...form, mentor_id: e.target.value })}>
                      <option value="">— Select Mentor —</option>
                      {mentors.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.usn})</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginTop: 12 }}>
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
                </>
              )}

              {/* Teacher / Mentor fields */}
              {(form.role === 'teacher' || form.role === 'mentor') && (
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
              )}

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</button>
            </form>
          </div>

          <div className="card">
            <h3 className="mb-16">ℹ️ Quick Roles Guide</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { name: 'Student', role: 'student', desc: 'Assigned to classes, checks attendance, registering for courses, uploads AICTE proof documents.' },
                { name: 'Teacher', role: 'teacher', desc: 'Marks subject attendance, adds internal marks, reviews student leave requests.' },
                { name: 'Mentor', role: 'mentor', desc: 'Owns classes, approves AICTE points, handles class rosters, communicates via official Class Chat.' },
              ].map(r => (
                <div key={r.role} style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                  <div className="flex-between"><span className="font-semibold">{r.name}</span><span className="badge badge-primary">{r.role}</span></div>
                  <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bulk' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card card-lg" style={{ padding: 18 }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}><MdFileUpload style={{ verticalAlign: 'middle' }} /> Excel Bulk Student Upload</h3>
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
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              Upload student spreadsheet list (<code>.xlsx</code> or <code>.xls</code>) with columns: <strong>Sl No</strong>, <strong>Name</strong>, <strong>USN</strong>, <strong>Password</strong>, <strong>Email</strong>, <strong>Hostelite</strong>, and <strong>Phone</strong>.
            </p>
            <form onSubmit={handleBulkUpload}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ marginBottom: 4 }}>Select Target Class Section *</label>
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
                {loading ? 'Processing...' : 'Start Bulk Upload'}
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
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 6px 0' }}>💡 <strong>Pro-Tip:</strong> Use the <strong>Download Template</strong> button to get a fully formatted excel spreadsheet with dummy data to get started quickly.</p>
              <p style={{ margin: 0 }}>⚠️ All created students will be assigned under you as their Mentor automatically.</p>
            </div>
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

          {loading ? (
            <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>USN / Username</th>
                    <th>Role</th>
                    <th>Class / Assignment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="font-semibold">{u.name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{u.usn || u.email?.split('@')[0]}</td>
                      <td>
                        <span className={`badge badge-${u.role === 'teacher' ? 'primary' : u.role === 'mentor' ? 'pending' : 'approved'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {u.role === 'student' && (u.class_label || u.class_id || '—')}
                        {(u.role === 'teacher' || u.role === 'mentor') && (u.class_assignments?.length > 0 ? u.class_assignments.map((a, i) => <div key={i}>{classes.find(c => c.id === a.class_id)?.label || a.class_id} {a.subject ? `— ${a.subject}` : ''}</div>) : '—')}
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
          )}
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
                <input className="form-control" value={editingUser.usn || editingUser.email?.split('@')[0]} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-control" value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="e.g. +91 9988776655" />
              </div>
              <div className="form-group">
                <label className="form-label">Personal Email</label>
                <input type="email" className="form-control" value={editForm.personalEmail || ''} onChange={(e) => setEditForm({ ...editForm, personalEmail: e.target.value })} placeholder="e.g. user@example.com" />
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
                  <div className="form-group" style={{ marginTop: 12 }}>
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
