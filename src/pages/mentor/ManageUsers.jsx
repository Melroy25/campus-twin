import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { listenClasses, deleteDocument, getAll, updateDocument } from '../../appwrite/database';
import { supabase } from '../../supabase/config';
import { toast } from 'react-hot-toast';
import { MdAdd, MdDelete, MdPerson, MdClose, MdGroup, MdSearch, MdFileUpload, MdEdit, MdSave } from 'react-icons/md';
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
      roles.forEach((r) => {
        roleMap[r.uid] = r.role;
      });

      // Filter out admins so mentors only manage teachers/mentors/students
      const filteredStudents = students.map((u) => ({ ...u, _collection: 'students', role: roleMap[u.uid] || 'student' }));
      const filteredTeachers = teachers.map((u) => ({ ...u, _collection: 'teachers', role: roleMap[u.uid] || (u.class_assignments ? 'teacher' : 'mentor') }));

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
        ...(form.role === 'student' ? {
          class_id: form.class_id,
          class_label: classObj?.label || form.class_id,
          mentor_id: form.mentor_id || currentUser.uid, // Default to current mentor
          personalEmail: form.personalEmail,
          isHostelite: form.isHostelite,
        } : {}),
        ...(form.role === 'teacher' || form.role === 'mentor' ? {
          class_assignments: form.class_assignments,
        } : {}),
      };
      await createUser(form.usn, form.password, profileData);
      toast.success(`${form.role} account created for ${form.name}!`);
      setForm({ name: '', usn: '', password: '', role: 'student', class_id: '', mentor_id: '', class_assignments: [], personalEmail: '', isHostelite: false });
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
          personalEmail: editForm.personalEmail || '',
          isHostelite: editForm.isHostelite || false,
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
      await deleteDocument('userRoles', user.id);
      
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
              mentor_id: currentUser.uid,
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
          <div className="card card-lg">
            <h3 className="mb-16"><MdFileUpload style={{ verticalAlign: 'middle' }} /> Excel Bulk Student Upload</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              Upload student spreadsheet list (<code>.xlsx</code> or <code>.xls</code>). It must contain: <strong>Name</strong> and <strong>usn</strong>.
            </p>
            <form onSubmit={handleBulkUpload}>
              <div className="form-group">
                <label className="form-label">Select Target Class Section *</label>
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
            <h3>📖 Excel format guide</h3>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: 20, marginTop: 12 }}>
              <li style={{ marginBottom: 8 }}>Prepare sheet with header columns <strong>Name</strong> and <strong>usn</strong>.</li>
              <li style={{ marginBottom: 8 }}>Optionally add a <strong>password</strong> column (defaults to 123456 if left blank).</li>
              <li style={{ marginBottom: 8 }}>Students are automatically assigned to this class section with you as their Mentor.</li>
              <li>Duplicates or existing USNs will be skipped.</li>
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
                    <label className="form-label">Personal Email</label>
                    <input type="email" className="form-control" value={editForm.personalEmail || ''} onChange={(e) => setEditForm({ ...editForm, personalEmail: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <input type="checkbox" id="editIsHostelite" checked={editForm.isHostelite || false} onChange={(e) => setEditForm({ ...editForm, isHostelite: e.target.checked })} />
                    <label htmlFor="editIsHostelite" style={{ cursor: 'pointer', fontSize: '0.88rem' }}>Is Student Hostelite?</label>
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
